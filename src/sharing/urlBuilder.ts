/**
 * Canonical share URL helpers for phase-1 launch safety.
 *
 * Policy:
 * - Prefer explicit canonical site origin when configured via env.
 * - Fall back to current runtime origin in browser contexts.
 * - Keep output absolute so shared links are stable across apps/platforms.
 */
function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

export function getCanonicalSiteOrigin(): string {
  const envOrigin =
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ||
    (import.meta.env.VITE_SITE_URL as string | undefined);

  if (envOrigin && envOrigin.trim()) {
    return stripTrailingSlash(envOrigin.trim());
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }

  // Last-resort fallback for non-browser contexts.
  return 'https://nuggets.one';
}

export function buildCanonicalShareUrl(pathname: string): string {
  return `${getCanonicalSiteOrigin()}${ensureLeadingSlash(pathname.trim())}`;
}

export function buildArticleShareUrl(articleId: string): string {
  return buildCanonicalShareUrl(`/article/${articleId}`);
}

export function buildCollectionShareUrl(collectionId: string): string {
  return buildCanonicalShareUrl(`/collections/${collectionId}`);
}

