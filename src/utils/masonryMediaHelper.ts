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
 * - All media items default to showInMasonry: false (opt-in)
 * - Users must explicitly select which media appears in Masonry view
 * - Zero media selections are allowed (nugget won't appear in Masonry)
 * 
 * BACKWARD COMPATIBILITY:
 * - Existing nuggets with showInMasonry: true continue to display normally
 * - Only newly created or edited nuggets use the new opt-in behavior
 * - If showInMasonry is explicitly set (true or false), that value is preserved
 * 
 * ============================================================================
 */

import type { Article, PrimaryMedia, SupportingMediaItem, NuggetMedia, MediaType } from '@/types';
import { classifyArticleMedia, getAllImageUrls } from './mediaClassifier';

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
  
  // Classify media to get primary and supporting
  const classified = classifyArticleMedia(article);
  
  // 1. Primary media (NO LONGER auto-included or locked)
  // BACKWARD COMPATIBILITY: Preserve existing showInMasonry values if explicitly set
  if (classified.primaryMedia) {
    const primaryMedia = classified.primaryMedia;
    items.push({
      id: 'primary',
      type: primaryMedia.type,
      url: primaryMedia.url,
      thumbnail: primaryMedia.thumbnail,
      source: 'primary',
      // BACKWARD COMPATIBILITY: Preserve existing value if set, otherwise default to false (opt-in)
      showInMasonry: primaryMedia.showInMasonry !== undefined 
        ? primaryMedia.showInMasonry 
        : false, // Default to false for new opt-in behavior
      isLocked: false, // Primary media can now be toggled (no longer locked)
      masonryTitle: primaryMedia.masonryTitle, // Optional masonry tile title
      previewMetadata: primaryMedia.previewMetadata,
    });
  }
  
  // 2. Supporting media (can be toggled)
  if (classified.supportingMedia && classified.supportingMedia.length > 0) {
    classified.supportingMedia.forEach((media, index) => {
      items.push({
        id: `supporting-${index}`,
        type: media.type,
        url: media.url,
        thumbnail: media.thumbnail,
        source: 'supporting',
        showInMasonry: media.showInMasonry !== undefined 
          ? media.showInMasonry 
          : false, // Default to false for supporting media (backward compatibility)
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
    // Check if this is already included as primary media
    const isAlreadyIncluded = classified.primaryMedia?.url === legacyMedia.url;
    
    if (!isAlreadyIncluded) {
      items.push({
        id: 'legacy-media',
        type: legacyMedia.type,
        url: legacyMedia.url,
        thumbnail: legacyMedia.thumbnail_url || legacyMedia.previewMetadata?.imageUrl,
        source: 'legacy-media',
        showInMasonry: legacyMedia.showInMasonry !== undefined 
          ? legacyMedia.showInMasonry 
          : false, // Default to false for legacy media (backward compatibility)
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
    }
  }
  
  // 4. Legacy images array (only include images not already in primary/supporting)
  if (article.images && article.images.length > 0) {
    const allImageUrls = getAllImageUrls(article);
    const includedUrls = new Set(
      items.map(item => item.url.toLowerCase().trim())
    );
    
    article.images.forEach((imageUrl, index) => {
      const normalizedUrl = imageUrl.toLowerCase().trim();
      // Only include if not already in primary/supporting/legacy-media
      if (!includedUrls.has(normalizedUrl)) {
        items.push({
          id: `legacy-image-${index}`,
          type: 'image',
          url: imageUrl,
          thumbnail: imageUrl,
          source: 'legacy-image',
          showInMasonry: false, // Legacy images default to false (backward compatibility)
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
  return allItems.filter(item => item.showInMasonry === true);
}

