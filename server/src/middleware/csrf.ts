import { Request, Response, NextFunction } from 'express';
import { CSRF_TOKEN_COOKIE } from '../utils/authCookies.js';

/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * How it works:
 * 1. On login/signup/refresh, the server sets a non-HttpOnly `csrf_token` cookie
 *    and includes the same value in the JSON response.
 * 2. The client reads the cookie (or JSON value) and sends it as `X-CSRF-Token` header.
 * 3. This middleware verifies the header matches the cookie on state-changing requests.
 *
 * Why this works:
 * - An attacker site cannot read the csrf_token cookie (SameSite=Strict + same-origin policy).
 * - A cross-origin form submission will not include the X-CSRF-Token header.
 * - Therefore only the legitimate client can supply the matching header.
 *
 * Exemptions:
 * - GET/HEAD/OPTIONS requests (safe methods, no state change)
 * - Requests using Authorization: Bearer header (already CSRF-immune — tokens
 *   in headers cannot be sent by cross-origin forms)
 * - Requests without the csrf_token cookie (user hasn't logged in via cookies yet)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe methods don't need CSRF protection
  const safeMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  if (safeMethod) {
    return next();
  }

  // Requests with Authorization: Bearer are CSRF-immune (header can't be set by cross-origin forms)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // If no csrf cookie is set, user is not using cookie-based auth — skip
  const csrfCookie = (req as any).cookies?.[CSRF_TOKEN_COOKIE] as string | undefined;
  if (!csrfCookie) {
    return next();
  }

  // Verify the X-CSRF-Token header matches the cookie
  const csrfHeader = req.headers['x-csrf-token'] as string | undefined;
  if (!csrfHeader || csrfHeader !== csrfCookie) {
    res.status(403).json({
      error: true,
      message: 'CSRF token mismatch',
      code: 'CSRF_INVALID',
    });
    return;
  }

  next();
}
