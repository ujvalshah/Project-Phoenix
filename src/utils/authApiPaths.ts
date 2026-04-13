/**
 * Build relative API paths for auth flows (keeps query encoding consistent and testable).
 */
export function buildAuthVerifyEmailPath(token: string): string {
  return `/auth/verify-email?token=${encodeURIComponent(token)}`;
}
