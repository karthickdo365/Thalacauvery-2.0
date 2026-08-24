import express from 'express';
import BorewellPoint from '../models/BorewellPoint.js';
import PersonalUser from '../models/PersonalUser.js';
import {
  protect,
  requireWrite,
} from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import logActivity from '../utils/activityLog.js';

const router = express.Router();

router.use(protect);


// ============================================================
// ACTIVITY LOG
// ============================================================

const log = (
  req,
  action,
  description
) =>
  logActivity(req, {
    action,
    module: 'points',
    description,
  });


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
// GET /api/points
//
// Example:
//
// /api/points?machineType=big
//
// /api/points?machineType=small
//
// IMPORTANT:
// machineType is REQUIRED.
// Only exact machine records are returned.
// ============================================================

router.get(
  '/',
  asyncHandler(async (req, res) => {

    const {
      search,
      brokerId,
      page = 1,
      limit = 10,
      machineType,
    } = req.query;


    // --------------------------------------------------------
    // MACHINE TYPE IS REQUIRED
    // --------------------------------------------------------

    const mt =
      validMachine(machineType);


    if (!mt) {

      return res.status(400).json({
        success: false,
        message:
          'machineType is required and must be either "big" or "small"',
      });

    }


    // --------------------------------------------------------
    // BUILD QUERY
    // --------------------------------------------------------

    const query = {

      // IMPORTANT:
      // EXACT machine only.
      machineType: mt,

    };


    // --------------------------------------------------------
    // BROKER FILTER
    // --------------------------------------------------------

    if (brokerId) {

      query.brokerId =
        brokerId;

    }


    // --------------------------------------------------------
    // BROKER SEARCH
    // --------------------------------------------------------

    if (search) {

      const matchingBrokers =
        await PersonalUser.find({

          type: 'Broker',

          name: {
            $regex: search,
            $options: 'i',
          },

          // IMPORTANT:
          // Broker must belong to
          // the same machine.
          machineType: mt,

        })
          .select('_id')
          .lean();


      query.brokerId = {
        $in:
          matchingBrokers.map(
            (broker) =>
              broker._id
          ),
      };

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
      Math.min(
        Math.max(
          Number(limit) || 10,
          1
        ),
        100
      );


    const skip =
      (pageNumber - 1) *
      limitNumber;


    // --------------------------------------------------------
    // GET DATA
    // --------------------------------------------------------

    const [
      total,
      points,
    ] = await Promise.all([

      BorewellPoint.countDocuments(
        query
      ),

      BorewellPoint.find(
        query
      )
        .populate(
          'brokerId',
          'name phone email machineType'
        )
        .sort({
          date: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

    ]);


    res.json({

      success: true,

      points,

      total,

      page:
        pageNumber,

      limit:
        limitNumber,

      machineType:
        mt,

    });

  })
);


// ============================================================
// GET /api/points/:id
//
// machineType is REQUIRED.
//
// Example:
//
// /api/points/123?machineType=big
// ============================================================

router.get(
  '/:id',
  asyncHandler(async (req, res) => {

    const {
      machineType,
    } = req.query;


    const mt =
      validMachine(
        machineType
      );


    if (!mt) {

      return res.status(400).json({
        success: false,
        message:
          'machineType is required and must be either "big" or "small"',
      });

    }


    // --------------------------------------------------------
    // Find only inside selected machine
    // --------------------------------------------------------

    const point =
      await BorewellPoint.findOne({

        _id:
          req.params.id,

        machineType:
          mt,

      })
        .populate(
          'brokerId',
          'name phone email machineType'
        )
        .lean();


    if (!point) {

      return res.status(404).json({
        success: false,
        message:
          'Entry not found in this machine',
      });

    }


    res.json({
      success: true,
      point,
    });

  })
);


// ============================================================
// POST /api/points
//
// machineType MUST be supplied.
//
// Allowed:
//
// big
// small
//
// NOT allowed:
//
// both
// undefined
// random values
// ============================================================

router.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {

    const {
      machineType,
      brokerId,
    } = req.body;


    const mt =
      validMachine(
        machineType
      );


    // --------------------------------------------------------
    // Validate machine
    // --------------------------------------------------------

    if (!mt) {

      return res.status(400).json({
        success: false,
        message:
          'machineType is required and must be either "big" or "small"',
      });

    }


    // --------------------------------------------------------
    // Validate broker
    //
    // Broker must belong to the
    // same machine.
    // --------------------------------------------------------

    if (brokerId) {

      const broker =
        await PersonalUser.findOne({

          _id:
            brokerId,

          type:
            'Broker',

          machineType:
            mt,

        })
          .select(
            '_id name machineType'
          )
          .lean();


      if (!broker) {

        return res.status(400).json({
          success: false,
          message:
            'Selected broker does not belong to this machine',
        });

      }

    }


    // --------------------------------------------------------
    // Create
    // --------------------------------------------------------

    const body = {

      ...req.body,

      // Always use validated machine
      machineType:
        mt,

      createdBy:
        req.user.name,

    };


    const point =
      await BorewellPoint.create(
        body
      );


    log(
      req,
      'create',
      `Created ${mt} machine agent rate card`
    );


    res.status(201).json({
      success: true,
      point,
    });

  })
);


// ============================================================
// PUT /api/points/:id
//
// Update only within the selected machine.
// ============================================================

router.put(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {

    const {
      machineType,
      brokerId,
    } = req.body;


    const mt =
      validMachine(
        machineType
      );


    // --------------------------------------------------------
    // Machine is required on update
    // --------------------------------------------------------

    if (!mt) {

      return res.status(400).json({
        success: false,
        message:
          'machineType is required and must be either "big" or "small"',
      });

    }


    // --------------------------------------------------------
    // Find existing record ONLY in
    // selected machine.
    // --------------------------------------------------------

    const existing =
      await BorewellPoint.findOne({

        _id:
          req.params.id,

        machineType:
          mt,

      });


    if (!existing) {

      return res.status(404).json({
        success: false,
        message:
          'Entry not found in this machine',
      });

    }


    // --------------------------------------------------------
    // Validate broker
    // --------------------------------------------------------

    if (brokerId) {

      const broker =
        await PersonalUser.findOne({

          _id:
            brokerId,

          type:
            'Broker',

          machineType:
            mt,

        })
          .select(
            '_id name machineType'
          )
          .lean();


      if (!broker) {

        return res.status(400).json({
          success: false,
          message:
            'Selected broker does not belong to this machine',
        });

      }

    }


    // --------------------------------------------------------
    // Update
    // --------------------------------------------------------

    const updateData = {

      ...req.body,

      // Prevent changing to invalid machine
      machineType:
        mt,

    };


    const point =
      await BorewellPoint.findOneAndUpdate(

        {
          _id:
            req.params.id,

          machineType:
            mt,
        },

        updateData,

        {
          new: true,
          runValidators: true,
        }

      )
        .populate(
          'brokerId',
          'name phone email machineType'
        );


    if (!point) {

      return res.status(404).json({
        success: false,
        message:
          'Entry not found in this machine',
      });

    }


    log(
      req,
      'update',
      `Updated ${mt} machine agent rate card`
    );


    res.json({
      success: true,
      point,
    });

  })
);


// ============================================================
// DELETE /api/points/:id
//
// Only delete from the selected machine.
// ============================================================

router.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {

    const {
      machineType,
    } = req.query;


    const mt =
      validMachine(
        machineType
      );


    if (!mt) {

      return res.status(400).json({
        success: false,
        message:
          'machineType is required and must be either "big" or "small"',
      });

    }


    const point =
      await BorewellPoint.findOneAndDelete({

        _id:
          req.params.id,

        machineType:
          mt,

      });


    if (!point) {

      return res.status(404).json({
        success: false,
        message:
          'Entry not found in this machine',
      });

    }


    log(
      req,
      'delete',
      `Deleted ${mt} machine agent rate card`
    );


    res.json({
      success: true,
      message:
        'Deleted successfully',
    });

  })
);


export default router;