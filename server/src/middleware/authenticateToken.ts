import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { createRequestLogger } from '../utils/logger.js';
import { isTokenBlacklisted } from '../services/tokenService.js';

/**
 * Express middleware to authenticate JWT tokens
 * Adds req.user = { userId: string, role: string } to the request if token is valid
 *
 * Security checks:
 * 1. Token must be present in Authorization header
 * 2. Token must be valid (signature, expiry)
 * 3. Token must not be blacklisted (logged out)
 *
 * CRITICAL: OPTIONS requests (CORS preflight) are allowed through without authentication
 * to enable cross-origin DELETE/PUT/PATCH requests with custom headers.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Skip authentication for OPTIONS requests (CORS preflight)
  // Browsers send OPTIONS requests before DELETE/PUT/PATCH with custom headers
  // These requests don't include Authorization headers, so we must allow them through
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: true,
      message: 'Access token required',
      code: 'TOKEN_REQUIRED',
    });
  }

  try {
    // Check if token is blacklisted (user logged out)
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({
        error: true,
        message: 'Token has been revoked',
        code: 'TOKEN_REVOKED',
      });
    }

    const decoded = verifyToken(token);
    (req as any).user = decoded;
    (req as any).token = token; // Store token for logout blacklisting
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
      requestLogger.warn({
        msg: 'Token expired',
        expiredAt: (error as any).expiredAt,
      });
      return res.status(401).json({
        error: true,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: true,
        message: 'Invalid token',
        code: 'TOKEN_INVALID',
      });
    }
    return res.status(403).json({
      error: true,
      message: 'Invalid or expired token',
      code: 'TOKEN_ERROR',
    });
  }
}










