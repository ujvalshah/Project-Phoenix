import { Request, Response, NextFunction } from 'express';
import { verifyToken, type JWTPayload } from '../utils/jwt.js';
import { isTokenBlacklisted } from '../services/tokenService.js';
import { createRequestLogger } from '../utils/logger.js';

type OptionalAuthRequest = Request & {
  id?: string;
  cookies?: Record<string, string | undefined>;
  user?: JWTPayload;
  token?: string;
};

function getRequestId(req: Request): string {
  const id = (req as OptionalAuthRequest).id;
  return typeof id === 'string' && id.length > 0 ? id : 'unknown';
}

function getCookieAccessToken(req: Request): string | undefined {
  const raw = (req as OptionalAuthRequest).cookies?.access_token;
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * Best-effort auth middleware:
 * - If no token is present, continue as anonymous request.
 * - If token is valid, attach req.user.
 * - If token is invalid/revoked, continue as anonymous request.
 */
export async function optionalAuthenticateToken(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const cookieToken = getCookieAccessToken(req);
  const token = cookieToken || headerToken;

  if (!token) {
    return next();
  }

  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return next();
    }

    const decoded = verifyToken(token);
    const reqAuth = req as OptionalAuthRequest;
    reqAuth.user = decoded;
    reqAuth.token = token;
    return next();
  } catch (error: unknown) {
    const requestLogger = createRequestLogger(getRequestId(req), undefined, req.path);
    requestLogger.warn({
      msg: '[OptionalAuth] Ignoring invalid auth token for optional route',
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: String(error) },
    });
    return next();
  }
}
