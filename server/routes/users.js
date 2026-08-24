import express from 'express';
import PersonalUser from '../models/PersonalUser.js';
import {
  protect,
  requireWrite,
  WRITE_ROLES,
} from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import logActivity from '../utils/activityLog.js';

const router = express.Router();

router.use(protect);


// ============================================================
// HELPERS
// ============================================================

const validMachine = (value) => {
  return value === 'big' || value === 'small'
    ? value
    : null;
};


const log = (
  req,
  action,
  description
) =>
  logActivity(
    req,
    {
      action,
      module: 'users',
      description,
    }
  );


// ============================================================
// GET /api/users
//
// ONLY returns users belonging to selected machine.
//
// /api/users?machineType=big
// /api/users?machineType=small
// ============================================================

router.get(
  '/',
  asyncHandler(
    async (req, res) => {

      const {
        type,
        search,
        page = 1,
        limit = 10,
        machineType,
      } = req.query;


      const machine =
        validMachine(machineType);


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'machineType must be either big or small',

        });

      }


      // --------------------------------------------------------
      // QUERY
      // --------------------------------------------------------

      const query = {

        // EXACT MACHINE ONLY
        machineType: machine,

      };


      if (type) {

        query.type = type;

      }


      // --------------------------------------------------------
      // SEARCH
      // --------------------------------------------------------

      if (search) {

        query.$or = [

          {
            name: {
              $regex: search,
              $options: 'i',
            },
          },

          {
            phone: {
              $regex: search,
              $options: 'i',
            },
          },

          {
            email: {
              $regex: search,
              $options: 'i',
            },
          },

        ];

      }


      // --------------------------------------------------------
      // PAGINATION
      // --------------------------------------------------------

      const pageNumber =
        Math.max(
          Number(page) || 1,
          1
        );


      const pageLimit =
        Math.min(
          Math.max(
            Number(limit) || 10,
            1
          ),
          100
        );


      const skip =
        (pageNumber - 1) *
        pageLimit;


      // --------------------------------------------------------
      // HIDE CREDENTIALS FOR VIEWERS
      // --------------------------------------------------------

      const projection =
        WRITE_ROLES.includes(
          req.user.role
        )
          ? ''
          : '-password -username';


      // --------------------------------------------------------
      // DATABASE
      // --------------------------------------------------------

      const [
        total,
        users,
      ] = await Promise.all([

        PersonalUser.countDocuments(
          query
        ),

        PersonalUser.find(query)
          .select(projection)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(pageLimit)
          .lean(),

      ]);


      res.json({

        success: true,

        users,

        total,

      });

    }
  )
);


// ============================================================
// GET /api/users/brokers
//
// Brokers are also machine-specific.
// ============================================================

router.get(
  '/brokers',
  asyncHandler(
    async (req, res) => {

      const {
        machineType,
      } = req.query;


      const machine =
        validMachine(machineType);


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'machineType must be either big or small',

        });

      }


      const brokers =
        await PersonalUser.find({

          type: 'Broker',

          machineType: machine,

        })
          .select(
            '_id name phone email machineType'
          )
          .sort({
            name: 1,
          })
          .lean();


      res.json(
        brokers
      );

    }
  )
);


// ============================================================
// GET /api/users/:id
// ============================================================

router.get(
  '/:id',
  asyncHandler(
    async (req, res) => {

      const {
        machineType,
      } = req.query;


      const machine =
        validMachine(machineType);


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'machineType must be either big or small',

        });

      }


      const user =
        await PersonalUser.findOne({

          _id: req.params.id,

          machineType: machine,

        })
          .select(
            WRITE_ROLES.includes(
              req.user.role
            )
              ? ''
              : '-password -username'
          )
          .lean();


      if (!user) {

        return res.status(404).json({

          success: false,

          message:
            'User not found for this machine',

        });

      }


      res.json({

        success: true,

        user,

      });

    }
  )
);


// ============================================================
// POST /api/users
//
// machineType comes from frontend MachineContext.
// ============================================================

router.post(
  '/',
  requireWrite,

  asyncHandler(
    async (req, res) => {

      const machine =
        validMachine(
          req.body.machineType
        );


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'Valid machineType is required: big or small',

        });

      }


      const data = {

        ...req.body,

        machineType: machine,

      };


      const user =
        await PersonalUser.create(
          data
        );


      log(
        req,
        'create',
        `Created ${machine} machine ${user.type}: ${user.name}`
      );


      res.status(201).json({

        success: true,

        user,

      });

    }
  )
);


// ============================================================
// PUT /api/users/:id
//
// Can ONLY update a user inside current machine.
// ============================================================

router.put(
  '/:id',
  requireWrite,

  asyncHandler(
    async (req, res) => {

      const machine =
        validMachine(
          req.body.machineType
        );


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'Valid machineType is required: big or small',

        });

      }


      const user =
        await PersonalUser.findOne({

          _id: req.params.id,

          machineType: machine,

        });


      if (!user) {

        return res.status(404).json({

          success: false,

          message:
            'User not found for this machine',

        });

      }


      Object.assign(
        user,
        req.body
      );


      // Never allow accidental machine change.
      user.machineType =
        machine;


      await user.save();


      log(
        req,
        'update',
        `Updated ${machine} machine ${user.type}: ${user.name}`
      );


      res.json({

        success: true,

        user,

      });

    }
  )
);


// ============================================================
// DELETE /api/users/:id
//
// Can ONLY delete from current machine.
// ============================================================

router.delete(
  '/:id',
  requireWrite,

  asyncHandler(
    async (req, res) => {

      const {
        machineType,
      } = req.query;


      const machine =
        validMachine(machineType);


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'machineType must be either big or small',

        });

      }


      const user =
        await PersonalUser.findOneAndDelete({

          _id: req.params.id,

          machineType: machine,

        });


      if (!user) {

        return res.status(404).json({

          success: false,

          message:
            'User not found for this machine',

        });

      }


      log(
        req,
        'delete',
        `Deleted ${machine} machine ${user.type}: ${user.name}`
      );


      res.json({

        success: true,

        message:
          'Deleted successfully',

      });

    }
  )
);


export default router;