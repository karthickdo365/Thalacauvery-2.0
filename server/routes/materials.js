// ============================================================
// MATERIAL ROUTES
// Complete updated backend
// ============================================================

import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import Material from '../models/Material.js';
import {
  protect,
  requireWrite,
} from '../middleware/auth.js';

import asyncHandler from '../middleware/asyncHandler.js';
import logActivity from '../utils/activityLog.js';


// ============================================================
// PATHS
// ============================================================

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);


// Material bills are stored here
const UPLOAD_DIR =
  path.join(
    __dirname,
    '../uploads/materials'
  );


// Make sure folder exists
fs.mkdirSync(
  UPLOAD_DIR,
  {
    recursive: true,
  }
);


// ============================================================
// MULTER STORAGE
// ============================================================

const storage =
  multer.diskStorage({

    destination: (
      req,
      file,
      cb
    ) => {

      cb(
        null,
        UPLOAD_DIR
      );

    },


    filename: (
      req,
      file,
      cb
    ) => {

      // Clean original filename
      const safeName =
        file.originalname.replace(
          /[^\w.\-]/g,
          '_'
        );


      const filename =
        `${Date.now()}-${safeName}`;


      cb(
        null,
        filename
      );

    },

  });


// ============================================================
// MULTER UPLOAD
// ============================================================

const upload =
  multer({

    storage,

    limits: {
      fileSize:
        10 * 1024 * 1024,
    },


    fileFilter: (
      req,
      file,
      cb
    ) => {

      const allowed =
        /^image\//.test(
          file.mimetype
        ) ||
        file.mimetype ===
          'application/pdf';


      if (!allowed) {

        return cb(
          new Error(
            'Only images and PDF bills are allowed'
          )
        );

      }


      cb(
        null,
        true
      );

    },

  });


// ============================================================
// ROUTER
// ============================================================

const router =
  express.Router();


// All material routes require login
router.use(protect);


// ============================================================
// HELPERS
// ============================================================

const log = (
  req,
  action,
  description
) => {

  return logActivity(
    req,
    {
      action,
      module: 'materials',
      description,
    }
  );

};


// ============================================================
// MACHINE VALIDATION
// ============================================================

const isValidMachine = (
  machineType
) => {

  return (
    machineType === 'big' ||
    machineType === 'small'
  );

};


const getMachine = (
  machineType
) => {

  if (
    !isValidMachine(
      machineType
    )
  ) {

    return null;

  }


  return machineType;

};


// ============================================================
// MATERIAL TYPES
// ============================================================

const ALLOWED_TYPES = [
  'Diesel',
  'Petrol',
  'Pipe',
  'Bit',
  'Hammer',
  'Others',
];


// ============================================================
// GET /api/materials
//
// Example:
//
// /api/materials?machineType=big
//
// /api/materials?machineType=small
// ============================================================

