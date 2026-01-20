// IMPORTANT: Load environment variables FIRST before any other imports
// This ensures env vars are available when modules initialize
import './loadEnv.js';

// CRITICAL: Validate environment variables BEFORE any other imports
// This ensures the server fails fast on misconfiguration
import { validateEnv, getEnv } from './config/envValidation.js';
validateEnv();

// Initialize Logger early (after validateEnv, before other imports that might log)
import { initLogger, getLogger, createRequestLogger } from './utils/logger.js';
initLogger();

// Initialize Sentry early (before other imports that might throw)
import { initSentry, captureException, isSentryEnabled } from './utils/sentry.js';
initSentry();

import express from 'express';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan'; // Request logger
import helmet from 'helmet';
import compression from 'compression'; // Gzip compression
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import * as Sentry from '@sentry/node';

// Workaround for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Observability - get logger after initialization
const logger = getLogger();
import { requestIdMiddleware } from './middleware/requestId.js';
import { slowRequestMiddleware } from './middleware/slowRequest.js';

// Database
import { connectDB, isMongoConnected } from './utils/db.js';
import { seedDatabase } from './utils/seed.js';
import { clearDatabase } from './utils/clearDatabase.js';

// Token Service (Redis-based token management)
import { initTokenService, closeTokenService } from './services/tokenService.js';

// Cloudinary
import { initializeCloudinary } from './services/cloudinaryService.js';

// Route Imports
import authRouter from './routes/auth.js';
import articlesRouter from './routes/articles';
import usersRouter from './routes/users';
import collectionsRouter from './routes/collections';
import tagsRouter from './routes/tags';
import legalRouter from './routes/legal';
import feedbackRouter from './routes/feedback.js';
import moderationRouter from './routes/moderation.js';
import adminRouter from './routes/admin.js';
import unfurlRouter from './routes/unfurl.js';
import mediaRouter from './routes/media.js';

const app = express();
const env = getEnv();
const PORT = parseInt(env.PORT, 10) || 5000;

// Compression Middleware (Gzip) - Reduces JSON response size by ~70%
app.use(compression({
  filter: (req, res) => {
    // Compress all responses except if explicitly disabled
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Default compression filter logic - compress JSON and text responses
    const contentType = res.getHeader('content-type') as string;
    return !contentType || /json|text|javascript|css|xml|html/.test(contentType);
  },
  level: 6 // Balance between compression and CPU (0-9, 6 is good default)
}));

// Security Middleware
app.use(helmet());

// CORS Configuration - FRONTEND_URL first (env-specific), then fixed production domains
const allowedOrigins: string[] = [
  ...(env.FRONTEND_URL ? [env.FRONTEND_URL] : []),
  "https://nuggetnews.app",
  "https://www.nuggetnews.app",
  "https://nugget-cyan.vercel.app"
].filter(Boolean);

