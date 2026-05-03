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
function isSecure() {
    return getEnv().NODE_ENV === 'production';
}
/**
 * Cross-site frontend->API calls in production require SameSite=None.
 * Local development keeps Strict for tighter default behavior.
 */
function getSameSite() {
    return getEnv().NODE_ENV === 'production' ? 'none' : 'strict';
}
/**
 * Set HttpOnly auth cookies on the response.
 *
 * Both tokens use Path=/api. The refresh cookie was previously scoped to
 * `/api/auth/refresh`, but any reverse proxy that rewrites the `/api` prefix
 * (common on Vercel / Cloudflare / NGINX ingress) would silently drop the
 * cookie and cascade into a logout loop. HttpOnly + SameSite + the CSRF
 * double-submit already bound the refresh token to legitimate clients; the
 * narrow path added fragility without meaningful defense-in-depth.
 */
export function setAuthCookies(res, accessToken, refreshToken) {
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
            path: '/api',
            maxAge: TOKEN_CONFIG.REFRESH_TOKEN_SECONDS * 1000, // ms
        });
    }
}
/**
 * Clear auth cookies on logout.
 * Must match the same Path values used when setting.
 */
export function clearAuthCookies(res) {
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
        path: '/api',
    });
    // Legacy: clear the previously narrowly-scoped refresh cookie so users
    // upgrading from an older build don't end up with two refresh cookies.
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
export function setCsrfCookie(res, csrfToken) {
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
//# sourceMappingURL=authCookies.js.map