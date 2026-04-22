/**
 * ============================================================================
 * MASONRY MEDIA HELPER: Collect and manage media items for Masonry layout
 * ============================================================================
 * 
 * PURPOSE:
 * - Collect all media items (primary, supporting, legacy) with their types
 * - Determine which media should show in Masonry layout
 * - Provide utilities for managing showInMasonry flags
 * 
 * MASONRY PARTICIPATION IS NOW USER-CONTROLLED:
 * - Primary media is NO LONGER auto-included or locked
 * - In Create mode, all media items default to showInMasonry: true (opt-out)
 * - In Edit mode, existing DB values are preserved
 * - Users can toggle any media item on/off for Masonry view
 * - Zero media selections are allowed (nugget won't appear in Masonry)
 * 
 * BACKWARD COMPATIBILITY:
 * - Existing nuggets with showInMasonry: true continue to display normally
 * - Only newly created or edited nuggets use the new opt-in behavior
 * - If showInMasonry is explicitly set (true or false), that value is preserved
 * 
 * ============================================================================
 */

import type { Article, MediaType } from '@/types';
import { classifyArticleMedia, getAllImageUrls } from './mediaClassifier';
import { normalizeImageUrl } from '@/shared/articleNormalization/imageDedup';
import { normalizeMediaOrder } from './mediaOrder';

/**
 * Represents a media item that can be shown in Masonry layout
 */
export interface MasonryMediaItem {
  // Unique identifier for this media item
  id: string; // Format: "primary" | "supporting-{index}" | "legacy-media" | "legacy-image-{index}"
  
  // Media data
  type: MediaType;
  url: string;
  thumbnail?: string;
  
  // Source information
  source: 'primary' | 'supporting' | 'legacy-media' | 'legacy-image';
  
  // Masonry visibility flag
  // All media items (including primary) default to false (opt-in)
  // Users must explicitly select which media appears in Masonry view
  showInMasonry: boolean;

  /** When false, omit from grid card image strip (masonry-only for this asset) */
  showInGrid: boolean;
  
  // Whether this toggle can be changed
  // Primary media is NO LONGER locked - all media can be toggled
  isLocked: boolean;
  
  // Masonry tile title (optional)
  // Displayed as hover caption at bottom of tile in Masonry layout
  // Max 80 characters, single-line, no markdown
  masonryTitle?: string;
  
  // Additional metadata
  previewMetadata?: any;
  filename?: string;
  title?: string;
}

/**
 * Collect all media items from an article for Masonry layout management
 * 
 * Returns an array of all media items with their showInMasonry flags.
 * 
 * MASONRY PARTICIPATION IS NOW USER-CONTROLLED:
 * - Primary media is NO LONGER auto-included or locked
 * - All media items default to showInMasonry: false (opt-in)
 * - Users must explicitly select which media appears in Masonry view
 * 
 * BACKWARD COMPATIBILITY:
 * - Existing nuggets with showInMasonry: true continue to display normally
 * - If showInMasonry is explicitly set (true or false), that value is preserved
 * - Only newly created or edited nuggets use the new opt-in behavior (defaults to false)
 */
