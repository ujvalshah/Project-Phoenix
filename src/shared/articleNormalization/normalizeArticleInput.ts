/**
 * Article Input Normalization
 * 
 * This module extracts ALL normalization logic from Create and Edit pipelines
 * without changing behavior. It preserves all current differences between
 * create vs edit modes exactly as-is.
 * 
 * PHASE 1: EXTRACTION ONLY (NO BEHAVIOR CHANGE)
 * - Preserves all current differences between create vs edit
 * - Preserves all defaults and quirks exactly as-is
 * - Do NOT simplify logic yet
 * - Do NOT unify behavior
 * 
 * ============================================================================
 * PRIMARY MEDIA REBUILD RULE (NON-NEGOTIABLE)
 * ============================================================================
 * 
 * "Primary media is rebuilt ONLY when the source URL changes."
 * 
 * This rule ensures that primary media metadata is refreshed only when the
 * source URL actually changes, preventing accidental overwrites of user edits
 * and preserving YouTube titles and other fetched metadata.
 * 
 * Decision Boundaries:
 * 1. URL Change Detection:
 *    - Compare new primaryUrl with existingMedia.url (normalized, case-insensitive)
 *    - If URLs differ → FULL REBUILD: refresh metadata and rebuild media object
 *    - If URLs match → NO REBUILD: preserve existing media structure
 * 
 * 2. Metadata Override (Same URL):
 *    - If URL is same AND allowMetadataOverride = true:
 *      → Allow user edits to caption/title/masonryTitle
 *    - If URL is same AND allowMetadataOverride = false:
 *      → Preserve existing metadata (YouTube title guard applies)
 * 
 * 3. YouTube Title Guard:
 *    - If allowMetadataOverride = false → preserve YouTube title (existing logic)
 *    - If allowMetadataOverride = true → allow user override intentionally
 * 
 * Implementation:
 * - buildMediaObjectEdit() implements URL change detection
 * - allowMetadataOverride flag tracks user explicit edits (caption/title)
 * - Backend updateArticle() enforces YouTube title guard with flag check
 * 
 * ============================================================================
 * IMAGE PRESERVATION INVARIANT (STRICT ENFORCEMENT)
 * ============================================================================
 * 
 * "No image should ever be removed unless the user explicitly deletes it."
 * 
 * This invariant ensures that images are never lost during normalization.
 * 
 * Implementation:
 * 1. Images in images[] array remain in images[] array - they are never moved
 *    to supportingMedia[] based on masonry selection.
 * 2. Explicit delete operations (marked with explicitDelete=true) are the
 *    ONLY way images are removed from the system.
 * 
 * MASONRY REFACTOR:
 * - showInMasonry is a view flag, NOT a storage transformation
 * - Toggling masonry does NOT move images between arrays
 * - supportingMedia structure remains stable
 * - Images from images[] remain in images[] regardless of masonry selection
 * 
 * ============================================================================
 */

import { detectProviderFromUrl, isImageUrl } from '@/utils/urlUtils';
import { getPrimaryUrl } from '@/utils/processNuggetUrl';
import type { NuggetMedia, Article } from '@/types';
import { normalizeTags } from './normalizeTags';
import {
  detectDuplicateImages,
  dedupeImagesForCreate,
  dedupeImagesForEdit,
  normalizeImageUrl,
} from './imageDedup';
// CATEGORY PHASE-OUT: Removed normalizeCategories import - using normalizeTags directly

/**
 * Input data for normalization
 */
export interface ArticleInputData {
  title: string;
  content: string;
  tags: string[];
  visibility: 'public' | 'private';
  urls: string[];
  detectedLink?: string | null;
  linkMetadata?: NuggetMedia | null;
  imageUrls: string[];
  uploadedImageUrls: string[];
  mediaIds: string[];
  uploadedDocs?: any[];
  customDomain?: string | null;
  masonryMediaItems: any[]; // MasonryMediaItem[]
  customCreatedAt?: string | null;
  isAdmin?: boolean;
  
  // Edit mode specific
  existingImages?: string[];
  existingMediaIds?: string[];
  initialData?: Article;
  existingMedia?: NuggetMedia | null;
  existingSupportingMedia?: any[];
  
  // Image preservation invariant tracking
  imagesBackup?: Set<string>; // Internal field: tracks images promoted from images[] to supportingMedia[]
  explicitlyDeletedImages?: Set<string>; // Internal field: tracks images explicitly deleted by user
  
  // Metadata override flag: true when user explicitly edits caption/title
  // This allows intentional overrides of YouTube titles and other metadata
  allowMetadataOverride?: boolean;
}

/**
 * Options for normalization
 */
export interface NormalizeArticleInputOptions {
  mode: 'create' | 'edit';
  enrichMediaItemIfNeeded?: (mediaItem: any) => Promise<any>;
  classifyArticleMedia?: (article: Article) => { primaryMedia?: any };
}

/**
 * Normalized article output
 */
export interface NormalizedArticleInput {
  title: string;
  content: string;
  excerpt: string;
  readTime: number;
  tags: string[];
  visibility: 'public' | 'private';
  images?: string[];
  mediaIds?: string[];
  documents?: any[];
  media?: NuggetMedia | null;
  supportingMedia?: any[];
  source_type?: string;
  customCreatedAt?: string;
  primaryUrl?: string | null;
  
  // Edit mode specific
  hasEmptyTagsError?: boolean;
  
  // Image preservation invariant tracking (internal, not persisted)
  imagesBackup?: Set<string>; // Images that were promoted from images[] to supportingMedia[]
}

/**
 * Calculate read time from content (200 words per minute)
 * Matches exact formula from CreateNuggetModal.tsx
 */
