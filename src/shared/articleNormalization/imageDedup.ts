/**
 * Image Deduplication Module
 * 
 * PHASE 2: Centralized image deduplication and pruning logic
 * 
 * This module consolidates all image deduplication and pruning logic
 * from the Create + Edit Nugget flows into a single shared helper.
 * 
 * Rules:
 * - NO behavior change unless the intent is explicit in comments.
 * - If behavior is uncertain, preserve existing behavior and log a warning.
 * - Never delete or drop images silently. If an image is removed, log why.
 * - EDIT mode must NEVER lose user images without intent.
 * - CREATE mode should prevent storing exact duplicates, but not remove user-visible choices.
 * - SupportingMedia pruning must only occur when the same URL already exists there.
 */

/**
 * Normalize URL for duplicate detection (case-insensitive, whitespace-trimmed, query params removed)
 * Preserves exact behavior from normalizeArticleInput.ts
 */
export function normalizeImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  try {
    // Remove query params and hash for comparison
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase().trim();
  } catch {
    // If URL parsing fails, just normalize case and trim
    return url.toLowerCase().trim();
  }
}

/**
 * Detect duplicate images based on multiple criteria
 * Preserves exact behavior from normalizeArticleInput.ts
 */
export function detectDuplicateImages(images: string[]): {
  duplicates: Array<{ original: string; normalized: string; type: string }>;
  normalizedPairs: Array<{ original: string; normalized: string }>;
} {
  const duplicates: Array<{ original: string; normalized: string; type: string }> = [];
  const normalizedPairs: Array<{ original: string; normalized: string }> = [];
  const seen = new Map<string, string[]>();

  for (const img of images) {
    if (!img || typeof img !== 'string' || !img.trim()) continue;

    const trimmed = img.trim();
    const lowerCase = trimmed.toLowerCase();
    const normalized = normalizeImageUrl(trimmed);

    normalizedPairs.push({ original: img, normalized: lowerCase });

    // Check case-insensitive match
    if (seen.has(lowerCase)) {
      const existing = seen.get(lowerCase)!;
      if (!existing.includes(trimmed)) {
        duplicates.push({
          original: trimmed,
          normalized: lowerCase,
          type: 'case-insensitive',
        });
        existing.push(trimmed);
      }
    } else {
      seen.set(lowerCase, [trimmed]);
    }

    // Check query params match (same base URL)
    if (normalized !== lowerCase) {
      const baseUrls = Array.from(seen.values()).flat();
      const hasBaseMatch = baseUrls.some(existing => normalizeImageUrl(existing) === normalized && existing !== trimmed);
      if (hasBaseMatch) {
        duplicates.push({
          original: trimmed,
          normalized: normalized,
          type: 'query-params',
        });
      }
    }
  }

  return { duplicates, normalizedPairs };
}

/**
 * Deduplicate images for CREATE mode
 * Matches exact logic from normalizeArticleInput.ts (CREATE mode)
 * - Case-insensitive deduplication
 * - Preserves original casing of first occurrence
 * - Prevents storing exact duplicates
 */
export function dedupeImagesForCreate(images: string[]): {
  deduplicated: string[];
  removed: string[];
  logs: Array<{ action: string; reason: string; url?: string }>;
} {
  const imageMap = new Map<string, string>();
  const removed: string[] = [];
  const logs: Array<{ action: string; reason: string; url?: string }> = [];
  const beforeCount = images.length;

  for (const img of images) {
    if (img && typeof img === 'string' && img.trim()) {
      const normalized = img.toLowerCase().trim();
      if (!imageMap.has(normalized)) {
        imageMap.set(normalized, img); // Keep original casing
      } else {
        // Duplicate detected
        removed.push(img);
        logs.push({
          action: 'removed',
          reason: 'duplicate',
          url: img,
        });
      }
    }
  }

  const deduplicated = Array.from(imageMap.values());
  const afterCount = deduplicated.length;

  if (beforeCount !== afterCount) {
    console.log(`[IMAGE_DEDUP] mode=create, action=removed, reason=duplicate, before=${beforeCount}, after=${afterCount}, removed=${removed.length}`);
  } else if (deduplicated.length > 0) {
    console.log(`[IMAGE_DEDUP] mode=create, action=preserved, reason=none, before=${beforeCount}, after=${afterCount}`);
  }

  return { deduplicated, removed, logs };
}

