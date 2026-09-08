import express from 'express';

import Attendance from '../models/Attendance.js';
import PersonalUser from '../models/PersonalUser.js';

import {
  protect,
  requireWrite,
} from '../middleware/auth.js';

import asyncHandler from '../middleware/asyncHandler.js';

import logActivity from '../utils/activityLog.js';

const router = express.Router();

router.use(protect);

const log = (req, action, description) =>
  logActivity(req, {
    action,
    module: 'attendance',
    description,
  });

const validMachine = (value) => {
  return value === 'big' || value === 'small'
    ? value
    : null;
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeDate = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  /*
   * Store date at UTC midnight.
   * This prevents timezone-related date shifting.
   */
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
};

const dateKey = (value) => {
  const date = normalizeDate(value);

  if (!date) return null;

  return date.toISOString().slice(0, 10);
};

const monthFromDate = (value) => {
  const key = dateKey(value);

  if (!key) return null;

  return key.slice(0, 7);
};

const employeeIdsByName = async (search) => {
  const employees = await PersonalUser.find({
    name: {
      $regex: search,
      $options: 'i',
    },
  })
    .select('_id')
    .lean();

  return employees.map((employee) => employee._id);
};

/*
|--------------------------------------------------------------------------
| GET ALL ATTENDANCE RECORDS
|--------------------------------------------------------------------------
|
| GET /api/attendance
|
*/

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      search,
      page = 1,
      limit = 100,
      machineType,
      employeeId,
      month,
    } = req.query;

    const query = {};

    if (search) {
      const employeeIds =
        await employeeIdsByName(search);

      query.employeeId = {
        $in: employeeIds,
      };
    }

    if (employeeId) {
      query.employeeId = employeeId;
    }

    if (month) {
      query.month = month;
    }

    const machine = validMachine(machineType);

    if (machine) {
      query.machineType = machine;
    }

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit) || 100, 1),
      500
    );

    const [total, records] =
      await Promise.all([
        Attendance.countDocuments(query),

        Attendance.find(query)
          .populate(
            'employeeId',
            'name type salary date phone email'
          )
          .sort({
            month: -1,
            createdAt: -1,
          })
          .skip(
            (pageNumber - 1) *
              limitNumber
          )
          .limit(limitNumber)
          .lean(),
      ]);

    res.json({
      success: true,
      records,
      total,
      page: pageNumber,
      limit: limitNumber,
    });
  })
);

/*
|--------------------------------------------------------------------------
| GET ONE ATTENDANCE RECORD
|--------------------------------------------------------------------------
|
| GET /api/attendance/:id
|
*/

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const record =
      await Attendance.findById(req.params.id)
        .populate(
          'employeeId',
          'name type salary date phone email'
        )
        .lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    res.json({
      success: true,
      record,
    });
  })
);

/*
|--------------------------------------------------------------------------
| MARK ABSENT
|--------------------------------------------------------------------------
|
| POST /api/attendance/absent
|
| Body:
|
| {
|   employeeId,
|   absenceDate: "2026-08-03",
|   machineType: "big",
|   reason: "Fever"
| }
|
*/

router.post(
  '/absent',
  requireWrite,
  asyncHandler(async (req, res) => {
    const {
      employeeId,
      absenceDate,
      machineType,
      reason = '',
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee is required',
      });
    }

    const normalizedDate =
      normalizeDate(absenceDate);

    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid absence date is required',
      });
    }

    const machine =
      validMachine(machineType) ||
      'small';

    const month =
      monthFromDate(absenceDate);

    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'Invalid absence date',
      });
    }

    const employee =
      await PersonalUser.findById(employeeId)
        .select('name salary')
        .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    let attendance =
      await Attendance.findOne({
        employeeId,
        month,
        machineType: machine,
      });

    if (!attendance) {
      attendance =
        new Attendance({
          employeeId,
          month,
          machineType: machine,
          absentDates: [],
          createdBy: req.user?.name || '',
        });
    }

    const existingIndex =
      attendance.absentDates.findIndex(
        (item) =>
          dateKey(item.date) ===
          dateKey(normalizedDate)
      );

    /*
     * Already absent
     */
    if (existingIndex !== -1) {
      return res.status(409).json({
        success: false,
        message:
          'This date is already marked absent',
        record: attendance,
      });
    }

    attendance.absentDates.push({
      date: normalizedDate,
      reason: String(reason || '').trim(),
    });

    attendance.absentDays =
      attendance.absentDates.length;

    await attendance.save();

    await attendance.populate(
      'employeeId',
      'name type salary date phone email'
    );

    log(
      req,
      'create',
      `Marked ${employee.name} absent on ${dateKey(
        normalizedDate
      )}`
    );

    res.status(201).json({
      success: true,
      message: 'Absent date saved successfully',
      record: attendance,
    });
  })
);

/*
|--------------------------------------------------------------------------
| REMOVE ABSENCE
|--------------------------------------------------------------------------
|
| POST /api/attendance/present
|
| This changes an absent date back to present.
|
| Body:
|
| {
|   employeeId,
|   absenceDate,
|   machineType
| }
|
*/

