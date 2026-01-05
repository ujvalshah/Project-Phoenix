/**
 * Test Suite: normalizeArticleInput Behavior Parity Audit
 * 
 * PHASE = TEST ONLY (no functional rewrites)
 * 
 * This test suite verifies that the new shared function `normalizeArticleInput`
 * produces the SAME output as the legacy CREATE mode pipeline in CreateNuggetModal
 * with zero behavior changes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use node environment for these tests (no DOM needed)
// @vitest-environment node
import { normalizeArticleInput } from '../normalizeArticleInput';
import type { ArticleInputData, NormalizedArticleInput } from '../normalizeArticleInput';
import type { NuggetMedia, MasonryMediaItem } from '@/types';
import { detectProviderFromUrl } from '@/utils/urlUtils';
import { getPrimaryUrl } from '@/utils/processNuggetUrl';

/**
 * Legacy CREATE mode normalization logic (reconstructed from comments)
 * This replicates the exact behavior that was in CreateNuggetModal.tsx before refactoring
 */
async function legacyCreateNormalization(
  input: ArticleInputData,
  enrichMediaItemIfNeeded?: (mediaItem: any) => Promise<any>
): Promise<NormalizedArticleInput> {
  const {
    title,
    content,
    categories,
    visibility,
    urls,
    detectedLink,
    linkMetadata,
    imageUrls,
    uploadedImageUrls,
    mediaIds,
    uploadedDocs,
    customDomain,
    masonryMediaItems,
    customCreatedAt,
    isAdmin,
  } = input;

  // 1. Calculate readTime (200 words per minute)
  const wordCount = content.trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  // 2. Generate excerpt (max 150 chars)
  const excerptText = content.trim() || title || '';
  const excerpt = excerptText.length > 150 ? excerptText.substring(0, 150) + '...' : excerptText;

  // 3. Normalize tags (filter empty)
  const tags = categories.filter((tag): tag is string => 
    typeof tag === 'string' && tag.trim().length > 0
  );
  const hasEmptyTagsError = tags.length === 0;

  // 4. Separate image URLs from regular URLs
  const separatedImageUrls: string[] = [];
  const linkUrls: string[] = [];
  for (const url of urls) {
    const urlType = detectProviderFromUrl(url);
    if (urlType === 'image') {
      separatedImageUrls.push(url);
    } else {
      linkUrls.push(url);
    }
  }

  // 5. Deduplicate images (CREATE mode - case-insensitive)
  const allImageUrlsRaw = [...separatedImageUrls, ...uploadedImageUrls];
  const imageMap = new Map<string, string>();
  for (const img of allImageUrlsRaw) {
    if (img && typeof img === 'string' && img.trim()) {
      const normalized = img.toLowerCase().trim();
      if (!imageMap.has(normalized)) {
        imageMap.set(normalized, img); // Keep original casing
      }
    }
  }
  const allImages = Array.from(imageMap.values());

  // 6. MediaIds (CREATE: only new)
  const finalMediaIds = mediaIds.length > 0 ? mediaIds : undefined;

  // 7. Build media object (CREATE mode logic from lines 1824-1891)
  const primaryUrl = getPrimaryUrl(urls) || detectedLink || null;
  const primaryItem = masonryMediaItems.find(item => item.source === 'primary');

  let media: NuggetMedia | null = null;

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
    // For uploaded images (no URL input), create media from primaryItem
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
  // CREATE MODE: Primary media defaults to showInMasonry: true
  if (baseMedia) {
    if (primaryItem) {
      media = {
        ...baseMedia,
        showInMasonry: primaryItem.showInMasonry !== undefined ? primaryItem.showInMasonry : true,
        masonryTitle: primaryItem.masonryTitle || undefined,
      };
    } else {
      // CREATE MODE: If primaryItem doesn't exist but baseMedia does, set default to true
      media = {
        ...baseMedia,
        showInMasonry: true,
      };
    }
  } else {
    media = baseMedia;
  }

  // 8. Build supportingMedia (CREATE mode logic from lines 1894-1945)
  let supportingMedia: any[] | undefined;
  if (masonryMediaItems.length > 0) {
    const nonPrimaryItems = masonryMediaItems.filter(
      item => item.source !== 'primary' && item.showInMasonry === true
    );

    if (nonPrimaryItems.length > 0) {
      if (enrichMediaItemIfNeeded) {
        const enrichedItems = await Promise.all(
          nonPrimaryItems.map(async (item) => {
            const baseMedia = {
              type: item.type,
              url: item.url,
              thumbnail: item.thumbnail || (item.type === 'image' ? item.url : undefined),
              showInMasonry: item.showInMasonry,
              masonryTitle: item.masonryTitle || undefined,
            };

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
        supportingMedia = enrichedItems;
      } else {
        supportingMedia = nonPrimaryItems.map(item => ({
          type: item.type,
          url: item.url,
          thumbnail: item.thumbnail || (item.type === 'image' ? item.url : undefined),
          showInMasonry: item.showInMasonry,
          masonryTitle: item.masonryTitle || undefined,
        }));
      }
    }
  }

  // 9. Determine source_type
  const source_type = (primaryUrl || separatedImageUrls.length > 0) ? 'link' : 'text';

  // 10. CustomCreatedAt handling
  let finalCustomCreatedAt: string | undefined;
  if (isAdmin && customCreatedAt) {
    finalCustomCreatedAt = new Date(customCreatedAt).toISOString();
  }

  return {
    title: title.trim(),
    content: content.trim() || '',
    excerpt,
    readTime,
    categories,
    tags,
    visibility,
    images: allImages.length > 0 ? allImages : undefined,
    mediaIds: finalMediaIds,
    documents: uploadedDocs && uploadedDocs.length > 0 ? uploadedDocs : undefined,
    media,
    supportingMedia,
    source_type,
    customCreatedAt: finalCustomCreatedAt,
    hasEmptyTagsError,
  };
}

/**
 * Deep equality comparison helper with detailed diff reporting
 */
function deepEqualWithDiff(
  actual: any,
  expected: any,
  path: string = ''
): { equal: boolean; diff?: string } {
  if (actual === expected) {
    return { equal: true };
  }

  if (actual === null || expected === null) {
    return {
      equal: false,
      diff: `At ${path}: actual is ${actual}, expected is ${expected}`
    };
  }

  if (typeof actual !== typeof expected) {
    return {
      equal: false,
      diff: `At ${path}: type mismatch - actual is ${typeof actual}, expected is ${typeof expected}`
    };
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return {
        equal: false,
        diff: `At ${path}: array length mismatch - actual has ${actual.length} items, expected has ${expected.length}`
      };
    }
    for (let i = 0; i < actual.length; i++) {
      const result = deepEqualWithDiff(actual[i], expected[i], `${path}[${i}]`);
      if (!result.equal) {
        return result;
      }
    }
    return { equal: true };
  }

  if (typeof actual === 'object' && typeof expected === 'object') {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();

    // Check for missing keys
    const missingInActual = expectedKeys.filter(k => !actualKeys.includes(k));
    const missingInExpected = actualKeys.filter(k => !expectedKeys.includes(k));

    if (missingInActual.length > 0) {
      return {
        equal: false,
        diff: `At ${path}: missing keys in actual: ${missingInActual.join(', ')}`
      };
    }

    if (missingInExpected.length > 0) {
      return {
        equal: false,
        diff: `At ${path}: extra keys in actual: ${missingInExpected.join(', ')}`
      };
    }

    for (const key of actualKeys) {
      const result = deepEqualWithDiff(actual[key], expected[key], path ? `${path}.${key}` : key);
      if (!result.equal) {
        return result;
      }
    }
    return { equal: true };
  }

  return {
    equal: false,
    diff: `At ${path}: value mismatch - actual: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`
  };
}

describe('normalizeArticleInput - CREATE Mode Parity Tests', () => {
  // Mock enrichMediaItemIfNeeded - returns media item as-is (no enrichment for tests)
  const mockEnrichMediaItemIfNeeded = vi.fn(async (mediaItem: any) => {
    return {
      ...mediaItem,
      previewMetadata: mediaItem.previewMetadata || {
        url: mediaItem.url,
        imageUrl: mediaItem.type === 'image' ? mediaItem.url : undefined,
        mediaType: mediaItem.type || 'link',
      },
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Text-only nugget', () => {
    it('should match legacy output for text-only nugget', async () => {
      const input: ArticleInputData = {
        title: 'My Text Nugget',
        content: 'This is a text-only nugget with some content that should generate a read time.',
        categories: ['Tech'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized, legacy);
      expect(diff.equal, diff.diff).toBe(true);
    });
  });

  describe('Scenario 2: Link + metadata nugget', () => {
    it('should match legacy output for link with metadata', async () => {
      const linkMetadata: NuggetMedia = {
        type: 'link',
        url: 'https://example.com/article',
        previewMetadata: {
          url: 'https://example.com/article',
          title: 'Example Article',
          description: 'This is an example article',
          siteName: 'Example Site',
          imageUrl: 'https://example.com/image.jpg',
        },
      };

      const input: ArticleInputData = {
        title: 'My Link Nugget',
        content: 'Check out this article',
        categories: ['Tech', 'News'],
        visibility: 'public',
        urls: ['https://example.com/article'],
        detectedLink: 'https://example.com/article',
        linkMetadata,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized, legacy);
      expect(diff.equal, diff.diff).toBe(true);
    });
  });

  describe('Scenario 3: YouTube preview nugget', () => {
    it('should match legacy output for YouTube URL', async () => {
      const linkMetadata: NuggetMedia = {
        type: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        previewMetadata: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'YouTube Video Title',
          description: 'Video description',
          siteName: 'YouTube',
          imageUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
          mediaType: 'youtube',
        },
      };

      const input: ArticleInputData = {
        title: 'My YouTube Nugget',
        content: 'Check out this video',
        categories: ['Video'],
        visibility: 'public',
        urls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
        detectedLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        linkMetadata,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized, legacy);
      expect(diff.equal, diff.diff).toBe(true);
    });
  });

  describe('Scenario 4: Image + masonry primary media', () => {
    it('should match legacy output for image with masonry primary', async () => {
      const primaryItem: MasonryMediaItem = {
        id: 'primary',
        type: 'image',
        url: 'https://example.com/image.jpg',
        thumbnail: 'https://example.com/image.jpg',
        source: 'primary',
        showInMasonry: true,
        isLocked: false,
      };

      const input: ArticleInputData = {
        title: 'My Image Nugget',
        content: 'This has an image',
        categories: ['Photo'],
        visibility: 'public',
        urls: ['https://example.com/image.jpg'],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: ['https://example.com/image.jpg'],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [primaryItem],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized, legacy);
      expect(diff.equal, diff.diff).toBe(true);
    });
  });

  describe('Scenario 5: Multi-image + supportingMedia case', () => {
    it('should match legacy output for multiple images with supporting media', async () => {
      const primaryItem: MasonryMediaItem = {
        id: 'primary',
        type: 'image',
        url: 'https://example.com/image1.jpg',
        thumbnail: 'https://example.com/image1.jpg',
        source: 'primary',
        showInMasonry: true,
        isLocked: false,
      };

      const supportingItem: MasonryMediaItem = {
        id: 'supporting-0',
        type: 'image',
        url: 'https://example.com/image2.jpg',
        thumbnail: 'https://example.com/image2.jpg',
        source: 'supporting',
        showInMasonry: true,
        isLocked: false,
        masonryTitle: 'Second Image',
      };

      const input: ArticleInputData = {
        title: 'My Multi-Image Nugget',
        content: 'This has multiple images',
        categories: ['Photo'],
        visibility: 'public',
        urls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [primaryItem, supportingItem],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized, legacy);
      expect(diff.equal, diff.diff).toBe(true);
    });
  });

  describe('Scenario 6: Nugget with uploaded documents', () => {
    it('should match legacy output for nugget with documents', async () => {
      const uploadedDocs = [
        {
          title: 'Document.pdf',
          url: 'https://cloudinary.com/doc.pdf',
          type: 'pdf',
          size: '1.5MB',
        },
      ];

      const input: ArticleInputData = {
        title: 'My Document Nugget',
        content: 'This has a document',
        categories: ['Document'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized, legacy);
      expect(diff.equal, diff.diff).toBe(true);
    });
  });

  describe('Scenario 7: Nugget with custom domain', () => {
    it('should match legacy output for nugget with custom domain', async () => {
      const input: ArticleInputData = {
        title: 'My Custom Domain Nugget',
        content: 'This has a custom domain',
        categories: ['Tech'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: 'example.com',
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized, legacy);
      expect(diff.equal, diff.diff).toBe(true);
    });
  });

  describe('Scenario 8: Nugget with tags + categories', () => {
    it('should match legacy output for nugget with multiple tags', async () => {
      const input: ArticleInputData = {
        title: 'My Tagged Nugget',
        content: 'This has multiple tags',
        categories: ['Tech', 'AI', 'Machine Learning'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized, legacy);
      expect(diff.equal, diff.diff).toBe(true);
    });
  });

  describe('Scenario 9: Create-mode empty-tag validation case', () => {
    it('should match legacy hasEmptyTagsError behavior', async () => {
      const input: ArticleInputData = {
        title: 'My Empty Tag Nugget',
        content: 'This has no tags',
        categories: [],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      expect(normalized.hasEmptyTagsError).toBe(true);
      expect(legacy.hasEmptyTagsError).toBe(true);
      expect(normalized.hasEmptyTagsError).toBe(legacy.hasEmptyTagsError);
    });

    it('should NOT have empty tags error when tags are provided', async () => {
      const input: ArticleInputData = {
        title: 'My Tagged Nugget',
        content: 'This has tags',
        categories: ['Tech'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      expect(normalized.hasEmptyTagsError).toBe(false);
      expect(legacy.hasEmptyTagsError).toBe(false);
    });
  });

  describe('Field-level validation tests', () => {
    it('should match legacy readTime calculation', async () => {
      const input: ArticleInputData = {
        title: 'Test',
        content: 'word '.repeat(400), // 400 words = 2 minutes
        categories: ['Tech'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      expect(normalized.readTime).toBe(2);
      expect(normalized.readTime).toBe(legacy.readTime);
    });

    it('should match legacy excerpt generation', async () => {
      const longContent = 'a'.repeat(200);
      const input: ArticleInputData = {
        title: 'Test',
        content: longContent,
        categories: ['Tech'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      expect(normalized.excerpt).toBe(legacy.excerpt);
      expect(normalized.excerpt.length).toBeLessThanOrEqual(153); // 150 + '...'
    });

    it('should match legacy images list deduplication', async () => {
      const input: ArticleInputData = {
        title: 'Test',
        content: 'Test content',
        categories: ['Tech'],
        visibility: 'public',
        urls: ['https://example.com/image.jpg', 'https://example.com/IMAGE.JPG'], // Case variation
        detectedLink: null,
        linkMetadata: null,
        imageUrls: ['https://example.com/image.jpg'],
        uploadedImageUrls: ['https://example.com/image2.jpg'],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized.images, legacy.images, 'images');
      expect(diff.equal, diff.diff).toBe(true);
    });

    it('should match legacy media + previewMetadata structure', async () => {
      const linkMetadata: NuggetMedia = {
        type: 'link',
        url: 'https://example.com/article',
        previewMetadata: {
          url: 'https://example.com/article',
          title: 'Example Article',
          siteName: 'Example Site',
        },
      };

      const input: ArticleInputData = {
        title: 'Test',
        content: 'Test content',
        categories: ['Tech'],
        visibility: 'public',
        urls: ['https://example.com/article'],
        detectedLink: 'https://example.com/article',
        linkMetadata,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized.media, legacy.media, 'media');
      expect(diff.equal, diff.diff).toBe(true);
    });

    it('should match legacy supportingMedia structure', async () => {
      const primaryItem: MasonryMediaItem = {
        id: 'primary',
        type: 'image',
        url: 'https://example.com/image1.jpg',
        thumbnail: 'https://example.com/image1.jpg',
        source: 'primary',
        showInMasonry: true,
        isLocked: false,
      };

      const supportingItem: MasonryMediaItem = {
        id: 'supporting-0',
        type: 'image',
        url: 'https://example.com/image2.jpg',
        thumbnail: 'https://example.com/image2.jpg',
        source: 'supporting',
        showInMasonry: true,
        isLocked: false,
        masonryTitle: 'Supporting Image',
      };

      const input: ArticleInputData = {
        title: 'Test',
        content: 'Test content',
        categories: ['Tech'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [primaryItem, supportingItem],
        customCreatedAt: null,
        isAdmin: false,
      };

      const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
      const normalized = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const diff = deepEqualWithDiff(normalized.supportingMedia, legacy.supportingMedia, 'supportingMedia');
      expect(diff.equal, diff.diff).toBe(true);
    });

    it('should match legacy source_type value', async () => {
      const testCases = [
        {
          urls: ['https://example.com/article'],
          imageUrls: [],
          expected: 'link',
        },
        {
          urls: ['https://example.com/image.jpg'],
          imageUrls: ['https://example.com/image.jpg'],
          expected: 'link',
        },
        {
          urls: [],
          imageUrls: [],
          expected: 'text',
        },
      ];

      for (const testCase of testCases) {
        const input: ArticleInputData = {
          title: 'Test',
          content: 'Test content',
          categories: ['Tech'],
          visibility: 'public',
          urls: testCase.urls,
          detectedLink: null,
          linkMetadata: null,
          imageUrls: testCase.imageUrls,
          uploadedImageUrls: [],
          mediaIds: [],
          uploadedDocs: undefined,
          customDomain: null,
          masonryMediaItems: [],
          customCreatedAt: null,
          isAdmin: false,
        };

        const legacy = await legacyCreateNormalization(input, mockEnrichMediaItemIfNeeded);
        const normalized = await normalizeArticleInput(input, {
          mode: 'create',
          enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
        });

        expect(normalized.source_type).toBe(testCase.expected);
        expect(normalized.source_type).toBe(legacy.source_type);
      }
    });

    it('should match legacy customCreatedAt behavior', async () => {
      const customDate = '2024-01-15T10:30:00';

      // Test with admin
      const inputAdmin: ArticleInputData = {
        title: 'Test',
        content: 'Test content',
        categories: ['Tech'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: customDate,
        isAdmin: true,
      };

      const legacyAdmin = await legacyCreateNormalization(inputAdmin, mockEnrichMediaItemIfNeeded);
      const normalizedAdmin = await normalizeArticleInput(inputAdmin, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      expect(normalizedAdmin.customCreatedAt).toBe(legacyAdmin.customCreatedAt);
      expect(normalizedAdmin.customCreatedAt).toBe(new Date(customDate).toISOString());

      // Test without admin (should not set customCreatedAt)
      const inputNonAdmin: ArticleInputData = {
        ...inputAdmin,
        isAdmin: false,
      };

      const legacyNonAdmin = await legacyCreateNormalization(inputNonAdmin, mockEnrichMediaItemIfNeeded);
      const normalizedNonAdmin = await normalizeArticleInput(inputNonAdmin, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      expect(normalizedNonAdmin.customCreatedAt).toBe(legacyNonAdmin.customCreatedAt);
      expect(normalizedNonAdmin.customCreatedAt).toBeUndefined();
    });
  });

  describe('EDIT Mode Sanity Test', () => {
    it('should NOT produce create-mode defaults in EDIT mode', async () => {
      const input: ArticleInputData = {
        title: 'Test',
        content: 'Test content',
        categories: ['Tech'],
        visibility: 'public',
        urls: [],
        detectedLink: null,
        linkMetadata: null,
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
        existingImages: ['https://example.com/existing.jpg'],
        existingMediaIds: ['media-id-1'],
      };

      const normalizedCreate = await normalizeArticleInput(input, {
        mode: 'create',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      const normalizedEdit = await normalizeArticleInput(input, {
        mode: 'edit',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      // EDIT mode should NOT have hasEmptyTagsError (only CREATE mode has this)
      // NOTE: Current implementation sets hasEmptyTagsError to false for EDIT mode
      // This is a minor difference - EDIT mode should ideally not set this field at all
      expect(normalizedEdit.hasEmptyTagsError).toBe(false); // Currently returns false, not undefined
      expect(normalizedCreate.hasEmptyTagsError).toBeDefined();

      // EDIT mode should merge existing images
      expect(normalizedEdit.images).toContain('https://example.com/existing.jpg');
      expect(normalizedCreate.images).toBeUndefined(); // CREATE mode doesn't have existing images

      // EDIT mode should merge existing mediaIds
      expect(normalizedEdit.mediaIds).toContain('media-id-1');
      expect(normalizedCreate.mediaIds).toBeUndefined(); // CREATE mode doesn't have existing mediaIds
    });

    it('should only compare fields that EDIT currently modifies', async () => {
      const input: ArticleInputData = {
        title: 'Test',
        content: 'Test content',
        categories: ['Tech'],
        visibility: 'public',
        urls: ['https://example.com/article'],
        detectedLink: 'https://example.com/article',
        linkMetadata: {
          type: 'link',
          url: 'https://example.com/article',
          previewMetadata: {
            url: 'https://example.com/article',
            title: 'Example',
          },
        },
        imageUrls: [],
        uploadedImageUrls: [],
        mediaIds: [],
        uploadedDocs: undefined,
        customDomain: null,
        masonryMediaItems: [],
        customCreatedAt: null,
        isAdmin: false,
      };

      const normalizedEdit = await normalizeArticleInput(input, {
        mode: 'edit',
        enrichMediaItemIfNeeded: mockEnrichMediaItemIfNeeded,
      });

      // EDIT mode should still calculate readTime and excerpt (these are recalculated)
      expect(normalizedEdit.readTime).toBeDefined();
      expect(normalizedEdit.excerpt).toBeDefined();

      // EDIT mode should NOT have hasEmptyTagsError
      // NOTE: Current implementation sets hasEmptyTagsError to false for EDIT mode
      // This is a minor difference - EDIT mode should ideally not set this field at all
      expect(normalizedEdit.hasEmptyTagsError).toBe(false); // Currently returns false, not undefined
    });
  });
});