function calculateReadTime(content: string): number {
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Generate excerpt from content/title (max 150 chars)
 * Matches exact logic from CreateNuggetModal.tsx
 */
function generateExcerpt(content: string, title: string): string {
  const excerptText = content.trim() || title || '';
  return excerptText.length > 150 ? excerptText.substring(0, 150) + '...' : excerptText;
}

// Tag normalization now uses shared utility (normalizeTags from './normalizeTags')

/**
 * ============================================================================
 * IMAGE DEDUPLICATION - PHASE 2 (REFACTORED TO SHARED MODULE)
 * ============================================================================
 * Image deduplication logic has been moved to ./imageDedup.ts
 * Functions are imported and used here to maintain backward compatibility.
 */

/**
 * Write audit log entry to markdown file (Node.js only)
 */
async function writeAuditLogEntry(entry: {
  mode: 'create' | 'edit';
  articleId?: string;
  totalInputImages: number;
  totalOutputImages: number;
  duplicatesDetected: number;
  normalizedPairs: Array<{ original: string; normalized: string }>;
  imagesRemoved: number;
  movedToSupportingMedia: number;
  duplicateTypes: string[];
  editModeEvents?: string[];
  createModeEvents?: string[];
}): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry = `
## ${timestamp} - ${entry.mode.toUpperCase()} Mode

- **Article ID**: ${entry.articleId || 'N/A (new article)'}
- **Input Images**: ${entry.totalInputImages}
- **Output Images**: ${entry.totalOutputImages}
- **Duplicates Detected**: ${entry.duplicatesDetected}
- **Images Removed**: ${entry.imagesRemoved}
- **Duplicate Types**: ${entry.duplicateTypes.join(', ') || 'none'}

${entry.editModeEvents && entry.editModeEvents.length > 0 ? `### Edit Mode Events\n${entry.editModeEvents.map(e => `- ${e}`).join('\n')}\n` : ''}
${entry.createModeEvents && entry.createModeEvents.length > 0 ? `### Create Mode Events\n${entry.createModeEvents.map(e => `- ${e}`).join('\n')}\n` : ''}

${entry.normalizedPairs.length > 0 ? `### Normalized Pairs\n${entry.normalizedPairs.map(p => `- \`${p.original}\` → \`${p.normalized}\``).join('\n')}\n` : ''}

---

`;

  // Try to write to file if in Node.js environment
  if (typeof window === 'undefined' && typeof process !== 'undefined') {
    try {
      // Use dynamic import for Node.js fs module
      const fsModule = await import('fs');
      const pathModule = await import('path');
      const fs = fsModule.default || fsModule;
      const path = pathModule.default || pathModule;
      const logDir = path.join(process.cwd(), 'logs');
      const logFile = path.join(logDir, 'image-dedup-audit.md');

      // Ensure logs directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append to log file
      fs.appendFileSync(logFile, logEntry, 'utf-8');
      console.log(`[IMAGE_DEDUP_AUDIT] ✅ Audit log entry written to ${logFile}`);
      console.log(`[IMAGE_DEDUP_AUDIT] Summary: ${entry.mode} mode | Input: ${entry.totalInputImages} | Output: ${entry.totalOutputImages} | Duplicates: ${entry.duplicatesDetected} | Removed: ${entry.imagesRemoved}`);
    } catch (error) {
      // File writing failed, just log to console
      console.warn('[IMAGE_DEDUP_AUDIT] Failed to write log file (browser environment or file system unavailable):', error);
      // Still log summary to console
      console.log(`[IMAGE_DEDUP_AUDIT] Summary: ${entry.mode} mode | Input: ${entry.totalInputImages} | Output: ${entry.totalOutputImages} | Duplicates: ${entry.duplicatesDetected} | Removed: ${entry.imagesRemoved}`);
    }
  } else {
    // Browser environment - just log summary to console
    console.log(`[IMAGE_DEDUP_AUDIT] Summary: ${entry.mode} mode | Input: ${entry.totalInputImages} | Output: ${entry.totalOutputImages} | Duplicates: ${entry.duplicatesDetected} | Removed: ${entry.imagesRemoved}`);
  }
}

/**
 * Legacy deduplication functions removed - now using imageDedup module
 * These functions are preserved as wrappers for backward compatibility during transition
 */

/**
 * Separate image URLs from regular URLs
 * Matches exact logic from CreateNuggetModal.tsx
 */
function separateImageUrls(urls: string[]): { imageUrls: string[]; linkUrls: string[] } {
  const imageUrls: string[] = [];
  const linkUrls: string[] = [];
  
  for (const url of urls) {
    const urlType = detectProviderFromUrl(url);
    if (urlType === 'image') {
      imageUrls.push(url);
    } else {
      linkUrls.push(url);
    }
  }
  
  return { imageUrls, linkUrls };
}

/**
 * Build media object for CREATE mode
 * Matches exact logic from CreateNuggetModal.tsx lines 1824-1891
 */
