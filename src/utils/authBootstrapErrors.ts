/**
 * Classify /api/auth/me failures during session bootstrap.
 * Transient errors should not clear stored tokens (offline / server blips).
 */

export function isTransientAuthMeError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const e = error as Record<string, unknown>;
  if (e.isNetworkError === true) {
    return true;
  }
  if (error instanceof TypeError && String((error as Error).message).toLowerCase().includes('fetch')) {
    return true;
  }
  const status = (e.response as { status?: number } | undefined)?.status;
  // Server errors and rate limits: keep session; user can retry when service recovers
  if (typeof status === 'number' && (status >= 500 || status === 429)) {
    return true;
  }
  return false;
}
