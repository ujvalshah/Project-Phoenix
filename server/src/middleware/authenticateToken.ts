import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { createRequestLogger } from '../utils/logger.js';

/**
 * Express middleware to authenticate JWT tokens
 * Adds req.user = { userId: string, role: string } to the request if token is valid
 * 
 * CRITICAL: OPTIONS requests (CORS preflight) are allowed through without authentication
 * to enable cross-origin DELETE/PUT/PATCH requests with custom headers.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Skip authentication for OPTIONS requests (CORS preflight)
  // Browsers send OPTIONS requests before DELETE/PUT/PATCH with custom headers
  // These requests don't include Authorization headers, so we must allow them through
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      // Audit Phase-2 Fix: Log token expiration using request logger
      const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
      requestLogger.warn({
        msg: 'Token expired',
        expiredAt: (error as any).expiredAt,
      });
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}










