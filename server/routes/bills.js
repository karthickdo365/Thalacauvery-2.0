import express from 'express';

import Bill from '../models/Bill.js';

import {
  protect,
  requireWrite,
} from '../middleware/auth.js';

import asyncHandler from '../middleware/asyncHandler.js';

import logActivity from '../utils/activityLog.js';


const router = express.Router();


// ============================================================
// AUTH
// ============================================================

router.use(protect);


// ============================================================
// ACTIVITY LOG
// ============================================================

const log = (
  req,
  action,
  description
) =>
  logActivity(
    req,
    {
      action,
      module: 'invoices',
      description,
    }
  );


// ============================================================
// POPULATE
// ============================================================

const populateBroker = {
  path: 'brokerId',
  select: 'name phone email',
};


// ============================================================
// MACHINE VALIDATION
// ============================================================

const validMachine = (value) => {

  if (
    value === 'big' ||
    value === 'small'
  ) {
    return value;
  }

  return null;
};


// ============================================================
// GET ALL BILLS
//
// GET /api/borewell-points
//
// Query:
// ?search=
// ?page=
// ?limit=
// ?machineType=big
// ============================================================

router.get(
  '/',
  asyncHandler(
    async (req, res) => {

      const {
        search,
        page = 1,
        limit = 10,
        machineType,
      } = req.query;


      // --------------------------------------------------------
      // BUILD QUERY
      // --------------------------------------------------------

      const query = {};


      // --------------------------------------------------------
      // SEARCH PARTY NAME
      // --------------------------------------------------------

      if (search?.trim()) {

        query.partyName = {
          $regex:
            search.trim(),
          $options: 'i',
        };

      }


      // --------------------------------------------------------
      // MACHINE FILTER
      //
      // Exact match.
      //
      // BIG = only BIG
      // SMALL = only SMALL
      // --------------------------------------------------------

      const mt =
        validMachine(
          machineType
        );


      if (mt) {

        query.machineType =
          mt;

      }


      // --------------------------------------------------------
      // PAGINATION
      // --------------------------------------------------------

      const pageNumber =
        Math.max(
          Number(page) || 1,
          1
        );

      const limitNumber =
        Math.max(
          Number(limit) || 10,
          1
        );


      const skip =
        (pageNumber - 1) *
        limitNumber;


      // --------------------------------------------------------
      // DATABASE
      // --------------------------------------------------------

      const [
        total,
        bills,
      ] = await Promise.all([

        Bill.countDocuments(
          query
        ),

        Bill.find(query)
          .populate(
            populateBroker
          )
          .sort({
            date: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

      ]);


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      res.json({
        success: true,

        // Keep "points" because
        // your existing frontend
        // may already expect this.
        points: bills,

        // Also provide "bills"
        // for clarity.
        bills,

        total,
      });

    }
  )
);


// ============================================================
// GET SINGLE BILL
//
// GET /api/borewell-points/:id
// ============================================================

router.get(
  '/:id',
  asyncHandler(
    async (req, res) => {

      const bill =
        await Bill.findById(
          req.params.id
        )
          .populate(
            populateBroker
          )
          .lean();


      if (!bill) {

        return res.status(404).json({
          success: false,
          message: 'Bill not found',
        });

      }


      res.json({
        success: true,
        bill,
      });

    }
  )
);


// ============================================================
// CREATE BILL
//
// POST /api/borewell-points
// ============================================================

router.post(
  '/',
  requireWrite,
  asyncHandler(
    async (req, res) => {

      const {
        machineType,
      } = req.body;


      // --------------------------------------------------------
      // MACHINE MUST BE PROVIDED
      // --------------------------------------------------------

      const mt =
        validMachine(
          machineType
        );


      if (!mt) {

        return res.status(400).json({
          success: false,
          message:
            'Machine type must be big or small',
        });

      }


      // --------------------------------------------------------
      // CREATE
      // --------------------------------------------------------

      const body = {
        ...req.body,

        // Always use validated value.
        machineType: mt,

        createdBy:
          req.user.name ||
          req.user.username ||
          '',
      };


      const bill =
        await Bill.create(
          body
        );


      // --------------------------------------------------------
      // POPULATE
      // --------------------------------------------------------

      const populated =
        await bill.populate(
          populateBroker
        );


      // --------------------------------------------------------
      // LOG
      // --------------------------------------------------------

      log(
        req,
        'create',
        `Created ${mt} machine bill for ${
          bill.partyName ||
          'unnamed party'
        }`
      );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      res.status(201).json({
        success: true,
        bill: populated,
      });

    }
  )
);


// ============================================================
// UPDATE BILL
//
// PUT /api/borewell-points/:id
// ============================================================

router.put(
  '/:id',
  requireWrite,
  asyncHandler(
    async (req, res) => {

      // --------------------------------------------------------
      // FIND EXISTING BILL
      // --------------------------------------------------------

      const existing =
        await Bill.findById(
          req.params.id
        );


      if (!existing) {

        return res.status(404).json({
          success: false,
          message: 'Bill not found',
        });

      }


      // --------------------------------------------------------
      // MACHINE TYPE
      //
      // IMPORTANT:
      //
      // If frontend sends machineType,
      // validate it.
      //
      // If it doesn't send one,
      // keep the existing machine.
      // --------------------------------------------------------

      let machineType =
        existing.machineType;


      if (
        req.body.machineType !==
        undefined
      ) {

        const mt =
          validMachine(
            req.body.machineType
          );


        if (!mt) {

          return res.status(400).json({
            success: false,
            message:
              'Machine type must be big or small',
          });

        }


        // Don't allow changing
        // a bill from one machine
        // to another accidentally.
        if (
          mt !==
          existing.machineType
        ) {

          return res.status(400).json({
            success: false,
            message:
              'Machine type cannot be changed. Edit the bill from the correct machine section.',
          });

        }


        machineType =
          mt;

      }


      // --------------------------------------------------------
      // UPDATE DATA
      // --------------------------------------------------------

      const updateData = {
        ...req.body,

        // Preserve original machine.
        machineType,
      };


      const bill =
        await Bill.findByIdAndUpdate(
          req.params.id,
          updateData,
          {
            new: true,
            runValidators: true,
          }
        ).populate(
          populateBroker
        );


      if (!bill) {

        return res.status(404).json({
          success: false,
          message: 'Bill not found',
        });

      }


      // --------------------------------------------------------
      // LOG
      // --------------------------------------------------------

      log(
        req,
        'update',
        `Updated ${machineType} machine bill for ${
          bill.partyName ||
          'unnamed party'
        }`
      );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      res.json({
        success: true,
        bill,
      });

    }
  )
);


// ============================================================
// DELETE BILL
//
// DELETE /api/borewell-points/:id
// ============================================================

router.delete(
  '/:id',
  requireWrite,
  asyncHandler(
    async (req, res) => {

      // --------------------------------------------------------
      // FIND BILL
      // --------------------------------------------------------

      const bill =
        await Bill.findById(
          req.params.id
        );


      if (!bill) {

        return res.status(404).json({
          success: false,
          message: 'Bill not found',
        });

      }


      // --------------------------------------------------------
      // OPTIONAL MACHINE CHECK
      //
      // Frontend can send:
      // ?machineType=big
      //
      // This prevents deleting a Big
      // bill while standing inside
      // Small Machine.
      // --------------------------------------------------------

      if (
        req.query.machineType
      ) {

        const requestedMachine =
          validMachine(
            req.query.machineType
          );


        if (!requestedMachine) {

          return res.status(400).json({
            success: false,
            message:
              'Machine type must be big or small',
          });

        }


        if (
          requestedMachine !==
          bill.machineType
        ) {

          return res.status(400).json({
            success: false,
            message:
              'This bill belongs to another machine',
          });

        }

      }


      // --------------------------------------------------------
      // DELETE
      // --------------------------------------------------------

      await Bill.findByIdAndDelete(
        req.params.id
      );


      // --------------------------------------------------------
      // LOG
      // --------------------------------------------------------

      log(
        req,
        'delete',
        `Deleted ${bill.machineType} machine bill for ${
          bill.partyName ||
          'unnamed party'
        }`
      );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      res.json({
        success: true,
        message: 'Bill deleted',
      });

    }
  )
);


export default router;