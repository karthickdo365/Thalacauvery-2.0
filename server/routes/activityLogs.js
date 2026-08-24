import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { protect, requireWrite } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();
// Audit trail is sensitive — partner/admin only
router.use(protect, requireWrite);

// GET /api/activity-logs?search=&module=&action=&startDate=&endDate=&page=&limit=
router.get('/', asyncHandler(async (req, res) => {
  const { search, module, action, startDate, endDate, page = 1, limit = 20, machineType } = req.query;
  const query = {};
  if (machineType === 'big' || machineType === 'small') query.machineType = machineType;

  if (module) query.module = module;
  if (action) query.action = action;
  if (search) {
    query.$or = [
      { userName:    { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate)   query.createdAt.$lte = new Date(endDate);
  }

  const [total, logs] = await Promise.all([
    ActivityLog.countDocuments(query),
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean(),
  ]);

  res.json({ success: true, logs, total });
}));

export default router;
