import express from 'express';
import PersonalUser from '../models/PersonalUser.js';
import Material from '../models/Material.js';
import Bill from '../models/Bill.js';
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

const validMachine = (value) => {
  return value === 'big' || value === 'small'
    ? value
    : null;
};


// ============================================================
// GET /api/dashboard/stats?machineType=big|small
// ============================================================

router.get(
  '/stats',
  asyncHandler(async (req, res) => {

    const machineType =
      validMachine(
        req.query.machineType
      );


    // Machine is required.
    // We don't want a mixed dashboard anymore.
    if (!machineType) {
      return res.status(400).json({
        success: false,
        message:
          'Valid machineType is required: big or small',
      });
    }


    // ----------------------------------------------------------
    // MACHINE FILTERS
    // ----------------------------------------------------------

    const peopleMatch = {
      machineType,
    };

    const materialMatch = {
      machineType,
    };

    const billMatch = {
      machineType,
    };


    // ----------------------------------------------------------
    // GET ALL DASHBOARD COUNTS
    // ----------------------------------------------------------

    const [
      peopleAgg,
      materialAgg,
      billAgg,
    ] = await Promise.all([

      // ========================================================
      // PEOPLE
      // ========================================================

      PersonalUser.aggregate([

        {
          $match:
            peopleMatch,
        },

        {
          $group: {
            _id: '$type',
            count: {
              $sum: 1,
            },
          },
        },

      ]),


      // ========================================================
      // MATERIALS
      // ========================================================

      Material.aggregate([

        {
          $match:
            materialMatch,
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: {
                $ifNull: [
                  '$totalPrice',
                  0,
                ],
              },
            },

          },
        },

      ]),


      // ========================================================
      // BILLS
      // ========================================================

      Bill.aggregate([

        {
          $match:
            billMatch,
        },

        {
          $group: {

            _id: null,

            totalPoints: {
              $sum: 1,
            },


            // --------------------------------------------------
            // PAID
            // --------------------------------------------------

            paidAmount: {
              $sum: {

                $switch: {

                  branches: [

                    {
                      case: {
                        $eq: [
                          '$paymentStatus',
                          'Paid',
                        ],
                      },

                      then: {
                        $ifNull: [
                          '$totalAmount',
                          0,
                        ],
                      },
                    },


                    {
                      case: {
                        $eq: [
                          '$paymentStatus',
                          'Partial',
                        ],
                      },

                      then: {
                        $ifNull: [
                          '$paidAmount',
                          0,
                        ],
                      },
                    },

                  ],

                  default: 0,

                },

              },
            },


            // --------------------------------------------------
            // PENDING
            // --------------------------------------------------

            pendingAmount: {
              $sum: {

                $switch: {

                  branches: [

                    // Unpaid
                    {
                      case: {
                        $eq: [
                          '$paymentStatus',
                          'Unpaid',
                        ],
                      },

                      then: {
                        $ifNull: [
                          '$totalAmount',
                          0,
                        ],
                      },
                    },


                    // Partial
                    {
                      case: {
                        $eq: [
                          '$paymentStatus',
                          'Partial',
                        ],
                      },

                      then: {
                        $max: [

                          0,

                          {
                            $subtract: [

                              {
                                $ifNull: [
                                  '$totalAmount',
                                  0,
                                ],
                              },

                              {
                                $ifNull: [
                                  '$paidAmount',
                                  0,
                                ],
                              },

                            ],
                          },

                        ],
                      },
                    },

                  ],

                  default: 0,

                },

              },
            },

          },
        },

      ]),

    ]);


    // ==========================================================
    // PEOPLE COUNTS
    // ==========================================================

    const peopleCounts =
      Object.fromEntries(
        peopleAgg.map(
          (person) => [
            person._id,
            person.count,
          ]
        )
      );


    // ==========================================================
    // BILL RESULT
    // ==========================================================

    const bills =
      billAgg[0] || {};


    // ==========================================================
    // RESPONSE
    // ==========================================================

    res.json({

      success: true,

      machineType,

      stats: {

        totalEmployees:
          peopleCounts.Employee || 0,

        totalBrokers:
          peopleCounts.Broker || 0,

        totalPartners:
          peopleCounts.Partner || 0,

        totalMaterialsCost:
          materialAgg[0]?.total || 0,

        totalBorewellPoints:
          bills.totalPoints || 0,

        paidAmount:
          bills.paidAmount || 0,

        pendingAmount:
          bills.pendingAmount || 0,

      },

    });

  })
);


