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
  const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/644d3f65-7d10-49bb-9448-a6d17f7f61c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'44457b'},body:JSON.stringify({sessionId:'44457b',runId:'initial',hypothesisId:'H4',location:'server/src/middleware/authenticateToken.ts:authenticateToken',message:'Auth middleware received request',data:{method:req.method,path:req.path,hasAuthHeader:!!authHeader,hasBearerToken:!!token},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!token) {
    requestLogger.warn({
      msg: '[AuthDebug] Rejecting request: missing bearer token',
      method: req.method,
      hasAuthorizationHeader: !!authHeader,
      authHeaderPrefix: typeof authHeader === 'string' ? authHeader.slice(0, 20) : null,
    });
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/644d3f65-7d10-49bb-9448-a6d17f7f61c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'44457b'},body:JSON.stringify({sessionId:'44457b',runId:'initial',hypothesisId:'H4',location:'server/src/middleware/authenticateToken.ts:authenticateToken',message:'Rejecting request due to missing token',data:{authHeaderValue:typeof authHeader==='string'?authHeader.slice(0,20):null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return res.status(401).json({
      error: true,
      message: 'Access token required',
      code: 'TOKEN_REQUIRED',
    });
  }

  try {
    // Check if token is blacklisted (user logged out)
    const blacklisted = await isTokenBlacklisted(token);
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/644d3f65-7d10-49bb-9448-a6d17f7f61c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'44457b'},body:JSON.stringify({sessionId:'44457b',runId:'initial',hypothesisId:'H5',location:'server/src/middleware/authenticateToken.ts:authenticateToken',message:'Blacklist check completed',data:{isBlacklisted:blacklisted},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/644d3f65-7d10-49bb-9448-a6d17f7f61c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'44457b'},body:JSON.stringify({sessionId:'44457b',runId:'initial',hypothesisId:'H5',location:'server/src/middleware/authenticateToken.ts:authenticateToken',message:'Token verification failed',data:{errorName:error?.name||null,errorMessage:error?.message||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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










