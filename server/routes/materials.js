import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import Material from '../models/Material.js';
import { protect, requireWrite } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import logActivity from '../utils/activityLog.js';


// ============================================================
// PATHS
// ============================================================

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

const UPLOAD_DIR = path.join(
  __dirname,
  '../uploads/materials'
);

fs.mkdirSync(
  UPLOAD_DIR,
  { recursive: true }
);


// ============================================================
// MULTER
// ============================================================

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {

    const safeName =
      file.originalname.replace(
        /[^\w.\-]/g,
        '_'
      );

    cb(
      null,
      `${Date.now()}-${safeName}`
    );

  },

});


const upload = multer({

  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {

    const allowed =
      /^image\//.test(file.mimetype) ||
      file.mimetype === 'application/pdf';

    if (!allowed) {

      return cb(
        new Error(
          'Only images and PDF bills are allowed'
        )
      );

    }

    cb(null, true);

  },

});


// ============================================================
// ROUTER
// ============================================================

const router = express.Router();

router.use(protect);


// ============================================================
// HELPERS
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
      module: 'materials',
      description,
    }
  );


const isValidMachine = (
  machineType
) =>
  machineType === 'big' ||
  machineType === 'small';


const getMachine = (
  machineType
) => {

  if (!isValidMachine(machineType)) {
    return null;
  }

  return machineType;

};


// ============================================================
// GET /api/materials
//
// IMPORTANT:
// machineType is REQUIRED.
//
// Example:
// /api/materials?machineType=small
// /api/materials?machineType=big
// ============================================================

router.get(
  '/',
  asyncHandler(
    async (req, res) => {

      const {
        search,
        startDate,
        endDate,
        page = 1,
        limit = 10,
        machineType,
      } = req.query;


      // --------------------------------------------------------
      // MACHINE VALIDATION
      // --------------------------------------------------------

      const machine =
        getMachine(machineType);


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

        // THIS IS THE IMPORTANT PART
        machineType: machine,

      };


      // --------------------------------------------------------
      // SEARCH
      // --------------------------------------------------------

      if (search) {

        query.$or = [

          {
            type: {
              $regex: search,
              $options: 'i',
            },
          },

          {
            description: {
              $regex: search,
              $options: 'i',
            },
          },

        ];

      }


      // --------------------------------------------------------
      // DATE FILTER
      // --------------------------------------------------------

      if (
        startDate ||
        endDate
      ) {

        query.date = {};


        if (startDate) {

          query.date.$gte =
            new Date(startDate);

        }


        if (endDate) {

          query.date.$lte =
            new Date(endDate);

        }

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
      // DATABASE
      // --------------------------------------------------------

      const [
        total,
        materials,
      ] = await Promise.all([

        Material.countDocuments(
          query
        ),

        Material.find(query)
          .sort({
            date: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(pageLimit)
          .lean(),

      ]);


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      res.json({

        success: true,

        materials,

        total,

      });

    }
  )
);


// ============================================================
// GET /api/materials/:id
// ============================================================

router.get(
  '/:id',
  asyncHandler(
    async (req, res) => {

      const {
        machineType,
      } = req.query;


      const machine =
        getMachine(machineType);


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'machineType must be either big or small',

        });

      }


      const material =
        await Material.findOne({

          _id: req.params.id,

          machineType: machine,

        }).lean();


      if (!material) {

        return res.status(404).json({

          success: false,

          message:
            'Material not found for this machine',

        });

      }


      res.json({

        success: true,

        material,

      });

    }
  )
);


// ============================================================
// POST /api/materials
// ============================================================