// ============================================================
// GET /api/dashboard/charts?machineType=big|small
// ============================================================

router.get(
  '/charts',
  asyncHandler(async (req, res) => {

    const machineType =
      validMachine(
        req.query.machineType
      );


    // No mixed chart data.
    if (!machineType) {

      return res.status(400).json({
        success: false,
        message:
          'Valid machineType is required: big or small',
      });

    }


    const now =
      new Date();


    const windowStart =
      new Date(
        now.getFullYear(),
        now.getMonth() - 5,
        1
      );


    const monthKey = {
      y: {
        $year: '$date',
      },

      m: {
        $month: '$date',
      },
    };


    // ========================================================
    // MACHINE + DATE FILTERS
    // ========================================================

    const materialMatch = {
      date: {
        $gte:
          windowStart,
      },

      machineType,
    };


    const billMatch = {
      date: {
        $gte:
          windowStart,
      },

      machineType,
    };


    const statusMatch = {
      machineType,
    };


    // ========================================================
    // CHART DATA
    // ========================================================

    const [
      expenseAgg,
      workAgg,
      statusAgg,
    ] = await Promise.all([


      // --------------------------------------------------------
      // MATERIAL EXPENSE
      // --------------------------------------------------------

      Material.aggregate([

        {
          $match:
            materialMatch,
        },

        {
          $group: {

            _id:
              monthKey,

            amount: {
              $sum: {
                $ifNull: [
                  '$totalPrice',
                  0,
                ],
              },
            },

          },
        },

      ]),


      // --------------------------------------------------------
      // BOREWELL WORK
      // --------------------------------------------------------

      Bill.aggregate([

        {
          $match:
            billMatch,
        },

        {
          $group: {

            _id:
              monthKey,

            count: {
              $sum: 1,
            },

          },
        },

      ]),


      // --------------------------------------------------------
      // PAYMENT STATUS
      // --------------------------------------------------------

      Bill.aggregate([

        {
          $match:
            statusMatch,
        },

        {
          $group: {

            _id:
              '$paymentStatus',

            count: {
              $sum: 1,
            },

          },
        },

      ]),

    ]);


    // ========================================================
    // MAP DATA
    // ========================================================

    const keyOf = (
      year,
      month
    ) => {
      return `${year}-${month}`;
    };


    const expenseMap =
      new Map(
        expenseAgg.map(
          (expense) => [

            keyOf(
              expense._id.y,
              expense._id.m
            ),

            expense.amount,

          ]
        )
      );


    const workMap =
      new Map(
        workAgg.map(
          (work) => [

            keyOf(
              work._id.y,
              work._id.m
            ),

            work.count,

          ]
        )
      );


    // ========================================================
    // LAST 6 MONTHS
    // ========================================================

    const monthlyExpense = [];

    const borewellWork = [];


    for (
      let i = 5;
      i >= 0;
      i--
    ) {

      const date =
        new Date(
          now.getFullYear(),
          now.getMonth() - i,
          1
        );


      const key =
        keyOf(
          date.getFullYear(),
          date.getMonth() + 1
        );


      monthlyExpense.push({

        month:
          MONTHS[
            date.getMonth()
          ],

        amount:
          expenseMap.get(
            key
          ) || 0,

      });


      borewellWork.push({

        month:
          MONTHS[
            date.getMonth()
          ],

        count:
          workMap.get(
            key
          ) || 0,

      });

    }


    // ========================================================
    // PAYMENT STATUS
    // ========================================================

    const statusCounts =
      Object.fromEntries(
        statusAgg.map(
          (status) => [
            status._id,
            status.count,
          ]
        )
      );


    const paymentStatus = [
      'Paid',
      'Unpaid',
      'Partial',
    ].map(
      (status) => ({

        status,

        count:
          statusCounts[
            status
          ] || 0,

      })
    );


    // ========================================================
    // RESPONSE
    // ========================================================

    res.json({

      success: true,

      machineType,

      charts: {

        monthlyExpense,

        borewellWork,

        paymentStatus,

      },

    });

  })
);


export default router;