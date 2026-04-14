import { Response } from 'express';
import { getEnv } from '../config/envValidation.js';
import { TOKEN_CONFIG } from './jwt.js';

// Cookie names
const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const CSRF_TOKEN_COOKIE = 'csrf_token';

/**
 * Determine if Secure flag should be set on cookies.
 * Secure cookies are only sent over HTTPS — required in production.
 */
function isSecure(): boolean {
  return getEnv().NODE_ENV === 'production';
}

/**
 * Cross-site frontend->API calls in production require SameSite=None.
 * Local development keeps Strict for tighter default behavior.
 */
function getSameSite(): 'strict' | 'none' {
  return getEnv().NODE_ENV === 'production' ? 'none' : 'strict';
}

/**
 * Set HttpOnly auth cookies on the response.
 *
 * - access_token: HttpOnly, Secure (prod), SameSite=Strict, Path=/api
 * - refresh_token: HttpOnly, Secure (prod), SameSite=Strict, Path=/api/auth/refresh
 *   (scoped to refresh endpoint so it's not sent on every request)
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string
): void {
  const secure = isSecure();
  const sameSite = getSameSite();

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api',
    maxAge: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS * 1000, // ms
  });

  if (refreshToken) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/auth/refresh',
      maxAge: TOKEN_CONFIG.REFRESH_TOKEN_SECONDS * 1000, // ms
    });
  }
}

/**
 * Clear auth cookies on logout.
 * Must match the same Path values used when setting.
 */
export function clearAuthCookies(res: Response): void {
  const secure = isSecure();
  const sameSite = getSameSite();

  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api',
  });

  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api/auth/refresh',
  });

  res.clearCookie(CSRF_TOKEN_COOKIE, {
    secure,
    sameSite,
    path: '/',
  });
}

/**
 * Set a non-HttpOnly CSRF cookie for the double-submit pattern.
 * The client reads this cookie and sends it back as X-CSRF-Token header.
 */
export function setCsrfCookie(res: Response, csrfToken: string): void {
  const sameSite = getSameSite();
  res.cookie(CSRF_TOKEN_COOKIE, csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    secure: isSecure(),
    sameSite,
    path: '/',
    maxAge: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS * 1000,
  });
}

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, CSRF_TOKEN_COOKIE };