// Diagnostic middleware to log request details before CORS check
app.use((req, res, next) => {
  // Only log CORS-relevant requests (those with Origin header or preflight)
  if (req.headers.origin || req.method === 'OPTIONS') {
    const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
    requestLogger.info({
      msg: '[CORS-DIAG] Request details',
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      origin: req.headers.origin || '(no origin header)',
      allowedOrigins: allowedOrigins,
    });
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // Diagnostic logging for origin validation
    const logger = getLogger();
    const hasOrigin = !!origin;
    
    // Allow requests without origin (same-origin requests)
    if (!origin) {
      logger.info({
        msg: '[CORS-DIAG] Origin validation',
        origin: '(no origin)',
        hasOrigin: false,
        allowedOrigins: allowedOrigins,
        matchFound: 'no-origin-checked',
        isAllowed: true,
        validationRule: '!origin',
        environment: env.NODE_ENV,
      });
      return callback(null, true);
    }
    
    // Check against production allow-list
    const isInAllowedList = allowedOrigins.includes(origin);
    
    // In development mode, also allow localhost and 127.0.0.1 origins
    let isAllowed = isInAllowedList;
    let matchFound = isInAllowedList;
    const isLocalhost = origin.startsWith('http://localhost:') || 
                        origin.startsWith('http://127.0.0.1:') ||
                        origin === 'http://localhost' ||
                        origin === 'http://127.0.0.1';
    
    if (env.NODE_ENV === 'development' && isLocalhost) {
      isAllowed = true;
      matchFound = 'localhost-allowed-in-dev';
    }
    
    logger.info({
      msg: '[CORS-DIAG] Origin validation',
      origin: origin,
      hasOrigin: true,
      allowedOrigins: allowedOrigins,
      matchFound: matchFound,
      isAllowed: isAllowed,
      environment: env.NODE_ENV,
      isLocalhost: isLocalhost,
      validationRule: env.NODE_ENV === 'development' ? 'allowedOrigins.includes(origin) || isLocalhost' : 'allowedOrigins.includes(origin)',
    });
    
    if (isAllowed) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.options(/.*/, cors());

// Request ID Middleware - MUST be early to ensure all logs have request ID
app.use(requestIdMiddleware);

// Sentry Request Handler - MUST be before routes (only if Sentry is enabled)


// Body Parsing
app.use(express.json({ limit: '10mb' }));

// Request Logging - Use structured logger instead of morgan in production
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Keep morgan for dev readability
} else {
  // In production, use structured logging via middleware
  app.use((req, res, next) => {
    const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
    requestLogger.info({
      msg: 'Incoming request',
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });
}

// Slow Request Detection - Apply before routes
app.use(slowRequestMiddleware);

// Request Timeout Middleware - Apply to all routes
import { standardTimeout, longOperationTimeout } from './middleware/timeout.js';
app.use(standardTimeout);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/users', usersRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/categories', tagsRouter); // Legacy endpoint - kept for backward compatibility
app.use('/api/tags', tagsRouter); // New endpoint
app.use('/api/legal', legalRouter);
// AI routes removed - legacy AI creation system has been fully removed
// Safeguard: Return 410 Gone for any attempts to access removed AI endpoints
// Express 5 requires regex pattern instead of wildcard syntax
app.all(/^\/api\/ai\/.+/, (req, res) => {
  const logger = getLogger();
  logger.warn({
    msg: '[AI FLOW REMOVED] Legacy call blocked',
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  res.status(410).json({
    error: 'Gone',
    message: 'AI creation endpoints have been permanently removed. Manual article creation is required.',
  });
});
app.use('/api/feedback', feedbackRouter);
app.use('/api/moderation', moderationRouter);
// Audit Phase-1 Fix: Apply longOperationTimeout to unfurl routes (60s for metadata fetching)
app.use('/api/unfurl', longOperationTimeout, unfurlRouter);
app.use('/api/admin', adminRouter);
app.use('/api/media', mediaRouter);

// Health Check - Enhanced to verify DB connectivity
app.get('/api/health', async (req, res) => {
  // Audit Phase-3 Fix: Add debug logging around health checks for observability
  const requestLogger = createRequestLogger(req.id || 'unknown', undefined, '/api/health');
  requestLogger.debug({ msg: 'Health check requested' });
  
  try {
    const dbConnected = isMongoConnected();
    const dbStatus = dbConnected ? 'connected' : 'disconnected';
    
    // Audit Phase-2 Fix: Check Redis health if configured (optional service)
    let redisHealthy = true; // Default to true if Redis not configured
    if (process.env.REDIS_URL) {
      try {
        // Use dynamic import to avoid requiring redis package if not installed
        const { createClient } = await import('redis');
        const client = createClient({ url: process.env.REDIS_URL });
        await client.connect();
        await client.ping();
        await client.quit();
        redisHealthy = true;
      } catch (redisError: any) {
        redisHealthy = false;
        // Log but don't fail health check - Redis is optional
        const logger = getLogger();
        logger.warn({
          msg: 'Redis health check failed',
          error: {
            message: redisError.message,
          },
        });
      }
    }
    
    // Return 503 if database is not connected (unhealthy)
    if (!dbConnected) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        uptime: Math.floor(process.uptime()),
        environment: env.NODE_ENV || 'development',
        dependencies: {
          database: {
            status: 'down',
            message: 'MongoDB connection is not available'
          },
          redis: {
            status: redisHealthy ? 'up' : 'down',
            message: redisHealthy ? 'Redis connection is healthy' : 'Redis connection failed'
          }
        }
      });
    }
    
    // Healthy response
    requestLogger.debug({ 
      msg: 'Health check passed', 
      database: dbStatus, 
      redis: redisHealthy ? 'healthy' : 'unhealthy' 
    });
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: redisHealthy ? 'healthy' : 'unhealthy',
      uptime: Math.floor(process.uptime()),
      environment: env.NODE_ENV || 'development',
      dependencies: {
        database: {
          status: 'up',
          message: 'MongoDB connection is healthy'
        },
        redis: {
          status: redisHealthy ? 'up' : 'down',
          message: redisHealthy ? 'Redis connection is healthy' : (process.env.REDIS_URL ? 'Redis connection failed' : 'Redis not configured')
        }
      }
    });
  } catch (error: any) {
    // Health check itself failed
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'unknown',
      redis: 'unknown',
      error: error.message,
      dependencies: {
        database: {
          status: 'error',
          message: 'Health check failed'
        },
        redis: {
          status: 'error',
          message: 'Health check failed'
        }
      }
    });
  }
});

