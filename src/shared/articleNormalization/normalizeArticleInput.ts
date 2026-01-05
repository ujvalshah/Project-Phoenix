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
 */

import { detectProviderFromUrl } from '@/utils/urlUtils';
import { getPrimaryUrl } from '@/utils/processNuggetUrl';
import type { NuggetMedia, Article } from '@/types';
import { normalizeTags } from './normalizeTags';
import { 
  detectDuplicateImages, 
  dedupeImagesForCreate, 
  dedupeImagesForEdit 
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
- **Moved to Supporting Media**: ${entry.movedToSupportingMedia}
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
      console.log(`[IMAGE_DEDUP_AUDIT] Summary: ${entry.mode} mode | Input: ${entry.totalInputImages} | Output: ${entry.totalOutputImages} | Duplicates: ${entry.duplicatesDetected} | Removed: ${entry.imagesRemoved} | Moved to supportingMedia: ${entry.movedToSupportingMedia}`);
    } catch (error) {
      // File writing failed, just log to console
      console.warn('[IMAGE_DEDUP_AUDIT] Failed to write log file (browser environment or file system unavailable):', error);
      // Still log summary to console
      console.log(`[IMAGE_DEDUP_AUDIT] Summary: ${entry.mode} mode | Input: ${entry.totalInputImages} | Output: ${entry.totalOutputImages} | Duplicates: ${entry.duplicatesDetected} | Removed: ${entry.imagesRemoved} | Moved to supportingMedia: ${entry.movedToSupportingMedia}`);
    }
  } else {
    // Browser environment - just log summary to console
    console.log(`[IMAGE_DEDUP_AUDIT] Summary: ${entry.mode} mode | Input: ${entry.totalInputImages} | Output: ${entry.totalOutputImages} | Duplicates: ${entry.duplicatesDetected} | Removed: ${entry.imagesRemoved} | Moved to supportingMedia: ${entry.movedToSupportingMedia}`);
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
  options: NormalizeArticleInputOptions
): Promise<NuggetMedia | null> {
  const { linkMetadata, urls, detectedLink, customDomain, title, masonryMediaItems } = input;
  const primaryUrl = getPrimaryUrl(urls) || detectedLink || null;
  const primaryItem = masonryMediaItems.find(item => item.source === 'primary');

  const baseMedia = linkMetadata ? {
    ...linkMetadata,
    previewMetadata: linkMetadata.previewMetadata ? {
      ...linkMetadata.previewMetadata,
      url: linkMetadata.previewMetadata.url || primaryUrl || '',
      siteName: customDomain || linkMetadata.previewMetadata.siteName,
    } : {
      url: primaryUrl || '',
      title: title,
      siteName: customDomain || undefined,
    }
  } : (primaryUrl ? {
    type: detectProviderFromUrl(primaryUrl),
    url: primaryUrl,
    previewMetadata: {
      url: primaryUrl,
      title: title,
      siteName: customDomain || undefined,
    }
  } : (customDomain ? {
    // For text nuggets with custom domain, create minimal media object for source badge
    type: 'link' as const,
    url: `https://${customDomain}`,
    previewMetadata: {
      url: `https://${customDomain}`,
      title: title,
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
 * Matches exact logic from CreateNuggetModal.tsx lines 1330-1363
 */
async function buildMediaObjectEdit(
  input: ArticleInputData,
  options: NormalizeArticleInputOptions
): Promise<NuggetMedia | null | undefined> {
  const { linkMetadata, urls, detectedLink, customDomain, title, masonryMediaItems, existingMedia, initialData } = input;
  const { enrichMediaItemIfNeeded, classifyArticleMedia } = options;
  const primaryUrl = getPrimaryUrl(urls) || detectedLink || null;

  // CRITICAL: Always update media if URLs exist or were changed
  // This ensures media appears after adding URL via Edit
  if (primaryUrl) {
    if (linkMetadata) {
      // Use fetched metadata
      return {
        ...linkMetadata,
        previewMetadata: linkMetadata.previewMetadata ? {
          ...linkMetadata.previewMetadata,
          url: linkMetadata.previewMetadata.url || primaryUrl || '',
          siteName: customDomain || linkMetadata.previewMetadata.siteName,
        } : {
          url: primaryUrl || '',
          title: title,
          siteName: customDomain || undefined,
        }
      };
    } else {
      // Create minimal media object if metadata not available
      // This ensures media field is set even if fetch failed
      return {
        type: detectProviderFromUrl(primaryUrl),
        url: primaryUrl,
        previewMetadata: {
          url: primaryUrl,
          title: title,
          siteName: customDomain || undefined,
        }
      };
    }
  } else if (urls.length === 0) {
    // URLs were removed, clear media
    return null;
  }
  // If primaryUrl is null but urls exist (all images), don't update media
  
  // Apply masonry fields from masonryMediaItems
  if (masonryMediaItems.length > 0 && existingMedia && enrichMediaItemIfNeeded) {
    const primaryItem = masonryMediaItems.find(item => item.source === 'primary');
    const legacyMediaItem = masonryMediaItems.find(item => item.source === 'legacy-media');
    const mediaItemWithTitle = legacyMediaItem || primaryItem;
    
    if (mediaItemWithTitle && existingMedia) {
      // Enrich media if previewMetadata is missing before updating
      const enrichedMedia = await enrichMediaItemIfNeeded(existingMedia);
      // Update the media field with masonryTitle and showInMasonry
      return {
        ...enrichedMedia,
        showInMasonry: mediaItemWithTitle.showInMasonry,
        masonryTitle: mediaItemWithTitle.masonryTitle || undefined,
      };
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

  const supportingItems: any[] = [];

  // Process all masonry items except primary (primary goes in media field)
  const nonPrimaryItems = masonryMediaItems.filter(
    item => item.source !== 'primary' && item.showInMasonry === true
  );

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

  supportingItems.push(...enrichedItems);

  return supportingItems.length > 0 ? supportingItems : undefined;
}

/**
 * Build supportingMedia array for EDIT mode
 * Matches exact logic from CreateNuggetModal.tsx lines 1470-1613
 */
async function buildSupportingMediaEdit(
  input: ArticleInputData,
  options: NormalizeArticleInputOptions
): Promise<{ supportingMedia?: any[]; imagesToRemove?: Set<string> }> {
  const { masonryMediaItems, existingSupportingMedia, initialData } = input;
  const { enrichMediaItemIfNeeded } = options;
  
  if (masonryMediaItems.length === 0) {
    return {};
  }
  
  const normalizedSupportingMedia: any[] = [];
  
  if (!enrichMediaItemIfNeeded) {
    // If enrichment function not provided, return empty
    return {};
  }
  
  // 1. Process existing supportingMedia (if any)
  if (existingSupportingMedia && existingSupportingMedia.length > 0) {
    const enrichedExisting = await Promise.all(
      existingSupportingMedia.map(async (media, index) => {
        const item = masonryMediaItems.find(item => item.id === `supporting-${index}`);
        if (item) {
          // Enrich if previewMetadata is missing
          const enriched = await enrichMediaItemIfNeeded(media);
          return {
            ...enriched,
            showInMasonry: item.showInMasonry,
            masonryTitle: item.masonryTitle || undefined,
          };
        }
        // Also enrich items not in masonryMediaItems (preserve existing behavior)
        return await enrichMediaItemIfNeeded(media);
      })
    );
    normalizedSupportingMedia.push(...enrichedExisting);
  }
  
  // 2. Normalize images from images array that are selected for masonry
  const legacyImageItems = masonryMediaItems.filter(item => item.source === 'legacy-image');
  
  if (legacyImageItems.length > 0) {
    const enrichedLegacyImages = await Promise.all(
      legacyImageItems.map(async (item) => {
        const baseMedia = {
          type: 'image' as const,
          url: item.url,
          thumbnail: item.thumbnail || item.url,
          showInMasonry: item.showInMasonry,
          masonryTitle: item.masonryTitle || undefined,
        };
        
        const enriched = await enrichMediaItemIfNeeded(baseMedia);
        
        if (enriched.showInMasonry && !enriched.previewMetadata && enriched.url) {
          console.warn('[normalizeArticleInput] STEP 3 FIX: Item marked for Masonry missing previewMetadata - creating minimal metadata', {
            url: enriched.url,
            type: enriched.type,
          });
          enriched.previewMetadata = {
            url: enriched.url,
            imageUrl: enriched.url,
            mediaType: 'image',
          };
        }
        
        return enriched;
      })
    );
    
    normalizedSupportingMedia.push(...enrichedLegacyImages);
  }
  
  // 3. Also process other masonry items that might need normalization
  const otherSupportingItems = masonryMediaItems.filter(
    item => item.source === 'supporting' && 
    !normalizedSupportingMedia.some(existing => existing.url === item.url)
  );
  
  if (otherSupportingItems.length > 0) {
    const enrichedOther = await Promise.all(
      otherSupportingItems.map(async (item) => {
        const baseMedia = {
          type: item.type,
          url: item.url,
          thumbnail: item.thumbnail,
          showInMasonry: item.showInMasonry,
          masonryTitle: item.masonryTitle || undefined,
        };
        
        const enriched = await enrichMediaItemIfNeeded(baseMedia);
        
        if (enriched.showInMasonry && !enriched.previewMetadata && enriched.url) {
          console.warn('[normalizeArticleInput] STEP 3 FIX: Item marked for Masonry missing previewMetadata - creating minimal metadata', {
            url: enriched.url,
            type: enriched.type,
          });
          enriched.previewMetadata = {
            url: enriched.url,
            mediaType: enriched.type || 'link',
          };
        }
        
        return enriched;
      })
    );
    
    normalizedSupportingMedia.push(...enrichedOther);
  }
  
  // Build set of image URLs that should be removed from images array
  const imagesToRemove = new Set(
    normalizedSupportingMedia
      .filter(item => item.type === 'image' && item.url)
      .map(item => item.url.toLowerCase().trim())
  );
  
  return {
    supportingMedia: normalizedSupportingMedia.length > 0 ? normalizedSupportingMedia : undefined,
    imagesToRemove,
  };
}

/**
 * Main normalization function
 * Extracts ALL normalization logic from Create and Edit pipelines
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
    imageUrls,
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

  // Build supportingMedia first (needed for EDIT mode pruning)
  let supportingMedia: any[] | undefined;
  let imagesToRemove: Set<string> | undefined;
  if (mode === 'create') {
    supportingMedia = await buildSupportingMediaCreate(input, options);
  } else {
    const supportingResult = await buildSupportingMediaEdit(input, options);
    supportingMedia = supportingResult.supportingMedia;
    imagesToRemove = supportingResult.imagesToRemove;
  }

  // Combine and deduplicate images using shared module (different logic for CREATE vs EDIT)
  let allImages: string[];
  let dedupResult: { deduplicated: string[]; removed: string[]; movedToSupporting?: string[]; logs: Array<{ action: string; reason: string; url?: string }> };
  
  if (mode === 'create') {
    const allImageUrlsRaw = [...separatedImageUrls, ...uploadedImageUrls];
    dedupResult = dedupeImagesForCreate(allImageUrlsRaw);
    allImages = dedupResult.deduplicated;
  } else {
    const allImageUrlsRaw = [...separatedImageUrls, ...uploadedImageUrls];
    dedupResult = dedupeImagesForEdit(existingImages, allImageUrlsRaw, supportingMedia);
    allImages = dedupResult.deduplicated;
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
  const movedToSupportingMedia = dedupResult.movedToSupporting?.length || 0;
  
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
    
    // Check images moved to supportingMedia
    if (movedToSupportingMedia > 0) {
      editModeEvents.push(`${movedToSupportingMedia} image(s) removed from images array (moved to supportingMedia)`);
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
  
  // Log audit event if any deduplication or pruning occurred
  if (duplicatesDetected > 0 || imagesRemoved > 0 || movedToSupportingMedia > 0 || totalInputImages !== totalOutputImages) {
    const duplicateTypes = [...new Set(duplicateDetection.duplicates.map(d => d.type))];
    
    const auditData = {
      mode,
      articleId: input.initialData?.id,
      totalInputImages,
      totalOutputImages,
      duplicatesDetected,
      normalizedPairs: duplicateDetection.normalizedPairs,
      imagesRemoved,
      movedToSupportingMedia,
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