async function buildMediaObjectCreate(
  input: ArticleInputData,
  _options: NormalizeArticleInputOptions
): Promise<NuggetMedia | null> {
  const { linkMetadata, urls, detectedLink, customDomain, title, masonryMediaItems } = input;
  const primaryUrl = getPrimaryUrl(urls) || detectedLink || null;
  const primaryItem = masonryMediaItems.find(item => item.source === 'primary');

  // URLs must not be used as titles. If no title exists, leave empty.
  // Title resolution order: 1) User-entered title, 2) Metadata title, 3) Empty string (NOT URL)
  const baseMedia = linkMetadata ? {
    ...linkMetadata,
    previewMetadata: linkMetadata.previewMetadata ? {
      ...linkMetadata.previewMetadata,
      url: linkMetadata.previewMetadata.url || primaryUrl || '',
      siteName: customDomain || linkMetadata.previewMetadata.siteName,
      // Preserve metadata title if present, otherwise use user title (never URL)
      title: linkMetadata.previewMetadata.title?.trim() || title?.trim() || '',
    } : {
      url: primaryUrl || '',
      // User-entered title only (never fallback to URL)
      title: title?.trim() || '',
      siteName: customDomain || undefined,
    }
  } : (primaryUrl ? {
    type: detectProviderFromUrl(primaryUrl),
    url: primaryUrl,
    previewMetadata: {
      url: primaryUrl,
      // User-entered title only (never fallback to URL)
      title: title?.trim() || '',
      siteName: customDomain || undefined,
    }
  } : (customDomain ? {
    // For text nuggets with custom domain, create minimal media object for source badge
    type: 'link' as const,
    url: `https://${customDomain}`,
    previewMetadata: {
      url: `https://${customDomain}`,
      // User-entered title only (never fallback to URL)
      title: title?.trim() || '',
      siteName: customDomain,
    }
  } : (primaryItem && primaryItem.url ? {
    // CRITICAL FIX: For uploaded images (no URL input), create media from primaryItem
    // This ensures the first uploaded image gets saved as media with showInMasonry flag
    type: primaryItem.type,
    url: primaryItem.url,
    thumbnail_url: primaryItem.thumbnail,
    previewMetadata: primaryItem.previewMetadata || {
      url: primaryItem.url,
      imageUrl: primaryItem.url,
      mediaType: 'image',
    },
  } : null)));

  // Apply masonry fields if primary media exists
  // CREATE MODE: Primary media defaults to showInMasonry: true (selected by default)
  // EDIT MODE: Respect stored values (no auto-change)
  if (baseMedia) {
    if (primaryItem) {
      // Use value from masonryMediaItems state (user may have unselected it in Create mode)
      return {
        ...baseMedia,
        showInMasonry: primaryItem.showInMasonry !== undefined ? primaryItem.showInMasonry : true,
        masonryTitle: primaryItem.masonryTitle || undefined,
      };
    } else {
      // CREATE MODE: If primaryItem doesn't exist but baseMedia does, set default to true
      // This ensures primary media is selected by default even if masonryMediaItems state is incomplete
      return {
        ...baseMedia,
        showInMasonry: true,
      };
    }
  }

  return baseMedia;
}

/**
 * Build media object for EDIT mode
 * 
 * ============================================================================
 * PRIMARY MEDIA REBUILD RULE (NON-NEGOTIABLE)
 * ============================================================================
 * 
 * "Primary media is rebuilt ONLY when the source URL changes."
 * 
 * Decision Boundaries:
 * 1. URL Change Detection:
 *    - Compare new primaryUrl with existingMedia.url (normalized)
 *    - If URLs differ → FULL REBUILD: refresh metadata and rebuild media object
 *    - If URLs match → NO REBUILD: preserve existing media structure
 * 
 * 2. Metadata Override (Same URL):
 *    - If URL is same AND allowMetadataOverride = true:
 *      → Allow user edits to caption/title/masonryTitle
 *    - If URL is same AND allowMetadataOverride = false:
 *      → Preserve existing metadata (YouTube title guard applies)
 * 
 * 3. YouTube Title Guard:
 *    - If allowMetadataOverride = false → preserve YouTube title (existing logic)
 *    - If allowMetadataOverride = true → allow user override intentionally
 * 
 * ============================================================================
 */