router.get(
  '/',
  asyncHandler(
    async (
      req,
      res
    ) => {

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
        getMachine(
          machineType
        );


      if (!machine) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              'machineType must be either big or small',

          });

      }


      // --------------------------------------------------------
      // QUERY
      // --------------------------------------------------------

      const query = {

        machineType:
          machine,

      };


      // --------------------------------------------------------
      // SEARCH
      // --------------------------------------------------------

      if (search) {

        query.$or = [

          {
            type: {
              $regex:
                search,
              $options:
                'i',
            },
          },

          {
            description: {
              $regex:
                search,
              $options:
                'i',
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
            new Date(
              startDate
            );

        }


        if (endDate) {

          query.date.$lte =
            new Date(
              endDate
            );

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
        (
          pageNumber - 1
        ) *
        pageLimit;


      // --------------------------------------------------------
      // DATABASE
      // --------------------------------------------------------

      const [
        total,
        materials,
      ] =
        await Promise.all([

          Material.countDocuments(
            query
          ),

          Material.find(
            query
          )
            .sort({
              date: -1,
              createdAt: -1,
            })
            .skip(
              skip
            )
            .limit(
              pageLimit
            )
            .lean(),

        ]);


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({

        success: true,

        materials,

        total,

      });

    }
  )
);


// ============================================================
// VIEW BILL
//
// GET /api/materials/bill/:filename
//
// This endpoint is protected by the router.use(protect)
// above.
//
// Frontend can use Axios with authentication and then
// open the returned Blob.
//
// IMPORTANT:
// This route MUST be BEFORE /:id.
// ============================================================

router.get(
  '/bill/:filename',
  asyncHandler(
    async (
      req,
      res
    ) => {

      const requestedFilename =
        req.params.filename || '';


      // --------------------------------------------------------
      // SECURITY
      // Prevent path traversal:
      //
      // ../../something
      // --------------------------------------------------------

      const filename =
        path.basename(
          requestedFilename
        );


      if (
        !filename ||
        filename !==
          requestedFilename
      ) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              'Invalid bill filename',

          });

      }


      // --------------------------------------------------------
      // BUILD FILE PATH
      // --------------------------------------------------------

      const filePath =
        path.join(
          UPLOAD_DIR,
          filename
        );


      // --------------------------------------------------------
      // EXTRA SECURITY CHECK
      // --------------------------------------------------------

      const resolvedUploadDir =
        path.resolve(
          UPLOAD_DIR
        );


      const resolvedFilePath =
        path.resolve(
          filePath
        );


      if (
        !resolvedFilePath.startsWith(
          resolvedUploadDir +
            path.sep
        )
      ) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              'Invalid file path',

          });

      }


      // --------------------------------------------------------
      // CHECK FILE EXISTS
      // --------------------------------------------------------

      if (
        !fs.existsSync(
          resolvedFilePath
        )
      ) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              'Bill file not found',

          });

      }


      // --------------------------------------------------------
      // CHECK IT IS ACTUALLY A FILE
      // --------------------------------------------------------

      const stats =
        fs.statSync(
          resolvedFilePath
        );


      if (
        !stats.isFile()
      ) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              'Bill file not found',

          });

      }


      // --------------------------------------------------------
      // DETERMINE CONTENT TYPE
      // --------------------------------------------------------

      const extension =
        path.extname(
          filename
        )
          .toLowerCase();


      let contentType =
        'application/octet-stream';


      if (
        extension === '.jpg' ||
        extension === '.jpeg'
      ) {

        contentType =
          'image/jpeg';

      }
      else if (
        extension === '.png'
      ) {

        contentType =
          'image/png';

      }
      else if (
        extension === '.gif'
      ) {

        contentType =
          'image/gif';

      }
      else if (
        extension === '.webp'
      ) {

        contentType =
          'image/webp';

      }
      else if (
        extension === '.pdf'
      ) {

        contentType =
          'application/pdf';

      }


      // --------------------------------------------------------
      // RESPONSE HEADERS
      // --------------------------------------------------------

      res.setHeader(
        'Content-Type',
        contentType
      );


      res.setHeader(
        'Content-Length',
        stats.size
      );


      // Browser should display the file
      // instead of downloading it.
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${filename}"`
      );


      // Prevent caching stale bills
      res.setHeader(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate'
      );


      // --------------------------------------------------------
      // SEND FILE
      // --------------------------------------------------------

      return res.sendFile(
        resolvedFilePath
      );

    }
  )
);


// ============================================================
// GET SINGLE MATERIAL
//
// GET /api/materials/:id?machineType=big
// ============================================================

router.get(
  '/:id',
  asyncHandler(
    async (
      req,
      res
    ) => {

      const {
        machineType,
      } = req.query;


      // --------------------------------------------------------
      // MACHINE VALIDATION
      // --------------------------------------------------------

      const machine =
        getMachine(
          machineType
        );


      if (!machine) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              'machineType must be either big or small',

          });

      }


      // --------------------------------------------------------
      // FIND MATERIAL
      // --------------------------------------------------------

      const material =
        await Material.findOne({

          _id:
            req.params.id,

          machineType:
            machine,

        }).lean();


      // --------------------------------------------------------
      // NOT FOUND
      // --------------------------------------------------------

      if (!material) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              'Material not found for this machine',

          });

      }


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({

        success: true,

        material,

      });

    }
  )
);


// ============================================================
// POST /api/materials
// CREATE MATERIAL
// ============================================================