router.post(
  '/present',
  requireWrite,
  asyncHandler(async (req, res) => {
    const {
      employeeId,
      absenceDate,
      machineType,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee is required',
      });
    }

    const normalizedDate =
      normalizeDate(absenceDate);

    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid attendance date is required',
      });
    }

    const machine =
      validMachine(machineType) ||
      'small';

    const month =
      monthFromDate(absenceDate);

    const attendance =
      await Attendance.findOne({
        employeeId,
        month,
        machineType: machine,
      });

    if (!attendance) {
      return res.json({
        success: true,
        message:
          'Date is already present',
      });
    }

    const originalLength =
      attendance.absentDates.length;

    attendance.absentDates =
      attendance.absentDates.filter(
        (item) =>
          dateKey(item.date) !==
          dateKey(normalizedDate)
      );

    if (
      attendance.absentDates.length ===
      originalLength
    ) {
      return res.json({
        success: true,
        message:
          'Date is already present',
        record: attendance,
      });
    }

    attendance.absentDays =
      attendance.absentDates.length;

    /*
     * Remove empty monthly documents.
     */
    if (
      attendance.absentDates.length === 0
    ) {
      await Attendance.findByIdAndDelete(
        attendance._id
      );
    } else {
      await attendance.save();
    }

    log(
      req,
      'update',
      `Changed ${dateKey(
        normalizedDate
      )} back to present`
    );

    res.json({
      success: true,
      message:
        'Date changed to present',
    });
  })
);

/*
|--------------------------------------------------------------------------
| CREATE / UPDATE MONTHLY RECORD
|--------------------------------------------------------------------------
|
| Kept for compatibility with your existing frontend.
|
*/

router.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const {
      employeeId,
      month,
      machineType,
      absentDates = [],
      notes = '',
    } = req.body;

    if (!employeeId || !month) {
      return res.status(400).json({
        success: false,
        message:
          'Employee and month are required',
      });
    }

    const machine =
      validMachine(machineType) ||
      'small';

    const cleanDates = [];

    for (const item of absentDates) {
      const normalized =
        normalizeDate(
          item?.date || item
        );

      if (!normalized) continue;

      const exists =
        cleanDates.some(
          (existing) =>
            dateKey(existing.date) ===
            dateKey(normalized)
        );

      if (!exists) {
        cleanDates.push({
          date: normalized,
          reason:
            typeof item === 'object'
              ? String(
                  item.reason || ''
                ).trim()
              : '',
        });
      }
    }

    const record =
      await Attendance.findOneAndUpdate(
        {
          employeeId,
          month,
          machineType: machine,
        },
        {
          $set: {
            employeeId,
            month,
            machineType: machine,
            absentDates: cleanDates,
            absentDays:
              cleanDates.length,
            notes,
            createdBy:
              req.user?.name || '',
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

    await record.populate(
      'employeeId',
      'name type salary date phone email'
    );

    log(
      req,
      'create',
      `Updated attendance for ${
        record.employeeId?.name ||
        'employee'
      } (${month})`
    );

    res.status(201).json({
      success: true,
      record,
    });
  })
);

/*
|--------------------------------------------------------------------------
| UPDATE MONTHLY RECORD
|--------------------------------------------------------------------------
*/

router.put(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const record =
      await Attendance.findById(
        req.params.id
      );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    if (
      req.body.absentDates
    ) {
      const cleanDates = [];

      for (
        const item of req.body.absentDates
      ) {
        const normalized =
          normalizeDate(
            item?.date || item
          );

        if (!normalized) continue;

        const exists =
          cleanDates.some(
            (existing) =>
              dateKey(
                existing.date
              ) ===
              dateKey(normalized)
          );

        if (!exists) {
          cleanDates.push({
            date: normalized,
            reason:
              typeof item === 'object'
                ? String(
                    item.reason || ''
                  ).trim()
                : '',
          });
        }
      }

      record.absentDates =
        cleanDates;
    }

    if (req.body.notes !== undefined) {
      record.notes =
        req.body.notes;
    }

    if (req.body.month) {
      record.month =
        req.body.month;
    }

    if (req.body.machineType) {
      const machine =
        validMachine(
          req.body.machineType
        );

      if (machine) {
        record.machineType =
          machine;
      }
    }

    record.absentDays =
      record.absentDates.length;

    await record.save();

    await record.populate(
      'employeeId',
      'name type salary date phone email'
    );

    log(
      req,
      'update',
      `Updated attendance for ${
        record.employeeId?.name ||
        'employee'
      }`
    );

    res.json({
      success: true,
      record,
    });
  })
);

/*
|--------------------------------------------------------------------------
| DELETE MONTHLY RECORD
|--------------------------------------------------------------------------
*/

router.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const record =
      await Attendance.findByIdAndDelete(
        req.params.id
      );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    log(
      req,
      'delete',
      `Deleted attendance record (${record.month})`
    );

    res.json({
      success: true,
      message:
        'Attendance record deleted',
    });
  })
);

export default router;