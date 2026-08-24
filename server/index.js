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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const isProd = process.env.NODE_ENV === 'production';

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

app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
      : ['http://localhost:5173'],
    credentials: true,
  })
);

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
// HEALTH CHECK
// ============================================================

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      database: 'connected',
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
// SERVE REACT IN PRODUCTION
// ============================================================

if (isProd) {
  app.use(
    express.static(
      path.join(__dirname, 'public')
    )
  );

  app.get(
    '*',
    (req, res) => {
      res.sendFile(
        path.join(
          __dirname,
          'public',
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

    // Multer / upload errors
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

    // Mongoose validation errors
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

    // Invalid MongoDB ObjectId
    if (
      err.name === 'CastError'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid id format',
      });
    }

    // Duplicate MongoDB record
    if (
      err.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate record',
      });
    }

    console.error(
      '❌ Server Error:',
      err.stack
    );

    res.status(500).json({
      success: false,
      message: isProd
        ? 'Server error'
        : err.message,
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

const startServer = async () => {
  try {

    // --------------------------------------------------------
    // Check MongoDB environment variable
    // --------------------------------------------------------

    if (!process.env.MONGODB_URI) {
      throw new Error(
        'MONGODB_URI is missing from the .env file'
      );
    }

    console.log(
      '🔄 Connecting to MongoDB...'
    );

    // --------------------------------------------------------
    // Connect MongoDB
    // --------------------------------------------------------

    await connectDB();

    console.log(
      '✅ MongoDB connection successful'
    );

    // --------------------------------------------------------
    // Create/check admin
    // --------------------------------------------------------

    await createAdmin();

    console.log(
      '✅ Admin account ready'
    );

    // --------------------------------------------------------
    // Start Express server
    // --------------------------------------------------------

    const PORT =
      process.env.PORT || 5000;

    app.listen(
      PORT,
      '0.0.0.0',
      () => {

        console.log(
          `🚀 Server running on port ${PORT}`
        );

        console.log(
          `❤️ Health: http://localhost:${PORT}/api/health`
        );

      }
    );

  } catch (error) {

    console.error(
      '\n❌ Server startup failed:'
    );

    console.error(
      error.message
    );

    process.exit(1);
  }
};

// ============================================================
// START APPLICATION
// ============================================================

startServer();