router.post(
  '/',
  requireWrite,
  upload.single(
    'billFile'
  ),

  asyncHandler(
    async (
      req,
      res
    ) => {

      const {
        machineType,
      } = req.body;


      // --------------------------------------------------------
      // MACHINE VALIDATION
      // --------------------------------------------------------

      const machine =
        getMachine(
          machineType
        );


      if (!machine) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              'Valid machineType is required: big or small',

          });

      }


      // --------------------------------------------------------
      // TYPE VALIDATION
      // --------------------------------------------------------

      if (
        !ALLOWED_TYPES.includes(
          req.body.type
        )
      ) {

        return res
          .status(400)
          .json({

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

        machineType:
          machine,

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
      // ACTIVITY LOG
      // --------------------------------------------------------

      log(
        req,
        'create',
        `Added ${machine} machine material: ${material.type} (₹${material.totalPrice})`
      );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res
        .status(201)
        .json({

          success: true,

          material,

        });

    }
  )
);


// ============================================================
// PUT /api/materials/:id
// UPDATE MATERIAL
// ============================================================

router.put(
  '/:id',
  requireWrite,
  upload.single(
    'billFile'
  ),

  asyncHandler(
    async (
      req,
      res
    ) => {

      const {
        machineType,
      } = req.body;


      // --------------------------------------------------------
      // MACHINE VALIDATION
      // --------------------------------------------------------

      const machine =
        getMachine(
          machineType
        );


      if (!machine) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              'Valid machineType is required: big or small',

          });

      }


      // --------------------------------------------------------
      // FIND MATERIAL
      // --------------------------------------------------------

      const material =
        await Material.findOne({

          _id:
            req.params.id,

          machineType:
            machine,

        });


      if (!material) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              'Material not found for this machine',

          });

      }


      // --------------------------------------------------------
      // TYPE VALIDATION
      // --------------------------------------------------------

      if (
        req.body.type &&
        !ALLOWED_TYPES.includes(
          req.body.type
        )
      ) {

        return res
          .status(400)
          .json({

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


      // Never allow machine type
      // to change accidentally.
      material.machineType =
        machine;


      // --------------------------------------------------------
      // NEW BILL
      // --------------------------------------------------------

      if (req.file) {

        // Delete previous bill if it exists
        if (
          material.billFile
        ) {

          const oldFilename =
            path.basename(
              material.billFile
            );


          const oldFilePath =
            path.join(
              UPLOAD_DIR,
              oldFilename
            );


          if (
            fs.existsSync(
              oldFilePath
            )
          ) {

            try {

              fs.unlinkSync(
                oldFilePath
              );

            }
            catch (
              deleteError
            ) {

              console.error(
                'Could not delete old bill:',
                deleteError
              );

            }

          }

        }


        material.billFile =
          `/uploads/materials/${req.file.filename}`;

      }


      // --------------------------------------------------------
      // SAVE
      //
      // Your Material model pre-save hook can
      // recalculate totalPrice.
      // --------------------------------------------------------

      await material.save();


      // --------------------------------------------------------
      // ACTIVITY LOG
      // --------------------------------------------------------

      log(
        req,
        'update',
        `Updated ${machine} machine material: ${material.type}`
      );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({

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
    async (
      req,
      res
    ) => {

      const {
        machineType,
      } = req.query;


      // --------------------------------------------------------
      // MACHINE VALIDATION
      // --------------------------------------------------------

      const machine =
        getMachine(
          machineType
        );


      if (!machine) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              'machineType must be either big or small',

          });

      }


      // --------------------------------------------------------
      // FIND AND DELETE
      // --------------------------------------------------------

      const material =
        await Material.findOneAndDelete({

          _id:
            req.params.id,

          machineType:
            machine,

        });


      if (!material) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              'Material not found for this machine',

          });

      }


      // --------------------------------------------------------
      // DELETE BILL FILE
      // --------------------------------------------------------

      if (
        material.billFile
      ) {

        const filename =
          path.basename(
            material.billFile
          );


        const filePath =
          path.join(
            UPLOAD_DIR,
            filename
          );


        if (
          fs.existsSync(
            filePath
          )
        ) {

          try {

            fs.unlinkSync(
              filePath
            );

          }
          catch (
            fileError
          ) {

            console.error(
              'Could not delete bill file:',
              fileError
            );

          }

        }

      }


      // --------------------------------------------------------
      // ACTIVITY LOG
      // --------------------------------------------------------

      log(
        req,
        'delete',
        `Deleted ${machine} machine material: ${material.type}`
      );


      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({

        success: true,

        message:
          'Deleted successfully',

      });

    }
  )
);


// ============================================================
// EXPORT
// ============================================================

export default router;