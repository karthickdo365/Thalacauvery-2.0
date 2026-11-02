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
  value === 'big' || value === 'small' ? value : null;

/*
 * Parses "YYYY-MM-DD" into a Date at 12:00 UTC.
 * Using noon means timezone differences (IST, UTC, etc.)
 * can never shift the calendar day.
 * Returns null when the value is missing or invalid.
 */
const parseAdvanceDate = (value) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const d = new Date(`${trimmed}T12:00:00.000Z`);

  return Number.isNaN(d.getTime()) ? null : d;
};

const validPaymentModes = ['cash', 'gpay', 'net_banking', 'cheque'];

/*
=========================================================
GET ALL ADVANCES
GET /api/salary-advances

Query:
employeeId, machineType, startDate, endDate, page, limit
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

    /*
     * Filter by the advance's own `date`.
     * Older records that have no `date` field fall back to createdAt.
     */
    if (startDate || endDate) {
      const range = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        range.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }

      query.$or = [
        { date: range },
        { date: { $exists: false }, createdAt: range },
      ];
    }

    const numericPage = Math.max(Number(page) || 1, 1);
    const numericLimit = Math.min(Number(limit) || 100, 1000);

    const [total, records] = await Promise.all([
      SalaryAdvance.countDocuments(query),

      SalaryAdvance.find(query)
        .populate(
          'employeeId',
          'name type salary date phone machineType'
        )
        .sort({ date: -1, createdAt: -1 })
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit)
        .lean(),
    ]);

    const totalAdvance = records.reduce(
      (sum, item) => sum + Number(item.advanceAmount || 0),
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
    const record = await SalaryAdvance.findById(req.params.id)
      .populate(
        'employeeId',
        'name type salary date phone machineType'
      )
      .lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Salary advance not found',
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

Body:
{
  employeeId,
  date,          // "YYYY-MM-DD"
  month,         // optional, derived from date when present
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
      date,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee is required',
      });
    }

    const mt = validMachine(machineType);

    if (!mt) {
      return res.status(400).json({
        success: false,
        message: 'Valid machine type is required',
      });
    }

    const amount = Number(advanceAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Advance amount must be greater than zero',
      });
    }

    /*
     * Date: if the client sent one it must be valid.
     * If none was sent, default to today.
     */
    let advanceDate = new Date();

    if (date !== undefined && date !== null && date !== '') {
      const parsed = parseAdvanceDate(date);

      if (!parsed) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
      }

      advanceDate = parsed;
    }

    /*
     * Verify employee.
     */
    const employee = await PersonalUser.findById(employeeId).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    /*
     * Employee must belong to selected machine.
     */
    if (
      employee.machineType !== mt &&
      employee.machineType !== 'both'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Employee does not belong to this machine',
      });
    }

    if (!validPaymentModes.includes(paymentMode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment mode',
      });
    }

    /*
     * Month always follows the advance date so the two never disagree.
     */
    const advanceMonth = advanceDate.toISOString().slice(0, 7);

    const record = await SalaryAdvance.create({
      employeeId,
      month: advanceMonth,
      date: advanceDate,
      machineType: mt,
      advanceAmount: amount,
      paymentMode,
      notes: String(notes || '').trim(),
      createdBy: req.user?.name || '',
    });

    const populated = await record.populate(
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
    const record = await SalaryAdvance.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Salary advance not found',
      });
    }

    if (req.body.advanceAmount !== undefined) {
      const amount = Number(req.body.advanceAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Advance amount must be greater than zero',
        });
      }

      record.advanceAmount = amount;
    }

    if (req.body.paymentMode !== undefined) {
      if (!validPaymentModes.includes(req.body.paymentMode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment mode',
        });
      }

      record.paymentMode = req.body.paymentMode;
    }

    /*
     * Date: this is the field that was previously ignored.
     * When the date changes, the month is kept in sync with it.
     */
    if (req.body.date !== undefined) {
      const parsed = parseAdvanceDate(req.body.date);

      if (!parsed) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format',
        });
      }

      record.date = parsed;
      record.month = parsed.toISOString().slice(0, 7);
    } else if (req.body.month !== undefined) {
      if (!/^\d{4}-\d{2}$/.test(req.body.month)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month format',
        });
      }

      record.month = req.body.month;
    }

    if (req.body.notes !== undefined) {
      record.notes = String(req.body.notes || '').trim();
    }

    await record.save();

    const populated = await record.populate(
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
    const record = await SalaryAdvance.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Salary advance not found',
      });
    }

    log(
      req,
      'delete',
      `Deleted salary advance ₹${record.advanceAmount}`
    );

    res.json({
      success: true,
      message: 'Salary advance deleted',
    });
  })
);

export default router;