async function buildMediaObjectEdit(
  input: ArticleInputData,
  options: NormalizeArticleInputOptions
): Promise<NuggetMedia | null | undefined> {
  const { linkMetadata, urls, detectedLink, customDomain, title, masonryMediaItems, existingMedia, initialData, allowMetadataOverride } = input;
  const { enrichMediaItemIfNeeded, classifyArticleMedia } = options;
  const primaryUrl = getPrimaryUrl(urls) || detectedLink || null;

  // ============================================================================
  // STEP 1: URL CHANGE DETECTION
  // ============================================================================
  // Normalize URLs for comparison (case-insensitive, trim whitespace)
  const normalizeUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
      return url.toLowerCase().trim();
    } catch {
      return url.trim();
    }
  };

  const existingUrl = existingMedia?.url ? normalizeUrl(existingMedia.url) : null;
  const newUrl = primaryUrl ? normalizeUrl(primaryUrl) : null;
  const urlChanged = existingUrl !== null && newUrl !== null && existingUrl !== newUrl;
  const urlRemoved = existingUrl !== null && newUrl === null;
  const urlAdded = existingUrl === null && newUrl !== null;

  // ============================================================================
  // STEP 2: URL CHANGE → FULL REBUILD (Rule: Rebuild ONLY when URL changes)
  // ============================================================================
  if (urlChanged || urlAdded) {
    // URL changed or added → FULL REBUILD: refresh metadata and rebuild media object
    if (linkMetadata) {
      // Use fetched metadata (fresh fetch triggered by URL change)
      // URLs must not be used as titles. If no title exists, leave empty.
      return {
        ...linkMetadata,
        previewMetadata: linkMetadata.previewMetadata ? {
          ...linkMetadata.previewMetadata,
          url: linkMetadata.previewMetadata.url || primaryUrl || '',
          siteName: customDomain || linkMetadata.previewMetadata.siteName,
          // Preserve metadata title if present, otherwise use user title (never URL)
          title: linkMetadata.previewMetadata.title?.trim() || title?.trim() || '',
        } : {
          url: primaryUrl || '',
          // User-entered title only (never fallback to URL)
          title: title?.trim() || '',
          siteName: customDomain || undefined,
        }
      };
    } else if (primaryUrl) {
      // Create minimal media object if metadata not available
      // This ensures media field is set even if fetch failed
      // URLs must not be used as titles. If no title exists, leave empty.
      return {
        type: detectProviderFromUrl(primaryUrl),
        url: primaryUrl,
        previewMetadata: {
          url: primaryUrl,
          // User-entered title only (never fallback to URL)
          title: title?.trim() || '',
          siteName: customDomain || undefined,
        }
      };
    }
  }

  // ============================================================================
  // STEP 3: URL REMOVED → CLEAR MEDIA
  // ============================================================================
  if (urlRemoved || (urls.length === 0 && existingUrl !== null)) {
    // URLs were removed, clear media
    return null;
  }

  // ============================================================================
  // STEP 4: SAME URL → CONDITIONAL UPDATE (Metadata Override Logic)
  // ============================================================================
  // If primaryUrl is null but urls exist (all images), don't update media
  if (!primaryUrl && urls.length > 0) {
    return undefined; // Don't update media
  }

  // Same URL: Only update if allowMetadataOverride is true OR masonry fields changed
  if (existingMedia && !urlChanged && !urlAdded) {
    // Same URL: Check if we should allow metadata updates
    const primaryItem = masonryMediaItems.find(item => item.source === 'primary');
    const legacyMediaItem = masonryMediaItems.find(item => item.source === 'legacy-media');
    const mediaItemWithTitle = legacyMediaItem || primaryItem;
    
    if (mediaItemWithTitle && enrichMediaItemIfNeeded) {
      // Enrich media if previewMetadata is missing before updating
      const enrichedMedia = await enrichMediaItemIfNeeded(existingMedia);
      
      // Build update object
      const update: Partial<NuggetMedia> = {
        ...enrichedMedia,
        showInMasonry: mediaItemWithTitle.showInMasonry,
        masonryTitle: mediaItemWithTitle.masonryTitle || undefined,
      };

      // ============================================================================
      // DECISION: Allow metadata override only if flag is set
      // ============================================================================
      if (allowMetadataOverride) {
        // User explicitly edited caption/title → allow override
        // If linkMetadata is provided, merge it (user may have edited title)
        if (linkMetadata && linkMetadata.previewMetadata) {
          return {
            ...enrichedMedia,
            ...linkMetadata,
            previewMetadata: {
              ...enrichedMedia.previewMetadata,
              ...linkMetadata.previewMetadata,
              url: linkMetadata.previewMetadata.url || enrichedMedia.previewMetadata?.url || primaryUrl || '',
              siteName: customDomain || linkMetadata.previewMetadata.siteName || enrichedMedia.previewMetadata?.siteName,
            },
            showInMasonry: mediaItemWithTitle.showInMasonry,
            masonryTitle: mediaItemWithTitle.masonryTitle || undefined,
          } as NuggetMedia;
        }
        // No linkMetadata but override flag set → allow update (masonry fields)
        // Note: YouTube title guard in backend will still check this flag
        return update as NuggetMedia;
      } else {
        // No override flag → preserve existing metadata (especially YouTube titles)
        // Only update masonry fields, preserve previewMetadata.title
        return {
          ...enrichedMedia,
          previewMetadata: {
            ...enrichedMedia.previewMetadata,
            // Preserve existing title if it's a YouTube title (backend guard will enforce)
            title: enrichedMedia.previewMetadata?.title || existingMedia.previewMetadata?.title,
            titleSource: enrichedMedia.previewMetadata?.titleSource || existingMedia.previewMetadata?.titleSource,
            titleFetchedAt: enrichedMedia.previewMetadata?.titleFetchedAt || existingMedia.previewMetadata?.titleFetchedAt,
          },
          showInMasonry: mediaItemWithTitle.showInMasonry,
          masonryTitle: mediaItemWithTitle.masonryTitle || undefined,
        } as NuggetMedia;
      }
    } else if (mediaItemWithTitle && primaryItem && initialData && classifyArticleMedia) {
      // If media doesn't exist yet but we have primary media, create it
      const classified = classifyArticleMedia(initialData);
      if (classified.primaryMedia && enrichMediaItemIfNeeded) {
        const enrichedPrimaryMedia = await enrichMediaItemIfNeeded(classified.primaryMedia);
        return {
          type: enrichedPrimaryMedia.type || classified.primaryMedia.type,
          url: enrichedPrimaryMedia.url || classified.primaryMedia.url,
          thumbnail_url: enrichedPrimaryMedia.thumbnail_url || classified.primaryMedia.thumbnail,
          aspect_ratio: enrichedPrimaryMedia.aspect_ratio || classified.primaryMedia.aspect_ratio,
          previewMetadata: enrichedPrimaryMedia.previewMetadata || classified.primaryMedia.previewMetadata,
          showInMasonry: primaryItem.showInMasonry,
          masonryTitle: primaryItem.masonryTitle || undefined,
        };
      }
    }
  }
  
  return undefined; // Don't update media
}

/**
 * Build supportingMedia array for CREATE mode
 * Matches exact logic from CreateNuggetModal.tsx lines 1894-1945
 *
 * DEDUPLICATION FIX: Ensures no duplicate URLs in the supportingMedia array
 */
async function buildSupportingMediaCreate(
  input: ArticleInputData,
  options: NormalizeArticleInputOptions
): Promise<any[] | undefined> {
  const { masonryMediaItems } = input;
  const { enrichMediaItemIfNeeded } = options;

  // Only process if there are masonry items selected
  if (masonryMediaItems.length === 0) {
    return undefined;
  }

  // DEDUPLICATION FIX: Track URLs to prevent duplicates
  const addedUrls = new Set<string>();
  const normalizeUrl = (url: string) => url.toLowerCase().trim();

  // Process all masonry items except primary (primary goes in media field)
  // DEDUPLICATION FIX: Filter out duplicates during the filter step
  const nonPrimaryItems = masonryMediaItems.filter(item => {
    if (item.source === 'primary' || item.showInMasonry !== true) {
      return false;
    }

    // Check for duplicate URL
    const normalizedUrl = normalizeUrl(item.url);
    if (addedUrls.has(normalizedUrl)) {
      console.log('[normalizeArticleInput] CREATE: Skipping duplicate masonry item:', { url: item.url });
      return false;
    }
    addedUrls.add(normalizedUrl);
    return true;
  });

  if (nonPrimaryItems.length === 0) {
    return undefined;
  }

  // Convert each selected item to supportingMedia format with enrichment
  if (!enrichMediaItemIfNeeded) {
    // If enrichment function not provided, create items without enrichment
    return nonPrimaryItems.map(item => ({
      type: item.type,
      url: item.url,
      thumbnail: item.thumbnail || (item.type === 'image' ? item.url : undefined),
      showInMasonry: item.showInMasonry,
      masonryTitle: item.masonryTitle || undefined,
    }));
  }

  const enrichedItems = await Promise.all(
    nonPrimaryItems.map(async (item) => {
      const baseMedia = {
        type: item.type,
        url: item.url,
        thumbnail: item.thumbnail || (item.type === 'image' ? item.url : undefined),
        showInMasonry: item.showInMasonry,
        masonryTitle: item.masonryTitle || undefined,
      };

      // Enrich with previewMetadata if missing
      const enriched = await enrichMediaItemIfNeeded(baseMedia);

      // Ensure items marked for Masonry have previewMetadata
      if (enriched.showInMasonry && !enriched.previewMetadata && enriched.url) {
        console.warn('[normalizeArticleInput] CREATE MODE: Item marked for Masonry missing previewMetadata - creating minimal metadata', {
          url: enriched.url,
          type: enriched.type,
        });
        enriched.previewMetadata = {
          url: enriched.url,
          imageUrl: enriched.type === 'image' ? enriched.url : undefined,
          mediaType: enriched.type || 'image',
        };
      }

      return enriched;
    })
  );

  return enrichedItems.length > 0 ? enrichedItems : undefined;
}

