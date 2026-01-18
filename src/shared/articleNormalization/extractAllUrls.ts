/**
 * URL Extraction Module
 *
 * Aggregates ALL URLs from an article for display in "Detected Links" section.
 * This ensures users can see and manage all URLs associated with their nugget.
 *
 * Sources checked:
 * - primaryMedia.url
 * - supportingMedia[].url
 * - media.url (legacy)
 * - media.previewMetadata.url (legacy)
 * - images[] array
 *
 * Deduplication is performed using normalized URLs (case-insensitive, no query params).
 */

import type { Article } from '@/types';
import { normalizeImageUrl } from './imageDedup';

/**
 * Source types for extracted URLs
 */
export type ExtractedUrlSource =
  | 'primaryMedia'
  | 'supportingMedia'
  | 'media'
  | 'media.previewMetadata'
  | 'images';

/**
 * Extracted URL with source information
 */
export interface ExtractedUrl {
  /** The original URL */
  url: string;
  /** Where the URL was found */
  source: ExtractedUrlSource;
  /** Human-readable label for the source */
  sourceLabel: string;
  /** Index in array (for supportingMedia, images) */
  index?: number;
  /** Whether this is a Cloudinary URL */
  isCloudinary: boolean;
}

/**
 * Check if a URL is from Cloudinary
 */
function isCloudinaryUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
}

/**
 * Determine a human-readable label for the source
 */
function getSourceLabel(source: ExtractedUrlSource, index?: number, isCloudinary?: boolean): string {
  const cloudinarySuffix = isCloudinary ? ' (Uploaded)' : '';

  switch (source) {
    case 'primaryMedia':
      return `Primary Media${cloudinarySuffix}`;
    case 'supportingMedia':
      return `Supporting Media #${(index ?? 0) + 1}${cloudinarySuffix}`;
    case 'media':
      return `Media URL${cloudinarySuffix}`;
    case 'media.previewMetadata':
      return 'Preview Metadata';
    case 'images':
      return `Image #${(index ?? 0) + 1}${cloudinarySuffix}`;
    default:
      return 'Unknown Source';
  }
}

/**
 * Extract all URLs from an article
 *
 * @param article - The article to extract URLs from
 * @returns Array of extracted URLs with source information, deduplicated
 */
export function extractAllUrls(article: Article | null | undefined): ExtractedUrl[] {
  if (!article) return [];

  const urls: ExtractedUrl[] = [];
  const seenNormalizedUrls = new Set<string>();

  /**
   * Helper to add a URL if not already seen
   */
  const addUrl = (
    url: string | undefined | null,
    source: ExtractedUrlSource,
    index?: number
  ): void => {
    if (!url || typeof url !== 'string' || !url.trim()) return;

    const trimmedUrl = url.trim();
    const normalizedUrl = normalizeImageUrl(trimmedUrl);

    // Skip if already seen
    if (seenNormalizedUrls.has(normalizedUrl)) {
      return;
    }
    seenNormalizedUrls.add(normalizedUrl);

    const cloudinary = isCloudinaryUrl(trimmedUrl);

    urls.push({
      url: trimmedUrl,
      source,
      sourceLabel: getSourceLabel(source, index, cloudinary),
      index,
      isCloudinary: cloudinary,
    });
  };

  // 1. Primary media (highest priority)
  if (article.primaryMedia?.url) {
    addUrl(article.primaryMedia.url, 'primaryMedia');
  }

  // 2. Supporting media array
  if (article.supportingMedia && Array.isArray(article.supportingMedia)) {
    article.supportingMedia.forEach((media, index) => {
      if (media?.url) {
        addUrl(media.url, 'supportingMedia', index);
      }
    });
  }

  // 3. Legacy media field
  if (article.media?.url) {
    addUrl(article.media.url, 'media');
  }

  // 4. Legacy media preview metadata
  if (article.media?.previewMetadata?.url) {
    addUrl(article.media.previewMetadata.url, 'media.previewMetadata');
  }

  // 5. Legacy images array
  if (article.images && Array.isArray(article.images)) {
    article.images.forEach((imgUrl, index) => {
      addUrl(imgUrl, 'images', index);
    });
  }

  return urls;
}

/**
 * Filter extracted URLs to exclude those already in external links
 *
 * @param extractedUrls - URLs extracted from article
 * @param externalLinks - Existing external links
 * @returns Filtered URLs not already in external links
 */
export function filterExistingExternalLinks(
  extractedUrls: ExtractedUrl[],
  externalLinks: Array<{ url: string }> | undefined | null
): ExtractedUrl[] {
  if (!externalLinks || externalLinks.length === 0) {
    return extractedUrls;
  }

  const externalUrlsNormalized = new Set(
    externalLinks
      .filter((link) => link?.url)
      .map((link) => normalizeImageUrl(link.url))
  );

  return extractedUrls.filter(
    (extracted) => !externalUrlsNormalized.has(normalizeImageUrl(extracted.url))
  );
}

/**
 * Get count of URLs by source type
 *
 * @param extractedUrls - URLs extracted from article
 * @returns Object with count per source type
 */
export function getUrlCountsBySource(
  extractedUrls: ExtractedUrl[]
): Record<ExtractedUrlSource, number> {
  const counts: Record<ExtractedUrlSource, number> = {
    primaryMedia: 0,
    supportingMedia: 0,
    media: 0,
    'media.previewMetadata': 0,
    images: 0,
  };

  for (const url of extractedUrls) {
    counts[url.source]++;
  }

  return counts;
}
