/**
 * Request ID Middleware
 * 
 * Generates a unique request ID for each incoming request and:
 * - Attaches it to req.id
 * - Adds it to response headers (X-Request-Id)
 * - Makes it available for logging correlation
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request to include request ID
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Middleware to generate and attach request ID
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Use existing request ID from header if present, otherwise generate new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Attach to request object
  req.id = requestId;

  // Add to response headers for client correlation
  res.setHeader('X-Request-Id', requestId);

  next();
}





