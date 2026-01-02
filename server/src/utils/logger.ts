/**
 * Structured Logger using Pino
 * 
 * Provides JSON logging with:
 * - Log levels: error, warn, info, debug
 * - Environment-aware verbosity
 * - Timestamps included
 * - Request ID correlation
 * - No secrets logged
 */

import pino from 'pino';
import type { Logger } from 'pino';
import { getEnv } from '../config/envValidation.js';

// Logger instance - initialized by initLogger()
let logger: Logger | null = null;

/**
 * Initialize the logger.
 * Must be called after validateEnv() has been executed.
 */
export function initLogger(): void {
  const env = getEnv();

  // Determine log level based on environment
  const logLevel = env.NODE_ENV === 'production' ? 'info' : 'debug';

  // Create logger instance
  logger = pino({
    level: logLevel,
    // In development, use pretty printing for readability
    ...(env.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    }),
    // In production, output JSON
    ...(env.NODE_ENV === 'production' && {
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
  });
}

/**
 * Get the logger instance.
 * Throws if initLogger() hasn't been called yet.
 */
export function getLogger(): Logger {
  if (!logger) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }
  return logger;
}

/**
 * Sanitize sensitive data from log objects
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = [
    'password',
    'token',
    'jwt',
    'secret',
    'authorization',
    'auth',
    'apiKey',
    'apikey',
    'accessToken',
    'refreshToken',
    'session',
  ];

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string, userId?: string, route?: string) {
  const loggerInstance = getLogger();
  const context: any = {
    requestId,
  };

  if (userId) {
    context.userId = userId;
  }

  if (route) {
    context.route = route;
  }

  return loggerInstance.child(context);
}

/**
 * Helper functions for common logging patterns
 */
export const log = {
  error: (message: string, error?: Error | any, context?: Record<string, any>) => {
    const loggerInstance = getLogger();
    const logData: any = { msg: message };

    if (error) {
      if (error instanceof Error) {
        logData.err = {
          message: error.message,
          stack: error.stack,
          name: error.name,
        };
      } else {
        logData.err = sanitizeData(error);
      }
    }

    if (context) {
      Object.assign(logData, sanitizeData(context));
    }

    loggerInstance.error(logData);
  },

  warn: (message: string, context?: Record<string, any>) => {
    const loggerInstance = getLogger();
    const logData: any = { msg: message };
    if (context) {
      Object.assign(logData, sanitizeData(context));
    }
    loggerInstance.warn(logData);
  },

  info: (message: string, context?: Record<string, any>) => {
    const loggerInstance = getLogger();
    const logData: any = { msg: message };
    if (context) {
      Object.assign(logData, sanitizeData(context));
    }
    loggerInstance.info(logData);
  },

  debug: (message: string, context?: Record<string, any>) => {
    const loggerInstance = getLogger();
    const logData: any = { msg: message };
    if (context) {
      Object.assign(logData, sanitizeData(context));
    }
    loggerInstance.debug(logData);
  },
};

