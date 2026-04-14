const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * Read CSRF token from cookie set by backend auth endpoints.
 */
export function getCsrfToken(): string | undefined {
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
