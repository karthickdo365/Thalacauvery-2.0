import express from 'express';
import Material from '../models/Material.js';
import Bill from '../models/Bill.js';
import PersonalUser from '../models/PersonalUser.js';
import { protect } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

router.use(protect);

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/*
  IMPORTANT:
  Reports only include active records.

  isDeleted: true  -> excluded
  isDeleted: false -> included
  isDeleted missing -> included

  This allows old records that were created before
  isDeleted was added to still appear in reports.
*/


// ============================================================
// GET /api/reports/profit-loss?year=2025
// ============================================================
router.get(
  '/profit-loss',
  asyncHandler(async (req, res) => {
    const year =
      Number(req.query.year) || new Date().getFullYear();

    const machineType = req.query.machineType;

    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);


    // ----------------------------------------------------------
    // Common active-record filter
    // ----------------------------------------------------------
    const activeFilter = {
      isDeleted: { $ne: true },
    };


    // ----------------------------------------------------------
    // Machine filter
    // ----------------------------------------------------------
    const billMatch = {
      ...activeFilter,
      date: {
        $gte: start,
        $lte: end,
      },
    };

    const materialMatch = {
      ...activeFilter,
      date: {
        $gte: start,
        $lte: end,
      },
    };


    // Only add machineType when it is actually selected.
    if (machineType) {
      billMatch.machineType = machineType;
      materialMatch.machineType = machineType;
    }


    // ----------------------------------------------------------
    // Salary / Employee / Partner
    // ----------------------------------------------------------
    const salaryMatch = {
      ...activeFilter,
      type: {
        $in: ['Employee', 'Partner'],
      },
    };

    if (machineType) {
      salaryMatch.machineType = machineType;
    }


    // ----------------------------------------------------------
    // Run all reports together
    // ----------------------------------------------------------
    const [salaryAgg, billAgg, materialAgg] =
      await Promise.all([

        // Salary
        PersonalUser.aggregate([
          {
            $match: salaryMatch,
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $ifNull: ['$salary', 0],
                },
              },
            },
          },
        ]),

        // Bills / Revenue
        Bill.aggregate([
          {
            $match: billMatch,
          },
          {
            $group: {
              _id: {
                $month: '$date',
              },

              worksCount: {
                $sum: 1,
              },

              revenue: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$paymentStatus', 'Paid'],
                    },
                    {
                      $ifNull: ['$totalAmount', 0],
                    },
                    {
                      $ifNull: ['$paidAmount', 0],
                    },
                  ],
                },
              },
            },
          },
        ]),

        // Materials / Expenses
        Material.aggregate([
          {
            $match: materialMatch,
          },
          {
            $group: {
              _id: {
                $month: '$date',
              },

              total: {
                $sum: {
                  $ifNull: ['$totalPrice', 0],
                },
              },
            },
          },
        ]),
      ]);


    // ----------------------------------------------------------
    // Convert aggregation results into maps
    // ----------------------------------------------------------
    const monthlySalary =
      salaryAgg[0]?.total || 0;

    const billMap = new Map(
      billAgg.map((b) => [
        b._id,
        b,
      ])
    );

    const materialMap = new Map(
      materialAgg.map((m) => [
        m._id,
        m.total,
      ])
    );


    // ----------------------------------------------------------
    // Build 12-month report
    // ----------------------------------------------------------
    const report = [];

    const totals = {
      revenue: 0,
      materialExpense: 0,
      salaryExpense: 0,
      totalExpense: 0,
      profit: 0,
      worksCount: 0,
    };


    for (let m = 1; m <= 12; m++) {

      const revenue =
        billMap.get(m)?.revenue || 0;

      const worksCount =
        billMap.get(m)?.worksCount || 0;

      const materialExpense =
        materialMap.get(m) || 0;

      const totalExpense =
        materialExpense + monthlySalary;

      const profit =
        revenue - totalExpense;


      // Totals
      totals.revenue += revenue;

      totals.materialExpense +=
        materialExpense;

      totals.salaryExpense +=
        monthlySalary;

      totals.totalExpense +=
        totalExpense;

      totals.profit += profit;

      totals.worksCount +=
        worksCount;


      report.push({
        month: m,
        monthLabel: MONTHS[m - 1],

        worksCount,

        revenue,

        materialExpense,

        salaryExpense:
          monthlySalary,

        totalExpense,

        profit,
      });
    }


    res.json({
      success: true,

      report,

      totals,

      monthlySalary,
    });
  })
);


// ============================================================
// GET /api/reports/daily-expense?date=2025-01-15
// ============================================================
router.get(
  '/daily-expense',
  asyncHandler(async (req, res) => {

    const date = req.query.date
      ? new Date(req.query.date)
      : new Date();

    const start = new Date(date);

    start.setHours(
      0,
      0,
      0,
      0
    );

    const end = new Date(date);

    end.setHours(
      23,
      59,
      59,
      999
    );


    const machineType =
      req.query.machineType;


    // ----------------------------------------------------------
    // Only active materials
    // ----------------------------------------------------------
    const materialFilter = {
      date: {
        $gte: start,
        $lte: end,
      },

      // IMPORTANT:
      // Deleted records will NOT appear.
      isDeleted: {
        $ne: true,
      },
    };


    // Machine filter
    if (machineType) {
      materialFilter.machineType =
        machineType;
    }


    // ----------------------------------------------------------
    // Fetch materials
    // ----------------------------------------------------------
    const materials =
      await Material.find(materialFilter)
        .sort({
          createdAt: -1,
        })
        .lean();


    // ----------------------------------------------------------
    // Calculate total only from active records
    // ----------------------------------------------------------
    const totalExpense =
      materials.reduce(
        (sum, material) =>
          sum +
          (material.totalPrice || 0),
        0
      );


    res.json({
      success: true,

      materials,

      totalExpense,

      itemCount:
        materials.length,
    });
  })
);


export default router;