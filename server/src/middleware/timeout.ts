/**
 * Request Timeout Middleware
 * 
 * Ensures all requests have a timeout to prevent hanging requests.
 * Long-running operations should be aborted when timeout is exceeded.
 */

import { Request, Response, NextFunction } from 'express';
import { createRequestLogger } from '../utils/logger.js';

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds default
const LONG_OPERATION_TIMEOUT_MS = 60000; // 60 seconds for long operations

/**
 * Create timeout middleware
 */
export function requestTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Audit Phase-3 Fix: Add debug logging around timeout events for observability
    const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
    
    // Set timeout for the request
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        // Audit Phase-3 Fix: Log timeout event with debug level for observability
        requestLogger.debug({
          msg: 'Request timeout triggered',
          timeoutMs,
          method: req.method,
          path: req.path,
          code: 'REQUEST_TIMEOUT'
        });
        res.status(504).json({
          error: true,
          message: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
          timestamp: new Date().toISOString()
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      clearTimeout(timeout);
      originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Timeout middleware for long-running operations (e.g., AI processing, metadata fetching)
 */
export const longOperationTimeout = requestTimeout(LONG_OPERATION_TIMEOUT_MS);

/**
 * Standard timeout middleware for regular API requests
 */
export const standardTimeout = requestTimeout(DEFAULT_TIMEOUT_MS);





