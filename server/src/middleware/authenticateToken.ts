import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { createRequestLogger } from '../utils/logger.js';
import { isTokenBlacklisted } from '../services/tokenService.js';
import { User } from '../models/User.js';
import { getEnv } from '../config/envValidation.js';

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
  const headerToken = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  // Cookie-based auth is the canonical browser flow and is set fresh by
  // login/refresh. A stale `Authorization: Bearer` header from an older
  // client could otherwise out-vote a fresher cookie token. Cookie-first
  // closes that class of "I logged in again but the old token is being
  // used" bugs. The header path remains for non-browser API clients.
  const cookieToken = (req as any).cookies?.access_token as string | undefined;
  const token = cookieToken || headerToken;
  const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);

  if (!token) {
    requestLogger.warn({
      msg: '[AuthDebug] Rejecting request: missing bearer token',
      method: req.method,
      hasAuthorizationHeader: !!authHeader,
      authHeaderPrefix: typeof authHeader === 'string' ? authHeader.slice(0, 20) : null,
      hasCookieToken: !!cookieToken,
    });
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
      requestLogger.warn({
        msg: '[AuthDebug] Rejecting request: token is blacklisted',
        method: req.method,
      });
      return res.status(401).json({
        error: true,
        message: 'Token has been revoked',
        code: 'TOKEN_REVOKED',
      });
    }

    const decoded = verifyToken(token);

    // tokenVersion check (PR5): a bumped tokenVersion immediately invalidates
    // every live access token for the user. The check costs one read per
    // authenticated request — acceptable for an observe-only rollout, can
    // be Redis-cached later. Behind ENFORCE_TOKEN_VERSION (default false)
    // so a bug in the comparison can't lock everyone out at deploy time.
    try {
      const userDoc = await User.findById(decoded.userId).select('tokenVersion');
      if (userDoc) {
        const tokenTv = decoded.tokenVersion ?? 0;
        const userTv = userDoc.tokenVersion ?? 0;
        const enforce = getEnv().ENFORCE_TOKEN_VERSION;
        if (tokenTv !== userTv) {
          if (enforce) {
            requestLogger.warn({
              msg: '[TokenVersion] Rejecting request: tokenVersion mismatch',
              userId: decoded.userId,
              tokenTv,
              userTv,
            });
            return res.status(401).json({
              error: true,
              message: 'Session has been revoked. Please sign in again.',
              code: 'SESSION_REVOKED',
            });
          }
          // Observe-only: log and continue. Treat as a tripwire while we
          // confirm freshly-minted tokens carry the right value.
          requestLogger.warn({
            msg: '[TokenVersion] (observe-only) tokenVersion mismatch — would reject if ENFORCE_TOKEN_VERSION=true',
            userId: decoded.userId,
            tokenTv,
            userTv,
          });
        }
      }
    } catch (lookupErr) {
      const enforce = getEnv().ENFORCE_TOKEN_VERSION;
      if (enforce) {
        requestLogger.error({
          msg: '[TokenVersion] Enforced mode: failed to load user for version check; rejecting request',
          userId: decoded.userId,
          err: lookupErr instanceof Error ? { name: lookupErr.name, message: lookupErr.message } : { message: String(lookupErr) },
        });
        return res.status(503).json({
          error: true,
          message: 'Session validation temporarily unavailable. Please try again.',
          code: 'SESSION_VALIDATION_UNAVAILABLE',
        });
      }
      requestLogger.warn({
        msg: '[TokenVersion] Failed to load user for version check; allowing request (observe-only mode)',
        userId: decoded.userId,
        err: lookupErr instanceof Error ? { name: lookupErr.name, message: lookupErr.message } : { message: String(lookupErr) },
      });
    }

    (req as any).user = decoded;
    (req as any).token = token; // Store token for logout blacklisting
    next();
  } catch (error: any) {
    requestLogger.warn({
      msg: '[AuthDebug] Token verification failed',
      method: req.method,
      errorName: error?.name,
      errorMessage: error?.message,
    });
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