/**
 * Deduplicate images for EDIT mode
 * Matches exact logic from normalizeArticleInput.ts (EDIT mode)
 * - Checks against existing images
 * - Preserves existing images
 * - Adds new images
 * - NEVER removes images without explicit intent
 */
export function dedupeImagesForEdit(
  existingImages: string[],
  newImages: string[],
  supportingMedia?: any[]
): {
  deduplicated: string[];
  removed: string[];
  movedToSupporting: string[];
  logs: Array<{ action: string; reason: string; url?: string }>;
} {
  const existingImagesSet = new Set(
    existingImages.map((img: string) => 
      img && typeof img === 'string' ? img.toLowerCase().trim() : ''
    ).filter(Boolean)
  );
  
  const imageMap = new Map<string, string>();
  const removed: string[] = [];
  const movedToSupporting: string[] = [];
  const logs: Array<{ action: string; reason: string; url?: string }> = [];
  
  // Build set of image URLs in supportingMedia (for pruning check)
  const supportingMediaImageUrls = new Set<string>();
  if (supportingMedia && supportingMedia.length > 0) {
    for (const item of supportingMedia) {
      if (item.type === 'image' && item.url) {
        const normalized = item.url.toLowerCase().trim();
        supportingMediaImageUrls.add(normalized);
      }
    }
  }
  
  // Combine existing and new images
  const allImages = [...existingImages, ...newImages];
  const beforeCount = allImages.length;
  
  for (const img of allImages) {
    if (img && typeof img === 'string' && img.trim()) {
      const normalized = img.toLowerCase().trim();
      
      // Check if this image already exists in the article
      if (existingImagesSet.has(normalized)) {
        // Keep it - it's an existing image that should remain
        if (!imageMap.has(normalized)) {
          imageMap.set(normalized, img);
          logs.push({
            action: 'preserved',
            reason: 'existing',
            url: img,
          });
        }
      } else if (!imageMap.has(normalized)) {
        // New image, add it
        imageMap.set(normalized, img);
        logs.push({
          action: 'preserved',
          reason: 'new',
          url: img,
        });
      } else {
        // Duplicate in the combined list
        removed.push(img);
        logs.push({
          action: 'removed',
          reason: 'duplicate',
          url: img,
        });
      }
    }
  }
  
  // Prune images that are in supportingMedia (only if URL already exists there)
  const deduplicated = Array.from(imageMap.values());
  const imagesAfterDedup = deduplicated.filter(img => {
    if (!img || typeof img !== 'string') return true;
    const normalized = img.toLowerCase().trim();
    
    // Only remove if the same URL already exists in supportingMedia
    if (supportingMediaImageUrls.has(normalized)) {
      movedToSupporting.push(img);
      logs.push({
        action: 'moved',
        reason: 'supportingMedia',
        url: img,
      });
      return false;
    }
    return true;
  });
  
  const afterCount = imagesAfterDedup.length;
  const totalRemoved = removed.length + movedToSupporting.length;

  if (totalRemoved > 0 || beforeCount !== afterCount) {
    console.log(`[IMAGE_DEDUP] mode=edit, action=${totalRemoved > 0 ? 'removed' : 'preserved'}, reason=${movedToSupporting.length > 0 ? 'supportingMedia' : 'duplicate'}, before=${beforeCount}, after=${afterCount}, removed=${removed.length}, moved=${movedToSupporting.length}`);
  } else if (imagesAfterDedup.length > 0) {
    console.log(`[IMAGE_DEDUP] mode=edit, action=preserved, reason=none, before=${beforeCount}, after=${afterCount}`);
  }

  return {
    deduplicated: imagesAfterDedup,
    removed,
    movedToSupporting,
    logs,
  };
}

