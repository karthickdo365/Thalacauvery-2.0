import express from 'express';
import SalaryAdvance from '../models/SalaryAdvance.js';
import PersonalUser from '../models/PersonalUser.js';
import { protect, requireWrite } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import logActivity from '../utils/activityLog.js';

const router = express.Router();

router.use(protect);

const log = (req, action, description) =>
  logActivity(req, {
    action,
    module: 'salary',
    description,
  });

const validMachine = (value) =>
  value === 'big' || value === 'small'
    ? value
    : null;


/*
=========================================================
GET ALL ADVANCES
GET /api/salary-advances

Query:
employeeId
machineType
startDate
endDate
page
limit
=========================================================
*/

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      employeeId,
      machineType,
      startDate,
      endDate,
      page = 1,
      limit = 100,
    } = req.query;

    const query = {};

    if (employeeId) {
      query.employeeId = employeeId;
    }

    const mt = validMachine(machineType);

    if (mt) {
      query.machineType = mt;
    }

    if (startDate || endDate) {
      query.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        query.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        query.createdAt.$lte = end;
      }
    }

    const numericPage = Math.max(
      Number(page) || 1,
      1
    );

    const numericLimit = Math.min(
      Number(limit) || 100,
      1000
    );

    const [total, records] =
      await Promise.all([
        SalaryAdvance.countDocuments(query),

        SalaryAdvance.find(query)
          .populate(
            'employeeId',
            'name type salary date phone machineType'
          )
          .sort({
            createdAt: -1,
          })
          .skip(
            (numericPage - 1) *
              numericLimit
          )
          .limit(numericLimit)
          .lean(),
      ]);

    const totalAdvance = records.reduce(
      (sum, item) =>
        sum +
        Number(
          item.advanceAmount || 0
        ),
      0
    );

    res.json({
      success: true,
      records,
      total,
      totalAdvance,
    });
  })
);


/*
=========================================================
GET SINGLE ADVANCE
GET /api/salary-advances/:id
=========================================================
*/

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const record =
      await SalaryAdvance.findById(
        req.params.id
      )
        .populate(
          'employeeId',
          'name type salary date phone machineType'
        )
        .lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message:
          'Salary advance not found',
      });
    }

    res.json({
      success: true,
      record,
    });
  })
);


/*
=========================================================
CREATE ADVANCE

POST /api/salary-advances
=========================================================

Body:

{
  employeeId,
  month,
  machineType,
  advanceAmount,
  paymentMode,
  notes
}
=========================================================
*/

router.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const {
      employeeId,
      month,
      machineType,
      advanceAmount,
      paymentMode = 'cash',
      notes = '',
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message:
          'Employee is required',
      });
    }

    const mt = validMachine(machineType);

    if (!mt) {
      return res.status(400).json({
        success: false,
        message:
          'Valid machine type is required',
      });
    }

    const amount =
      Number(advanceAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Advance amount must be greater than zero',
      });
    }


    /*
     * Verify employee.
     */

    const employee =
      await PersonalUser.findById(
        employeeId
      ).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          'Employee not found',
      });
    }


    /*
     * Employee must belong
     * to selected machine.
     */

    if (
      employee.machineType !== mt &&
      employee.machineType !== 'both'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Employee does not belong to this machine',
      });
    }


    /*
     * Validate payment mode.
     */

    const validPaymentModes = [
      'cash',
      'gpay',
      'net_banking',
      'cheque',
    ];

    if (
      !validPaymentModes.includes(
        paymentMode
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid payment mode',
      });
    }


    /*
     * Month is optional from frontend.
     * If not supplied, use current month.
     */

    const currentMonth =
      new Date()
        .toISOString()
        .slice(0, 7);

    const advanceMonth =
      /^\d{4}-\d{2}$/.test(
        month || ''
      )
        ? month
        : currentMonth;


    const record =
      await SalaryAdvance.create({
        employeeId,

        month:
          advanceMonth,

        machineType:
          mt,

        advanceAmount:
          amount,

        paymentMode,

        notes:
          String(
            notes || ''
          ).trim(),

        createdBy:
          req.user?.name || '',
      });


    const populated =
      await record.populate(
        'employeeId',
        'name type salary date phone machineType'
      );


    log(
      req,
      'create',
      `Added salary advance ₹${amount} for ${employee.name}`
    );


    res.status(201).json({
      success: true,
      record: populated,
    });
  })
);


/*
=========================================================
UPDATE ADVANCE

PUT /api/salary-advances/:id
=========================================================
*/

router.put(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const record =
      await SalaryAdvance.findById(
        req.params.id
      );

    if (!record) {
      return res.status(404).json({
        success: false,
        message:
          'Salary advance not found',
      });
    }


    if (
      req.body.advanceAmount !==
      undefined
    ) {
      const amount =
        Number(
          req.body.advanceAmount
        );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Advance amount must be greater than zero',
        });
      }

      record.advanceAmount =
        amount;
    }


    if (
      req.body.paymentMode !==
      undefined
    ) {
      const validModes = [
        'cash',
        'gpay',
        'net_banking',
        'cheque',
      ];

      if (
        !validModes.includes(
          req.body.paymentMode
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid payment mode',
        });
      }

      record.paymentMode =
        req.body.paymentMode;
    }


    if (
      req.body.month !==
      undefined
    ) {
      if (
        !/^\d{4}-\d{2}$/.test(
          req.body.month
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid month format',
        });
      }

      record.month =
        req.body.month;
    }


    if (
      req.body.notes !==
      undefined
    ) {
      record.notes =
        String(
          req.body.notes || ''
        ).trim();
    }


    await record.save();


    const populated =
      await record.populate(
        'employeeId',
        'name type salary date phone machineType'
      );


    log(
      req,
      'update',
      `Updated salary advance for ${populated.employeeId?.name || 'employee'}`
    );


    res.json({
      success: true,
      record: populated,
    });
  })
);


/*
=========================================================
DELETE ADVANCE

DELETE /api/salary-advances/:id
=========================================================
*/

router.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const record =
      await SalaryAdvance.findByIdAndDelete(
        req.params.id
      );

    if (!record) {
      return res.status(404).json({
        success: false,
        message:
          'Salary advance not found',
      });
    }


    log(
      req,
      'delete',
      `Deleted salary advance ₹${record.advanceAmount}`
    );


    res.json({
      success: true,
      message:
        'Salary advance deleted',
    });
  })
);


export default router;