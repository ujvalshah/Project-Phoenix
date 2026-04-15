import { Request, Response, NextFunction } from 'express';
import { ACCESS_TOKEN_COOKIE, CSRF_TOKEN_COOKIE } from '../utils/authCookies.js';

/**
 * Endpoints exempt from CSRF validation.
 *
 * These are public auth bootstraps that do not act on an existing authenticated
 * session. They're already protected by rate limiters and password verification,
 * and they're the entry points where fresh CSRF tokens are minted. Enforcing
 * CSRF here creates a deadlock after logout: stale cookies from a previous
 * session can desync the double-submit check and block the very request that
 * would re-establish a clean session. Protecting login with CSRF provides no
 * real security benefit (an attacker cannot forge a login they already have
 * credentials for) while blocking legitimate re-auth flows.
 */
const CSRF_EXEMPT_PATHS = new Set<string>([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/resend-verification',
]);

/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * How it works:
 * 1. On login/signup/refresh, the server sets a non-HttpOnly `csrf_token` cookie
 *    and includes the same value in the JSON response.
 * 2. The client reads the cookie (or JSON value) and sends it as `X-CSRF-Token` header.
 * 3. This middleware verifies the header matches the cookie on state-changing requests.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe methods don't need CSRF protection
  const safeMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  if (safeMethod) {
    return next();
  }

  // Public auth endpoints are exempt — see CSRF_EXEMPT_PATHS rationale above.
  // Logout is exempt too: it must be idempotent and able to succeed even when
  // the session's CSRF cookie is stale or missing, otherwise users can get
  // stuck "signed in" after a failed sign-out.
  if (CSRF_EXEMPT_PATHS.has(req.originalUrl.split('?')[0])) {
    return next();
  }

  // Requests with Authorization: Bearer are CSRF-immune (header can't be set by cross-origin forms)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  const csrfCookie = (req as any).cookies?.[CSRF_TOKEN_COOKIE] as string | undefined;
  const accessCookie = (req as any).cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;

  // If the request is cookie-authenticated (access_token present), CSRF is
  // REQUIRED — even if the csrf_token cookie was lost. Previously we skipped
  // enforcement whenever the csrf cookie was absent, which let a client with
  // a valid session cookie mutate without any CSRF verification. That
  // defeats the double-submit defense.
  if (accessCookie) {
    const csrfHeader = req.headers['x-csrf-token'] as string | undefined;
    if (!csrfCookie || !csrfHeader || csrfHeader !== csrfCookie) {
      res.status(403).json({
        error: true,
        message: 'CSRF token mismatch',
        code: 'CSRF_INVALID',
      });
      return;
    }
    return next();
  }

  // No cookie auth AND no csrf cookie → unauthenticated public request, skip.
  if (!csrfCookie) {
    return next();
  }

  // Defense in depth: if somehow a csrf cookie exists without access_token
  // (e.g. session partially cleared), still require header parity.
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
