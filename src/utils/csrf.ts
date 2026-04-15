const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_STORAGE_KEY = 'nuggets_csrf_token';

/**
 * In-memory cache of the CSRF token.
 *
 * When the SPA and the API live on different eTLD+1s (e.g. Vercel frontend +
 * separate API host), the `csrf_token` cookie is scoped to the API origin and
 * is NOT visible to `document.cookie` on the frontend. We therefore capture
 * the token from auth-endpoint JSON responses (login/signup/refresh/me) and
 * keep an in-memory copy for outgoing mutations. sessionStorage mirrors the
 * value so a hard refresh doesn't blank the header before the next `/auth/me`
 * rehydrates it.
 */
let cachedCsrfToken: string | undefined;

function readSessionStorage(): string | undefined {
  try {
    if (typeof sessionStorage === 'undefined') return undefined;
    const v = sessionStorage.getItem(CSRF_STORAGE_KEY);
    return v || undefined;
  } catch {
    return undefined;
  }
}

function writeSessionStorage(token: string | undefined): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (token) sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    else sessionStorage.removeItem(CSRF_STORAGE_KEY);
  } catch {
    // storage may be disabled (private mode, quota) — safe to ignore
  }
}

/**
 * Cache the CSRF token returned by auth endpoints. Call on login/signup/
 * refresh/me responses whenever the server includes `csrfToken`.
 */
export function setCsrfToken(token: string | undefined): void {
  cachedCsrfToken = token && token.length > 0 ? token : undefined;
  writeSessionStorage(cachedCsrfToken);
}

/**
 * Clear the cached CSRF token on logout.
 */
export function clearCsrfToken(): void {
  cachedCsrfToken = undefined;
  writeSessionStorage(undefined);
}

/**
 * Read the CSRF token. Preference order: in-memory cache → sessionStorage →
 * cookie (only works when SPA and API share an origin).
 */
export function getCsrfToken(): string | undefined {
  if (cachedCsrfToken) return cachedCsrfToken;
  const stored = readSessionStorage();
  if (stored) {
    cachedCsrfToken = stored;
    return stored;
  }
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Build request headers with CSRF token when present.
 */
export function getCsrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { 'X-CSRF-Token': token } : {};
}
