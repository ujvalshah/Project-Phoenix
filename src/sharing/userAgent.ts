/**
 * In-app browser detection for share-flow gating.
 *
 * Some social-media in-app browsers (IABs) expose `navigator.share` but
 * reject the call, return without opening a sheet, or invoke a broken share
 * UI. Detecting them lets us skip the native path and fall back to copy /
 * platform intents directly, instead of waiting for a failure that lies to
 * the user.
 *
 * UA-sniffing is a last resort — used here only to gate a known-broken
 * native API, not to branch UI.
 */

export type InAppBrowser = 'instagram' | 'facebook' | 'tiktok' | 'linkedin';

const IAB_PATTERNS: Array<readonly [InAppBrowser, RegExp]> = [
  ['instagram', /Instagram/i],
  ['facebook', /FBAN|FBAV/],
  ['tiktok', /musical_ly|BytedanceWebview/i],
  ['linkedin', /LinkedInApp/],
];

function readUserAgent(userAgent?: string): string {
  if (typeof userAgent === 'string') return userAgent;
  if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
    return navigator.userAgent;
  }
  return '';
}

export function detectInAppBrowser(userAgent?: string): InAppBrowser | null {
  const ua = readUserAgent(userAgent);
  if (!ua) return null;
  for (const [name, pattern] of IAB_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  return null;
}

export function isKnownBrokenInAppBrowser(userAgent?: string): boolean {
  return detectInAppBrowser(userAgent) !== null;
}