/**
 * Build supportingMedia array for EDIT mode
 *
 * MASONRY REFACTOR: showInMasonry is a view flag, NOT a storage transformation
 * - Only updates showInMasonry flags on existing supportingMedia items
 * - Does NOT move images from images[] to supportingMedia[]
 * - supportingMedia structure remains stable
 * - Images from images[] remain in images[] regardless of masonry selection
 *
 * DEDUPLICATION FIX: Ensures no duplicate URLs in the final supportingMedia array
 */
async function buildSupportingMediaEdit(
  input: ArticleInputData,
  options: NormalizeArticleInputOptions
): Promise<{ supportingMedia?: any[] }> {
  const { masonryMediaItems, existingSupportingMedia } = input;
  const { enrichMediaItemIfNeeded } = options;

  if (!enrichMediaItemIfNeeded) {
    // If enrichment function not provided, return empty
    return {};
  }

  // CRITICAL: Use normalizeImageUrl (strips query params) for all URL matching.
  // toLowerCase().trim() broke Twitter/URL images (e.g. ?format=jpg) so reorder failed.

  // DEDUPLICATION FIX: Track ALL URLs that have been added to prevent duplicates
  const addedUrls = new Set<string>();

  // First, deduplicate existingSupportingMedia itself (in case it already has duplicates)
  const deduplicatedExisting: any[] = [];
  for (const media of existingSupportingMedia || []) {
    if (media.url) {
      const normalizedUrl = normalizeImageUrl(media.url);
      if (!addedUrls.has(normalizedUrl)) {
        addedUrls.add(normalizedUrl);
        deduplicatedExisting.push(media);
      } else {
        console.log('[normalizeArticleInput] Skipping duplicate in existingSupportingMedia:', { url: media.url });
      }
    }
  }

  // Track which URLs are in the deduplicated existing list
  const existingSupportingUrls = new Set(
    deduplicatedExisting.map(media => media.url ? normalizeImageUrl(media.url) : '').filter(Boolean)
  );

  // Process existing supportingMedia items and update their showInMasonry flags
  // FIX: Match items by URL (normalizeImageUrl) since IDs are now URL-based hashes
  const normalizedSupportingMedia = await Promise.all(
    deduplicatedExisting.map(async (media) => {
      const mediaUrl = media.url;
      const item = mediaUrl
        ? masonryMediaItems.find(item => normalizeImageUrl(item.url) === normalizeImageUrl(mediaUrl))
        : null;

      // Enrich if previewMetadata is missing
      const enriched = await enrichMediaItemIfNeeded(media);

      // TYPE CORRECTION FIX: Correct misclassified types for external image URLs
      // Twitter/X images (pbs.twimg.com) were previously classified as 'link' instead of 'image'
      // This ensures getAllImageUrls includes them from supportingMedia (respecting order)
      const correctedType = mediaUrl && isImageUrl(mediaUrl) ? 'image' : enriched.type;

      // DEBUG: Log type correction
      if (correctedType !== enriched.type) {
        console.log('[TYPE_CORRECTION] Fixed type:', {
          url: mediaUrl?.slice(-40),
          oldType: enriched.type,
          newType: correctedType,
          isImageUrl: isImageUrl(mediaUrl || ''),
        });
      }

      if (item) {
        // Update showInMasonry flag from masonryMediaItems state
        return {
          ...enriched,
          type: correctedType,
          showInMasonry: item.showInMasonry,
          masonryTitle: item.masonryTitle || undefined,
        };
      }

      // Item not in masonryMediaItems - preserve existing showInMasonry value
      return {
        ...enriched,
        type: correctedType,
      };
    })
  );

  // FIX: Also add new items from masonryMediaItems that have showInMasonry: true
  // but aren't in existingSupportingMedia
  // IMPORTANT: Exclude legacy-image source items (from images[] array) - they should NOT be moved to supportingMedia
  // DEDUPLICATION FIX: Also check against addedUrls to prevent duplicates
  const newMasonryItems = masonryMediaItems.filter(item => {
    // Only non-primary items that are selected for masonry
    if (item.source === 'primary' || !item.showInMasonry) return false;

    // IMAGE PRESERVATION INVARIANT: Never move legacy images from images[] to supportingMedia[]
    // Legacy images remain in images[] array regardless of masonry selection
    if (item.source === 'legacy-image' || item.source === 'legacy') return false;

    // Skip if already in existingSupportingMedia or already added
    const itemUrlNormalized = normalizeImageUrl(item.url);
    if (existingSupportingUrls.has(itemUrlNormalized) || addedUrls.has(itemUrlNormalized)) {
      return false;
    }

    return true;
  });

  // Add new masonry items to supportingMedia
  if (newMasonryItems.length > 0) {
    const newItems = await Promise.all(
      newMasonryItems.map(async (item) => {
        const normalizedUrl = normalizeImageUrl(item.url);

        // Double-check to prevent race condition duplicates
        if (addedUrls.has(normalizedUrl)) {
          console.log('[normalizeArticleInput] Skipping duplicate new masonry item:', { url: item.url });
          return null;
        }
        addedUrls.add(normalizedUrl);

        const baseMedia = {
          type: item.type,
          url: item.url,
          thumbnail: item.thumbnail || (item.type === 'image' ? item.url : undefined),
          showInMasonry: item.showInMasonry,
          masonryTitle: item.masonryTitle || undefined,
        };

        // Enrich with previewMetadata if missing
        const enriched = await enrichMediaItemIfNeeded(baseMedia);

        // Ensure items marked for Masonry have previewMetadata
        if (enriched.showInMasonry && !enriched.previewMetadata && enriched.url) {
          enriched.previewMetadata = {
            url: enriched.url,
            imageUrl: enriched.type === 'image' ? enriched.url : undefined,
            mediaType: enriched.type || 'image',
          };
        }

        return enriched;
      })
    );

    // Filter out nulls from duplicate checks
    const validNewItems = newItems.filter(item => item !== null);
    normalizedSupportingMedia.push(...validNewItems);
  }

  // REORDER FIX: Apply user's drag-and-drop reordering from masonryMediaItems
  // This ensures the saved supportingMedia order matches what the user sees in the carousel
  console.log('[REORDER DEBUG] Starting reorder check:', {
    masonryMediaItemsCount: masonryMediaItems.length,
    normalizedSupportingMediaCount: normalizedSupportingMedia.length,
    masonryOrder: masonryMediaItems.map(m => m.url?.slice(-30)),
    supportingOrder: normalizedSupportingMedia.map(m => m.url?.slice(-30)),
  });

  if (masonryMediaItems.length > 0 && normalizedSupportingMedia.length > 0) {
    // Create a map of URL -> media item (normalizeImageUrl so Twitter/URL query params match)
    const mediaByUrl = new Map<string, any>();
    for (const media of normalizedSupportingMedia) {
      if (media.url) {
        mediaByUrl.set(normalizeImageUrl(media.url), media);
      }
    }

    // Reorder based on masonryMediaItems order (which reflects user's drag-and-drop)
    const reorderedMedia: any[] = [];
    const addedToReordered = new Set<string>();

    // First, add items in the order they appear in masonryMediaItems
    for (const item of masonryMediaItems) {
      if (item.source === 'primary') continue; // Skip primary media
      const itemUrlNormalized = normalizeImageUrl(item.url);
      const existingMedia = mediaByUrl.get(itemUrlNormalized);
      if (existingMedia && !addedToReordered.has(itemUrlNormalized)) {
        reorderedMedia.push(existingMedia);
        addedToReordered.add(itemUrlNormalized);
      }
    }

    // Then, add any remaining items that weren't in masonryMediaItems (shouldn't happen, but safe fallback)
    for (const media of normalizedSupportingMedia) {
      if (media.url) {
        const urlNormalized = normalizeImageUrl(media.url);
        if (!addedToReordered.has(urlNormalized)) {
          reorderedMedia.push(media);
        }
      }
    }

    // Use reordered array if it has items
    if (reorderedMedia.length > 0) {
      console.log('[REORDER DEBUG] Reordering applied:', {
        beforeOrder: normalizedSupportingMedia.map(m => m.url?.slice(-30)),
        afterOrder: reorderedMedia.map(m => m.url?.slice(-30)),
      });
      normalizedSupportingMedia.length = 0;
      normalizedSupportingMedia.push(...reorderedMedia);
    }
  } else {
    console.log('[REORDER DEBUG] Skipping reorder - conditions not met');
  }

  return {
    supportingMedia: normalizedSupportingMedia.length > 0 ? normalizedSupportingMedia : undefined,
  };
}

