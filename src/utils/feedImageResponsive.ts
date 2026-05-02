/**
 * Feed thumbnail responsive images (TASK-023).
 *
 * Transformable: Cloudinary **image/upload** URLs where we can prepend width transforms.
 * Non-transformable: YouTube CDN, OG/unfurl hosts, `/image/fetch/`, URLs with existing
 * transformation chains after `upload/`, non-HTTP(S), or parse failures — callers keep plain `src`.
 */

import { FEED_CARD_GRID_CELL_IMAGE_SIZES, FEED_CARD_HERO_IMAGE_SIZES } from '@/constants/feedImageLayout';

/** Width descriptors aligned with `sizes` in feedImageLayout (logical px; DPR handled by browser). */
export const FEED_IMAGE_SRCSET_WIDTHS = [320, 480, 640, 960] as const;

export type FeedImageResponsive = {
  src: string;
  srcSet?: string;
  /** True when every descriptor was derived from Cloudinary width transforms */
  usesResponsiveDerivatives: boolean;
};

function isCloudinaryImageUploadUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith('http')) return false;
    if (!u.hostname.includes('cloudinary.com')) return false;
    return u.pathname.includes('/image/upload/');
  } catch {
    return false;
  }
}

/**
 * Insert Cloudinary transformation immediately after `/image/upload/`.
 * Returns null if the URL already has a transformation segment (comma in first path segment)
 * or if parsing fails.
 */
export function cloudinaryImageUrlWithMaxDimension(url: string, maxWidth: number): string | null {
  if (!isCloudinaryImageUploadUrl(url)) return null;
  try {
    const u = new URL(url);
    const path = u.pathname;
    const marker = '/image/upload/';
    const idx = path.indexOf(marker);
    if (idx === -1) return null;

    const afterUpload = path.slice(idx + marker.length);
    const firstSegment = afterUpload.split('/')[0] ?? '';
    if (firstSegment.includes(',')) {
      return null;
    }

    const transform = `w_${maxWidth},c_limit,q_auto,f_auto`;
    const newPath = path.slice(0, idx + marker.length) + transform + '/' + afterUpload;
    u.pathname = newPath;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Build `src` + optional `srcSet` for feed `<img>` elements.
 * Falls back to `originalUrl` only when Cloudinary derivatives cannot be built.
 */
export function buildFeedImageResponsiveProps(originalUrl: string): FeedImageResponsive {
  const widths = FEED_IMAGE_SRCSET_WIDTHS;
  const descriptorParts: string[] = [];

  for (const w of widths) {
    const variant = cloudinaryImageUrlWithMaxDimension(originalUrl, w);
    if (!variant) {
      return {
        src: originalUrl,
        usesResponsiveDerivatives: false,
      };
    }
    descriptorParts.push(`${variant} ${w}w`);
  }

  const largest = cloudinaryImageUrlWithMaxDimension(originalUrl, widths[widths.length - 1]);
  return {
    src: largest ?? originalUrl,
    srcSet: descriptorParts.join(', '),
    usesResponsiveDerivatives: true,
  };
}
