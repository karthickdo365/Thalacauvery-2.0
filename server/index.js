import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

import createAdmin from './utils/createAdmin.js';
import connectDB from './config/db.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import materialRoutes from './routes/materials.js';
import pointRoutes from './routes/points.js';
import billRoutes from './routes/bills.js';
import reportRoutes from './routes/reports.js';
import dashboardRoutes from './routes/dashboard.js';
import activityLogRoutes from './routes/activityLogs.js';
import attendanceRoutes from './routes/attendance.js';
import salaryAdvanceRoutes from './routes/salaryAdvances.js';

dotenv.config();

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

const app = express();

const isProd =
  process.env.NODE_ENV === 'production';

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

// ============================================================
// CORS
// ============================================================

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ============================================================
// BODY PARSERS
// ============================================================

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ============================================================
// LOGGER
// ============================================================

if (!isProd) {
  app.use(morgan('dev'));
}

// ============================================================
// STATIC UPLOADS
// ============================================================

app.use(
  '/uploads',
  express.static(
    path.join(__dirname, 'uploads')
  )
);

// ============================================================
// API ROUTES
// ============================================================

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/users',
  userRoutes
);

app.use(
  '/api/materials',
  materialRoutes
);

app.use(
  '/api/points',
  pointRoutes
);

app.use(
  '/api/borewell-points',
  billRoutes
);

app.use(
  '/api/reports',
  reportRoutes
);

app.use(
  '/api/dashboard',
  dashboardRoutes
);

app.use(
  '/api/activity-logs',
  activityLogRoutes
);

app.use(
  '/api/attendance',
  attendanceRoutes
);

app.use(
  '/api/salary-advances',
  salaryAdvanceRoutes
);

// ============================================================
// DATABASE STATUS
// ============================================================

let databaseReady = false;

// ============================================================
// ROOT ROUTE
// ============================================================

app.get(
  '/',
  (req, res) => {
    res.status(200).json({
      success: true,
      message:
        'Thalacauvery Borewell API is running',
    });
  }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  '/api/health',
  (req, res) => {
    res.status(200).json({
      success: true,
      status: 'ok',
      database: databaseReady
        ? 'connected'
        : 'connecting',
      time: new Date().toISOString(),
    });
  }
);

// ============================================================
// UNKNOWN API ROUTES
// ============================================================

app.use(
  '/api',
  (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Endpoint not found',
    });
  }
);

// ============================================================
// SERVE REACT FRONTEND IN PRODUCTION
// ============================================================

if (isProd) {
  const publicPath = path.join(
    __dirname,
    'public'
  );

  app.use(
    express.static(publicPath)
  );

  // Express 5 wildcard syntax
  app.get(
    '/{*splat}',
    (req, res) => {
      res.sendFile(
        path.join(
          publicPath,
          'index.html'
        )
      );
    }
  );
}

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (err, req, res, next) => {
    // --------------------------------------------------------
    // Multer / upload errors
    // --------------------------------------------------------

    if (
      err instanceof multer.MulterError ||
      err.message?.includes(
        'Only images and PDF'
      )
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // --------------------------------------------------------
    // Mongoose validation errors
    // --------------------------------------------------------

    if (
      err.name === 'ValidationError'
    ) {
      const message =
        Object.values(err.errors)
          .map(
            (e) => e.message
          )
          .join(', ');

      return res.status(400).json({
        success: false,
        message,
      });
    }

    // --------------------------------------------------------
    // Invalid MongoDB ObjectId
    // --------------------------------------------------------

    if (
      err.name === 'CastError'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid id format',
      });
    }

    // --------------------------------------------------------
    // Duplicate MongoDB record
    // --------------------------------------------------------

    if (
      err.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          'Duplicate record',
      });
    }

    // --------------------------------------------------------
    // General server error
    // --------------------------------------------------------

    console.error(
      '❌ Server Error:',
      err.stack ||
        err.message ||
        err
    );

    return res.status(500).json({
      success: false,
      message: isProd
        ? 'Server error'
        : err.message,
    });
  }
);

// ============================================================
// PORT
// ============================================================

const PORT =
  process.env.PORT || 5000;

// ============================================================
// START HTTP SERVER
// ============================================================
//
// IMPORTANT:
// Start the HTTP server first so Render can detect
// the assigned PORT immediately.
//
// MongoDB initialization happens separately below.
// This prevents Render from waiting for MongoDB before
// detecting an open port.
// ============================================================

const server = app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `🚀 Server running on port ${PORT}`
    );

    console.log(
      '❤️ Health endpoint: /api/health'
    );
  }
);

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

const initializeDatabase =
  async () => {
    try {
      // ------------------------------------------------------
      // Check MongoDB environment variable
      // ------------------------------------------------------

      if (
        !process.env.MONGODB_URI
      ) {
        throw new Error(
          'MONGODB_URI is missing from environment variables'
        );
      }

      console.log(
        '🔄 Connecting to MongoDB...'
      );

      // ------------------------------------------------------
      // Connect MongoDB
      // ------------------------------------------------------

      await connectDB();

      databaseReady = true;

      console.log(
        '✅ MongoDB connection successful'
      );

      // ------------------------------------------------------
      // Create / Check Admin
      // ------------------------------------------------------

      try {
        await createAdmin();

        console.log(
          '✅ Admin account ready'
        );
      } catch (
        adminError
      ) {
        console.error(
          '⚠️ Admin initialization failed:',
          adminError.message
        );

        // Do not stop the server if only
        // admin creation/check fails.
      }
    } catch (
      error
    ) {
      databaseReady = false;

      console.error(
        '❌ MongoDB initialization failed:'
      );

      console.error(
        error.message
      );

      // IMPORTANT:
      // Do not call process.exit(1) here.
      //
      // The HTTP server must remain alive so Render
      // can detect the open port.
      //
      // API requests requiring MongoDB will return
      // their own errors.
    }
  };

// Start database initialization

initializeDatabase();

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

const shutdown = (
  signal
) => {
  console.log(
    `\n${signal} received. Shutting down...`
  );

  server.close(
    () => {
      console.log(
        'HTTP server closed.'
      );

      process.exit(0);
    }
  );

  // Force shutdown after 10 seconds
  setTimeout(
    () => {
      console.error(
        'Forced shutdown.'
      );

      process.exit(1);
    },
    10000
  ).unref();
};

// ============================================================
// PROCESS SIGNALS
// ============================================================

process.on(
  'SIGTERM',
  () => {
    shutdown('SIGTERM');
  }
);

process.on(
  'SIGINT',
  () => {
    shutdown('SIGINT');
  }
);