router.post(
  '/',
  requireWrite,
  upload.single('billFile'),

  asyncHandler(
    async (req, res) => {

      const {
        machineType,
      } = req.body;


      // --------------------------------------------------------
      // MACHINE VALIDATION
      // --------------------------------------------------------

      const machine =
        getMachine(machineType);


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'Valid machineType is required: big or small',

        });

      }


      // --------------------------------------------------------
      // TYPE VALIDATION
      // --------------------------------------------------------

      const allowedTypes = [
        'Diesel',
        'Petrol',
        'Pipe',
        'Bit',
        'Hammer',
        'Others',
      ];


      if (
        !allowedTypes.includes(
          req.body.type
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            'Invalid material type',

        });

      }


      // --------------------------------------------------------
      // CREATE DATA
      // --------------------------------------------------------

      const data = {

        ...req.body,

        machineType: machine,

        createdBy:
          req.user.name,

      };


      // --------------------------------------------------------
      // BILL FILE
      // --------------------------------------------------------

      if (req.file) {

        data.billFile =
          `/uploads/materials/${req.file.filename}`;

      }


      // --------------------------------------------------------
      // CREATE
      // --------------------------------------------------------

      const material =
        await Material.create(
          data
        );


      // --------------------------------------------------------
      // LOG
      // --------------------------------------------------------

      log(
        req,
        'create',
        `Added ${machine} machine material: ${material.type} (₹${material.totalPrice})`
      );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      res.status(201).json({

        success: true,

        material,

      });

    }
  )
);


// ============================================================
// PUT /api/materials/:id
// ============================================================

router.put(
  '/:id',
  requireWrite,
  upload.single('billFile'),

  asyncHandler(
    async (req, res) => {

      const {
        machineType,
      } = req.body;


      // --------------------------------------------------------
      // MACHINE VALIDATION
      // --------------------------------------------------------

      const machine =
        getMachine(machineType);


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'Valid machineType is required: big or small',

        });

      }


      // --------------------------------------------------------
      // FIND ONLY INSIDE CURRENT MACHINE
      // --------------------------------------------------------

      const material =
        await Material.findOne({

          _id: req.params.id,

          machineType: machine,

        });


      if (!material) {

        return res.status(404).json({

          success: false,

          message:
            'Material not found for this machine',

        });

      }


      // --------------------------------------------------------
      // TYPE VALIDATION
      // --------------------------------------------------------

      const allowedTypes = [
        'Diesel',
        'Petrol',
        'Pipe',
        'Bit',
        'Hammer',
        'Others',
      ];


      if (
        req.body.type &&
        !allowedTypes.includes(
          req.body.type
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            'Invalid material type',

        });

      }


      // --------------------------------------------------------
      // UPDATE
      // --------------------------------------------------------

      Object.assign(
        material,
        req.body
      );


      // NEVER allow machine to change
      // through accidental form data.

      material.machineType =
        machine;


      // --------------------------------------------------------
      // BILL
      // --------------------------------------------------------

      if (req.file) {

        material.billFile =
          `/uploads/materials/${req.file.filename}`;

      }


      // --------------------------------------------------------
      // SAVE
      //
      // Material model pre-save hook
      // recalculates totalPrice.
      // --------------------------------------------------------

      await material.save();


      // --------------------------------------------------------
      // LOG
      // --------------------------------------------------------

      log(
        req,
        'update',
        `Updated ${machine} machine material: ${material.type}`
      );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      res.json({

        success: true,

        material,

      });

    }
  )
);


// ============================================================
// DELETE /api/materials/:id
// ============================================================

router.delete(
  '/:id',
  requireWrite,

  asyncHandler(
    async (req, res) => {

      const {
        machineType,
      } = req.query;


      // --------------------------------------------------------
      // MACHINE VALIDATION
      // --------------------------------------------------------

      const machine =
        getMachine(machineType);


      if (!machine) {

        return res.status(400).json({

          success: false,

          message:
            'machineType must be either big or small',

        });

      }


      // --------------------------------------------------------
      // DELETE ONLY FROM CURRENT MACHINE
      // --------------------------------------------------------

      const material =
        await Material.findOneAndDelete({

          _id: req.params.id,

          machineType: machine,

        });


      if (!material) {

        return res.status(404).json({

          success: false,

          message:
            'Material not found for this machine',

        });

      }


      // --------------------------------------------------------
      // LOG
      // --------------------------------------------------------

      log(
        req,
        'delete',
        `Deleted ${machine} machine material: ${material.type}`
      );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      res.json({

        success: true,

        message:
          'Deleted successfully',

      });

    }
  )
);


export default router;