// Clear Database Endpoint (for development/admin use)
app.post('/api/clear-db', async (req, res) => {
  try {
    await clearDatabase();
    res.json({ 
      success: true, 
      message: 'Database cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    const requestLogger = createRequestLogger(req.id || 'unknown', undefined, '/api/clear-db');
    requestLogger.error({
      msg: 'Clear DB error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error, { requestId: req.id, route: '/api/clear-db' });
    res.status(500).json({ 
      success: false,
      message: 'Failed to clear database',
      error: error.message,
      requestId: req.id,
    });
  }
});

// API 404 Handler - MUST come before React static file handler
// Prevents API requests from falling through to index.html
// Express 5 requires named wildcard parameters - using regex pattern for compatibility
app.all(/^\/api\/.+/, (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.method} ${req.originalUrl} does not exist`,
    path: req.originalUrl
  });
});

// Production: Serve React Static Files
if (env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../../dist')));
  // Catch-all handler for React Router (only for non-API routes)
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Sentry Error Handler - MUST be before other error handlers (only if Sentry is enabled)
if (isSentryEnabled()) {
  Sentry.setupExpressErrorHandler(app);
}


// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestLogger = createRequestLogger(
    req.id || 'unknown',
    (req as any).userId,
    req.path
  );

  // Enhanced logging for CORS errors
  if (err.message && err.message.includes('CORS')) {
    requestLogger.error({
      msg: '[CORS-DIAG] CORS error detected',
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      origin: req.headers.origin || '(no origin header)',
      allowedOrigins: allowedOrigins,
    });
  } else {
    // Log error with structured logger
    requestLogger.error({
      msg: 'Unhandled server error',
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      method: req.method,
      path: req.path,
    });
  }

  // Capture in Sentry with context — never include body for auth routes (may contain passwords)
  const isAuthRoute = (req.path || '').startsWith('/api/auth');
  captureException(err, {
    requestId: req.id,
    route: req.path,
    userId: (req as any).userId,
    extra: isAuthRoute
      ? { method: req.method }
      : { method: req.method, body: req.body, query: req.query },
  });

  // Send error response
  res.status(err.status || 500).json({
    message: env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    requestId: req.id,
  });
});

// Initialize Database and Start Server
let server: any = null;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Log database connection info (masked for security)
    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    logger.info({
      msg: 'Database connected',
      database: dbName,
      environment: env.NODE_ENV,
    });
    
    // Initialize Cloudinary (optional - only if credentials provided)
    initializeCloudinary();

    // Initialize Token Service (Redis-based auth features)
    // Provides: token blacklisting, refresh tokens, account lockout
    await initTokenService();
    
    // Seed database if empty
    // TEMPORARILY DISABLED: Seeding is disabled. Re-enable by uncommenting the line below when needed.
    // await seedDatabase();
    
    // Start server and store reference for graceful shutdown
    server = app.listen(PORT, () => {
      logger.info({
        msg: 'Server started',
        port: PORT,
        environment: env.NODE_ENV,
        compression: 'enabled',
        gracefulShutdown: 'enabled',
      });
    });
    
    return server;
  } catch (error: any) {
    logger.error({
      msg: 'Failed to start server',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error, { extra: { phase: 'startup' } });
    process.exit(1);
  }
}

// Graceful Shutdown Handler
async function gracefulShutdown(signal: string) {
  logger.info({
    msg: 'Graceful shutdown initiated',
    signal,
  });
  
  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info({ msg: 'HTTP server closed' });
    });
  }
  
  // Close MongoDB connection
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.close();
      logger.info({ msg: 'MongoDB connection closed' });
    } catch (error: any) {
      logger.error({
        msg: 'Error closing MongoDB',
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
    }
  }
  
  // Close Redis connections (rate limiter and token service)
  try {
    const { closeRedisConnection } = await import('./middleware/rateLimiter.js');
    await closeRedisConnection();
    logger.info({ msg: 'Rate limiter Redis connection closed' });
  } catch (error: any) {
    // Redis might not be configured, so this is not critical
    if (error.message && !error.message.includes('Redis')) {
      logger.warn({ msg: 'Error closing rate limiter Redis connection', error: error.message });
    }
  }

  try {
    await closeTokenService();
    logger.info({ msg: 'Token service Redis connection closed' });
  } catch (error: any) {
    logger.warn({ msg: 'Error closing token service connection', error: error.message });
  }
  
  // Flush Sentry events before exit
  try {
    await Sentry.flush(2000); // Wait up to 2 seconds
  } catch (error: any) {
    logger.warn({ msg: 'Failed to flush Sentry events', error: error.message });
  }
  
  // Give connections time to close, then exit
  setTimeout(() => {
    logger.info({ msg: 'Graceful shutdown complete' });
    process.exit(0);
  }, 5000); // 5 second grace period
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global Exception Handlers
process.on('uncaughtException', async (error: Error) => {
  logger.error({
    msg: 'Uncaught exception - shutting down',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
  });
  
  // Capture in Sentry
  captureException(error, { extra: { phase: 'uncaughtException' } });
  
  // Flush Sentry before exit
  try {
    await Sentry.flush(2000);
  } catch (flushError: any) {
    logger.warn({ msg: 'Failed to flush Sentry on uncaught exception' });
  }
  
  // Attempt graceful shutdown
  await gracefulShutdown('uncaughtException');
  process.exit(1);
});

process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  
  logger.error({
    msg: 'Unhandled promise rejection',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
  });
  
  // Capture in Sentry
  captureException(error, { extra: { phase: 'unhandledRejection' } });
  
  // In production, exit after logging
  if (env.NODE_ENV === 'production') {
    try {
      await Sentry.flush(2000);
    } catch (flushError: any) {
      logger.warn({ msg: 'Failed to flush Sentry on unhandled rejection' });
    }
    await gracefulShutdown('unhandledRejection');
    process.exit(1);
  }
});

// Start the server
startServer();