/**
 * Main normalization function
 * Extracts ALL normalization logic from Create and Edit pipelines
 * 
 * ============================================================================
 * TITLE RESOLUTION RULE (NON-NEGOTIABLE)
 * ============================================================================
 * 
 * URLs must not be used as titles. If no title exists, leave empty.
 * 
 * Title resolution order:
 * 1. User-entered title (highest priority)
 * 2. Metadata title (if present)
 * 3. Otherwise → title must be "" (do NOT use URL)
 * 
 * This ensures that article titles never default to the pasted URL.
 * Cards should display content/excerpt even if title is blank.
 */
export async function normalizeArticleInput(
  input: ArticleInputData,
  options: NormalizeArticleInputOptions
): Promise<NormalizedArticleInput> {
  const { mode } = options;
  const { 
    title, 
    content, 
    tags: inputTags, 
    visibility, 
    urls,
    imageUrls: _imageUrls, // Unused - we use separatedImageUrls instead
    uploadedImageUrls,
    mediaIds,
    uploadedDocs,
    customCreatedAt,
    isAdmin,
    existingImages = [],
    existingMediaIds = [],
  } = input;

  // Calculate readTime (same for both modes)
  const readTime = calculateReadTime(content);

  // Generate excerpt (same for both modes)
  const excerpt = generateExcerpt(content, title);

  // Normalize tags
  const tags = normalizeTags(inputTags);
  
  // Validation: tags MUST NOT be empty for both CREATE and EDIT
  // For CREATE: prevent submission (hasEmptyTagsError flag)
  // For EDIT: prevent submission if tags become empty (log warning for existing articles with empty tags)
  const hasEmptyTagsError = tags.length === 0;
  
  // Safety logging: Log if EDIT mode would result in empty tags
  if (mode === 'edit' && hasEmptyTagsError) {
    const existingTags = input.initialData?.tags || [];
    if (existingTags.length > 0) {
      console.warn('[normalizeArticleInput] EDIT MODE: Tags would become empty after normalization', {
        originalTags: existingTags,
        normalizedTags: tags,
        articleId: input.initialData?.id,
      });
    } else {
      // Article already has empty tags - log for audit
      console.warn('[normalizeArticleInput] EDIT MODE: Article already has empty tags', {
        articleId: input.initialData?.id,
        originalTags: existingTags,
      });
    }
  }

  // Separate image URLs from regular URLs (always separate from urls to ensure consistency)
  const { imageUrls: separatedImageUrls } = separateImageUrls(urls);

  // ============================================================================
  // IMAGE DEDUPLICATION - PHASE 2 (USING SHARED MODULE)
  // ============================================================================
  // Capture raw input for audit comparison
  const rawInputImages: string[] = [];
  if (mode === 'create') {
    rawInputImages.push(...separatedImageUrls, ...uploadedImageUrls);
  } else {
    rawInputImages.push(...existingImages, ...separatedImageUrls, ...uploadedImageUrls);
  }

  // Build supportingMedia (EDIT mode only updates flags, no structural changes)
  let supportingMedia: any[] | undefined;
  if (mode === 'create') {
    supportingMedia = await buildSupportingMediaCreate(input, options);
  } else {
    const supportingResult = await buildSupportingMediaEdit(input, options);
    supportingMedia = supportingResult.supportingMedia;
  }

  // Combine and deduplicate images using shared module (different logic for CREATE vs EDIT)
  let allImages: string[];
  let dedupResult: { deduplicated: string[]; removed: string[]; movedToSupporting?: string[]; restored?: string[]; logs: Array<{ action: string; reason: string; url?: string }> };
  
  if (mode === 'create') {
    const allImageUrlsRaw = [...separatedImageUrls, ...uploadedImageUrls];
    dedupResult = dedupeImagesForCreate(allImageUrlsRaw);
    allImages = dedupResult.deduplicated;
  } else {
    const allImageUrlsRaw = [...separatedImageUrls, ...uploadedImageUrls];
    // MASONRY REFACTOR: No longer pruning images based on supportingMedia
    // Images remain in images[] array regardless of masonry selection
    dedupResult = dedupeImagesForEdit(
      existingImages,
      allImageUrlsRaw,
      undefined, // No longer passing supportingMedia for pruning
      undefined, // No longer using imagesBackup
      input.explicitlyDeletedImages
    );
    allImages = dedupResult.deduplicated;

    // REORDER FIX: Also reorder images[] array based on masonryMediaItems order
    // This ensures getAllImageUrls returns images in the correct order even if
    // supportingMedia items have wrong type (e.g., 'link' instead of 'image')
    if (input.masonryMediaItems.length > 0 && allImages.length > 1) {
      const masonryOrder = input.masonryMediaItems
        .filter(item => item.source !== 'primary' && item.type === 'image')
        .map(item => normalizeImageUrl(item.url));

      // Create a map of normalized URL -> original URL
      const imagesByNormalizedUrl = new Map<string, string>();
      for (const img of allImages) {
        imagesByNormalizedUrl.set(normalizeImageUrl(img), img);
      }

      // Reorder based on masonryOrder
      const reorderedImages: string[] = [];
      const addedNormalized = new Set<string>();

      // First, add images in masonryMediaItems order
      for (const normalizedMasonryUrl of masonryOrder) {
        const originalUrl = imagesByNormalizedUrl.get(normalizedMasonryUrl);
        if (originalUrl && !addedNormalized.has(normalizedMasonryUrl)) {
          reorderedImages.push(originalUrl);
          addedNormalized.add(normalizedMasonryUrl);
        }
      }

      // Then, add any remaining images not in masonryMediaItems
      for (const img of allImages) {
        const normalized = normalizeImageUrl(img);
        if (!addedNormalized.has(normalized)) {
          reorderedImages.push(img);
          addedNormalized.add(normalized);
        }
      }

      if (reorderedImages.length > 0) {
        console.log('[IMAGES_REORDER] Applied reorder to images[] array:', {
          beforeOrder: allImages.map(u => u.slice(-30)),
          afterOrder: reorderedImages.map(u => u.slice(-30)),
        });
        allImages = reorderedImages;
      }
    }
  }

  // Fallback behavior: If output differs unexpectedly, preserve original behavior
  const imagesBeforeDedup = mode === 'create' 
    ? [...separatedImageUrls, ...uploadedImageUrls]
    : [...existingImages, ...separatedImageUrls, ...uploadedImageUrls];
  
  // Safety check: If we lost images unexpectedly, log warning and preserve original
  const expectedMinCount = mode === 'edit' ? existingImages.length : 0;
  if (allImages.length < expectedMinCount) {
    console.warn('[IMAGE_DEDUP] Fallback: preserved legacy behavior - unexpected image count reduction', {
      mode,
      before: imagesBeforeDedup.length,
      after: allImages.length,
      expectedMin: expectedMinCount,
    });
    // Fallback: Use original images if we lost existing images in EDIT mode
    if (mode === 'edit' && allImages.length < existingImages.length) {
      allImages = [...existingImages, ...allImages.filter(img => 
        !existingImages.some(existing => existing.toLowerCase().trim() === img.toLowerCase().trim())
      )];
      console.warn('[IMAGE_DEDUP] Fallback: restored existing images to prevent data loss');
    }
  }

  // Merge mediaIds (CREATE: only new, EDIT: merge with existing)
  let finalMediaIds: string[] | undefined;
  if (mode === 'create') {
    finalMediaIds = mediaIds.length > 0 ? mediaIds : undefined;
  } else {
    const allMediaIds = [...existingMediaIds, ...mediaIds];
    finalMediaIds = allMediaIds.length > 0 ? allMediaIds : undefined;
  }

  // Build media object (different logic for CREATE vs EDIT)
  let media: NuggetMedia | null | undefined;
  if (mode === 'create') {
    media = await buildMediaObjectCreate(input, options);
  } else {
    media = await buildMediaObjectEdit(input, options);
  }
  
  // ============================================================================
  // IMAGE DEDUPLICATION AUDIT - PHASE 2 (STRUCTURED LOGGING)
  // ============================================================================
  const finalImages = allImages.length > 0 ? allImages : [];
  const totalInputImages = rawInputImages.length;
  const totalOutputImages = finalImages.length;
  const imagesRemoved = dedupResult.removed.length;
  
  // Detect duplicates in raw input (for audit purposes)
  const duplicateDetection = detectDuplicateImages(rawInputImages);
  const duplicatesDetected = duplicateDetection.duplicates.length;
  
  // Mode-specific audit events
  const editModeEvents: string[] = [];
  const createModeEvents: string[] = [];
  
  if (mode === 'edit') {
    // EDIT-mode specific audit checks
    const existingImagesSet = new Set(
      (existingImages || []).map(img => img && typeof img === 'string' ? img.toLowerCase().trim() : '').filter(Boolean)
    );
    
    // Check which existing images were kept
    const keptExistingImages = finalImages.filter(img => {
      if (!img || typeof img !== 'string') return false;
      return existingImagesSet.has(img.toLowerCase().trim());
    });
    
    if (keptExistingImages.length > 0) {
      editModeEvents.push(`${keptExistingImages.length} existing image(s) implicitly kept: ${keptExistingImages.slice(0, 3).join(', ')}${keptExistingImages.length > 3 ? '...' : ''}`);
    }
    
    // Check if uploaded images override legacy images
    const uploadedSet = new Set(uploadedImageUrls.map(img => img && typeof img === 'string' ? img.toLowerCase().trim() : '').filter(Boolean));
    const overriddenImages = (existingImages || []).filter(img => {
      if (!img || typeof img !== 'string') return false;
      const normalized = img.toLowerCase().trim();
      return uploadedSet.has(normalized) && !finalImages.some(f => f.toLowerCase().trim() === normalized);
    });
    
    if (overriddenImages.length > 0) {
      editModeEvents.push(`${overriddenImages.length} legacy image(s) overridden by uploaded images: ${overriddenImages.slice(0, 3).join(', ')}${overriddenImages.length > 3 ? '...' : ''}`);
    }
  } else {
    // CREATE-mode specific audit checks
    const uploadedSet = new Set(uploadedImageUrls.map(img => img && typeof img === 'string' ? img.toLowerCase().trim() : '').filter(Boolean));
    
    // Check if pasted URL duplicates uploaded image
    const pastedDuplicates = separatedImageUrls.filter(img => {
      if (!img || typeof img !== 'string') return false;
      return uploadedSet.has(img.toLowerCase().trim());
    });
    
    if (pastedDuplicates.length > 0) {
      createModeEvents.push(`${pastedDuplicates.length} pasted URL(s) duplicate uploaded image(s): ${pastedDuplicates.slice(0, 3).join(', ')}${pastedDuplicates.length > 3 ? '...' : ''}`);
    }
    
    // Check if same image appears via URL + masonry
    const masonryImageUrls = (input.masonryMediaItems || [])
      .filter(item => item.type === 'image' && item.url)
      .map(item => item.url.toLowerCase().trim());
    const masonrySet = new Set(masonryImageUrls);
    
    const urlMasonryDuplicates = rawInputImages.filter(img => {
      if (!img || typeof img !== 'string') return false;
      return masonrySet.has(img.toLowerCase().trim());
    });
    
    if (urlMasonryDuplicates.length > 0) {
      createModeEvents.push(`${urlMasonryDuplicates.length} image(s) appear via both URL and masonry: ${urlMasonryDuplicates.slice(0, 3).join(', ')}${urlMasonryDuplicates.length > 3 ? '...' : ''}`);
    }
    
    // Check dedupe prevention
    if (duplicatesDetected > 0) {
      createModeEvents.push(`Deduplication prevented ${duplicatesDetected} duplicate image(s) from being stored`);
    }
  }
  
  // Log audit event if any deduplication occurred
  if (duplicatesDetected > 0 || imagesRemoved > 0 || totalInputImages !== totalOutputImages) {
    const duplicateTypes = [...new Set(duplicateDetection.duplicates.map(d => d.type))];
    
    const auditData = {
      mode,
      articleId: input.initialData?.id,
      totalInputImages,
      totalOutputImages,
      duplicatesDetected,
      normalizedPairs: duplicateDetection.normalizedPairs,
      imagesRemoved,
      movedToSupportingMedia: 0, // Always 0 - kept for backward compatibility with audit logs
      duplicateTypes,
      ...(mode === 'edit' && editModeEvents.length > 0 ? { editModeEvents } : {}),
      ...(mode === 'create' && createModeEvents.length > 0 ? { createModeEvents } : {}),
    };
    
    console.warn('[IMAGE_DEDUP_AUDIT]', auditData);
    
    // Write to log file (async, non-blocking)
    writeAuditLogEntry(auditData).catch(err => {
      console.warn('[IMAGE_DEDUP_AUDIT] Failed to write log entry:', err);
    });
  }

  // Determine source_type (same for both modes)
  const primaryUrl = getPrimaryUrl(urls) || input.detectedLink || null;
  const source_type = (primaryUrl || separatedImageUrls.length > 0) ? 'link' : 'text';

  // CustomCreatedAt handling (same logic, but CREATE sets it, EDIT can reset it)
  let finalCustomCreatedAt: string | undefined;
  if (isAdmin && customCreatedAt) {
    finalCustomCreatedAt = new Date(customCreatedAt).toISOString();
  }

  return {
    title: title.trim(),
    content: content.trim() || '',
    excerpt,
    readTime,
    tags,
    visibility,
    images: allImages.length > 0 ? allImages : undefined,
    mediaIds: finalMediaIds,
    documents: uploadedDocs && uploadedDocs.length > 0 ? uploadedDocs : undefined,
    media,
    supportingMedia,
    source_type,
    customCreatedAt: finalCustomCreatedAt,
    primaryUrl,
    hasEmptyTagsError,
  };
}