export function collectMasonryMediaItems(article: Article): MasonryMediaItem[] {
  const items: MasonryMediaItem[] = [];

  // DEDUPLICATION FIX: Track all included URLs to prevent duplicates across ALL sources
  const includedUrls = new Set<string>();

  // Classify media to get primary and supporting
  const classified = classifyArticleMedia(article);

  // 1. Primary media (NO LONGER auto-included or locked)
  // BACKWARD COMPATIBILITY: Preserve existing showInMasonry values if explicitly set
  if (classified.primaryMedia) {
    const primaryMedia = classified.primaryMedia;
    const normalizedUrl = normalizeImageUrl(primaryMedia.url);

    // Add to tracked URLs
    includedUrls.add(normalizedUrl);

    items.push({
      id: 'primary',
      type: primaryMedia.type,
      url: primaryMedia.url,
      thumbnail: primaryMedia.thumbnail,
      source: 'primary',
      // BACKWARD COMPATIBILITY FIX: Default to TRUE for primary media
      // This ensures existing nuggets (without showInMasonry field) appear in Masonry view
      // Only explicitly set `false` values will hide primary media from Masonry
      showInMasonry: primaryMedia.showInMasonry === false
        ? false  // Respect explicit false
        : true,  // Default to true (backward compatible + sensible default)
      showInGrid: primaryMedia.showInGrid !== false,
      isLocked: false, // Primary media can now be toggled (no longer locked)
      masonryTitle: primaryMedia.masonryTitle, // Optional masonry tile title
      previewMetadata: primaryMedia.previewMetadata,
    });
  }

  // 2. Supporting media (can be toggled)
  // Sort by canonical position before iterating so readers don't depend on
  // upstream array order — matches the contract enforced by getAllImageUrls.
  // DEDUPLICATION FIX: Check against primary media and other supporting items
  if (classified.supportingMedia && classified.supportingMedia.length > 0) {
    const orderedSupporting = normalizeMediaOrder(classified.supportingMedia);
    orderedSupporting.forEach((media, index) => {
      const normalizedUrl = normalizeImageUrl(media.url);

      // Skip if already included (duplicate of primary or earlier supporting item)
      if (includedUrls.has(normalizedUrl)) {
        console.log('[masonryMediaHelper] Skipping duplicate supporting media:', { url: media.url, normalizedUrl });
        return;
      }

      includedUrls.add(normalizedUrl);

      items.push({
        id: `supporting-${index}`,
        type: media.type,
        url: media.url,
        thumbnail: media.thumbnail,
        source: 'supporting',
        showInMasonry: media.showInMasonry !== undefined
          ? media.showInMasonry
          : false, // Default to false for supporting media (backward compatibility)
        showInGrid: media.showInGrid !== false,
        isLocked: false,
        masonryTitle: media.masonryTitle, // Optional masonry tile title
        previewMetadata: media.previewMetadata,
        filename: media.filename,
        title: media.title,
      });
    });
  }

  // 3. Legacy media field (if exists and not already classified as primary)
  // CRITICAL: This is the actual stored media field in the backend
  // masonryTitle must be read from article.media.masonryTitle
  if (article.media) {
    const legacyMedia = article.media;
    const normalizedUrl = normalizeImageUrl(legacyMedia.url);

    // Check if this is already included (as primary or supporting media)
    const isAlreadyIncluded = includedUrls.has(normalizedUrl);

    if (!isAlreadyIncluded) {
      includedUrls.add(normalizedUrl);

      items.push({
        id: 'legacy-media',
        type: legacyMedia.type,
        url: legacyMedia.url,
        thumbnail: legacyMedia.thumbnail_url || legacyMedia.previewMetadata?.imageUrl,
        source: 'legacy-media',
        // BACKWARD COMPATIBILITY FIX: Default to TRUE for legacy media
        // This ensures existing nuggets appear in Masonry view
        showInMasonry: legacyMedia.showInMasonry === false
          ? false  // Respect explicit false
          : true,  // Default to true (backward compatible)
        showInGrid: legacyMedia.showInGrid !== false,
        isLocked: false,
        masonryTitle: legacyMedia.masonryTitle, // CRITICAL: Read masonryTitle from stored media field
        previewMetadata: legacyMedia.previewMetadata,
        filename: legacyMedia.filename,
      });
    } else {
      // If legacy media is the primary media, ensure masonryTitle is preserved
      // Update the primary item with masonryTitle from the stored media field
      const primaryItem = items.find(item => item.id === 'primary');
      if (primaryItem && legacyMedia.masonryTitle !== undefined) {
        primaryItem.masonryTitle = legacyMedia.masonryTitle;
      }
      if (primaryItem && legacyMedia.showInMasonry !== undefined) {
        primaryItem.showInMasonry = legacyMedia.showInMasonry;
      }
      if (primaryItem && legacyMedia.showInGrid !== undefined) {
        primaryItem.showInGrid = legacyMedia.showInGrid;
      }
    }
  }

  // 4. Legacy images array (only include images not already in primary/supporting)
  // PHASE 2B FIX: Use consistent normalizeImageUrl from imageDedup.ts
  if (article.images && article.images.length > 0) {
    article.images.forEach((imageUrl, index) => {
      const normalizedUrl = normalizeImageUrl(imageUrl);
      // Only include if not already in primary/supporting/legacy-media
      if (!includedUrls.has(normalizedUrl)) {
        items.push({
          id: `legacy-image-${index}`,
          type: 'image',
          url: imageUrl,
          thumbnail: imageUrl,
          source: 'legacy-image',
          showInMasonry: false, // Legacy images default to false (backward compatibility)
          showInGrid: true,
          isLocked: false,
        });
        includedUrls.add(normalizedUrl);
      }
    });
  }

  return items;
}

/**
 * Get media items that should be displayed in Masonry layout
 * 
 * Filters the collected media items to only those where showInMasonry === true.
 * 
 * MASONRY PARTICIPATION IS NOW USER-CONTROLLED:
 * - NO fallback to primary media if no items are selected
 * - If no media has showInMasonry: true, returns empty array (nugget won't appear in Masonry)
 * - This allows users to explicitly exclude all media from Masonry view
 * 
 * BACKWARD COMPATIBILITY:
 * - Existing nuggets with showInMasonry: true continue to display normally
 * - Only newly created or edited nuggets use the new opt-in behavior
 */
export function getMasonryVisibleMedia(article: Article): MasonryMediaItem[] {
  const allItems = collectMasonryMediaItems(article);
  
  // Filter to only items with showInMasonry === true
  // NO FALLBACK: If no items are selected, return empty array
  // This allows users to explicitly exclude all media from Masonry view
  const visibleItems = allItems.filter(item => item.showInMasonry === true);
  
  return visibleItems;
}

/** Matches ActionHUD / MasonryAtom “Source” pill resolution for a given media item */
export type MasonrySourceLink = { url: string; label: 'Source' | 'Link' };

export function resolveMasonrySourceLink(
  article: Article,
  mediaItem: MasonryMediaItem | undefined
): MasonrySourceLink | null {
  const primaryExternalLink = article.externalLinks?.find((l) => l.isPrimary);
  if (primaryExternalLink?.url) {
    return { url: primaryExternalLink.url, label: 'Source' };
  }

  const previewUrl = mediaItem?.previewMetadata?.url;

  if (previewUrl && mediaItem?.type !== 'youtube') {
    return { url: previewUrl, label: 'Source' };
  }

  if (mediaItem?.type === 'link' && mediaItem.url) {
    return { url: mediaItem.url, label: 'Source' };
  }

  return null;
}

function findMasonryItemByImageUrl(
  items: MasonryMediaItem[],
  imageUrl: string
): MasonryMediaItem | undefined {
  const normalized = normalizeImageUrl(imageUrl);
  return items.find(
    (item) => item.type === 'image' && normalizeImageUrl(item.url) === normalized
  );
}

/** One entry per lightbox slide URL (same order as `images` passed to ImageLightbox) */
export function buildLightboxSourceLinksForImageUrls(
  article: Article,
  imageUrls: string[]
): Array<MasonrySourceLink | null> {
  const allItems = collectMasonryMediaItems(article);
  return imageUrls.map((url) =>
    resolveMasonrySourceLink(article, findMasonryItemByImageUrl(allItems, url))
  );
}

