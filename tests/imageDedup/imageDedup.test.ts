/**
 * Unit Tests: Image Deduplication Module
 * 
 * Tests for src/shared/articleNormalization/imageDedup.ts
 * 
 * Coverage:
 * - duplicate URLs (case + query param variants)
 * - upload + pasted URL duplicates
 * - edit mode where images move to supportingMedia
 * - ensure no images are lost unexpectedly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeImageUrl,
  detectDuplicateImages,
  dedupeImagesForCreate,
  dedupeImagesForEdit,
} from '../../src/shared/articleNormalization/imageDedup';

/**
 * ============================================================================
 * IMAGE PRESERVATION INVARIANT TESTS
 * ============================================================================
 * 
 * These tests verify the strict invariant:
 * "No image should ever be removed unless the user explicitly deletes it."
 * 
 * Test scenarios:
 * 1. Promote then Demote - Image should return to images[] when masonry deselected
 * 2. Explicit Delete - Image should be removed from ALL sources when explicitly deleted
 * 3. Duplicate Re-Add - No duplicates should occur when promoting/demoting repeatedly
 */

describe('normalizeImageUrl', () => {
  it('should normalize URLs by removing query params and hash', () => {
    expect(normalizeImageUrl('https://example.com/image.jpg?w=100&h=200#hash'))
      .toBe('https://example.com/image.jpg');
  });

  it('should normalize case to lowercase', () => {
    expect(normalizeImageUrl('https://EXAMPLE.com/IMAGE.JPG'))
      .toBe('https://example.com/image.jpg');
  });

  it('should trim whitespace', () => {
    expect(normalizeImageUrl('  https://example.com/image.jpg  '))
      .toBe('https://example.com/image.jpg');
  });

  it('should handle invalid URLs gracefully', () => {
    expect(normalizeImageUrl('not-a-url')).toBe('not-a-url');
  });

  it('should return empty string for empty/null input', () => {
    expect(normalizeImageUrl('')).toBe('');
    expect(normalizeImageUrl(null as any)).toBe('');
    expect(normalizeImageUrl(undefined as any)).toBe('');
  });
});

describe('detectDuplicateImages', () => {
  it('should detect case-insensitive duplicates', () => {
    const images = [
      'https://example.com/image.jpg',
      'https://EXAMPLE.com/IMAGE.JPG',
      'https://example.com/image2.jpg',
    ];

    const result = detectDuplicateImages(images);
    expect(result.duplicates.length).toBeGreaterThan(0);
    expect(result.duplicates.some(d => d.type === 'case-insensitive')).toBe(true);
  });

  it('should detect query param variants as duplicates', () => {
    const images = [
      'https://example.com/image.jpg',
      'https://example.com/image.jpg?w=100',
      'https://example.com/image.jpg?h=200',
    ];

    const result = detectDuplicateImages(images);
    expect(result.duplicates.length).toBeGreaterThan(0);
    expect(result.duplicates.some(d => d.type === 'query-params')).toBe(true);
  });

  it('should return normalized pairs for all images', () => {
    const images = [
      'https://example.com/image.jpg',
      'https://example.com/image2.jpg',
    ];

    const result = detectDuplicateImages(images);
    expect(result.normalizedPairs.length).toBe(2);
    expect(result.normalizedPairs[0].original).toBe('https://example.com/image.jpg');
  });

  it('should handle empty array', () => {
    const result = detectDuplicateImages([]);
    expect(result.duplicates).toEqual([]);
    expect(result.normalizedPairs).toEqual([]);
  });

  it('should filter out invalid entries', () => {
    const images = [
      'https://example.com/image.jpg',
      '',
      null as any,
      undefined as any,
      '   ',
      'https://example.com/image2.jpg',
    ];

    const result = detectDuplicateImages(images);
    // Should only process valid URLs
    expect(result.normalizedPairs.length).toBe(2);
  });
});

describe('dedupeImagesForCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should remove case-insensitive duplicates', () => {
    const images = [
      'https://example.com/image.jpg',
      'https://EXAMPLE.com/IMAGE.JPG',
      'https://example.com/image2.jpg',
    ];

    const result = dedupeImagesForCreate(images);
    expect(result.deduplicated.length).toBe(2);
    expect(result.removed.length).toBe(1);
    expect(result.deduplicated).toContain('https://example.com/image.jpg');
    expect(result.deduplicated).toContain('https://example.com/image2.jpg');
  });

  it('should preserve original casing of first occurrence', () => {
    const images = [
      'https://EXAMPLE.com/IMAGE.JPG',
      'https://example.com/image.jpg',
    ];

    const result = dedupeImagesForCreate(images);
    expect(result.deduplicated.length).toBe(1);
    expect(result.deduplicated[0]).toBe('https://EXAMPLE.com/IMAGE.JPG');
  });

  it('should handle upload + pasted URL duplicates', () => {
    const images = [
      'https://example.com/uploaded.jpg', // uploaded
      'https://example.com/uploaded.jpg', // pasted URL (duplicate)
      'https://example.com/other.jpg',
    ];

    const result = dedupeImagesForCreate(images);
    expect(result.deduplicated.length).toBe(2);
    expect(result.removed.length).toBe(1);
  });

  it('should filter out empty/invalid entries', () => {
    const images = [
      'https://example.com/image.jpg',
      '',
      null as any,
      '   ',
      'https://example.com/image2.jpg',
    ];

    const result = dedupeImagesForCreate(images);
    expect(result.deduplicated.length).toBe(2);
    expect(result.deduplicated.every(img => img && img.trim())).toBe(true);
  });

  it('should return empty array for empty input', () => {
    const result = dedupeImagesForCreate([]);
    expect(result.deduplicated).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('should log removal actions', () => {
    const images = [
      'https://example.com/image.jpg',
      'https://example.com/image.jpg', // duplicate
    ];

    const result = dedupeImagesForCreate(images);
    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs.some(log => log.action === 'removed' && log.reason === 'duplicate')).toBe(true);
  });
});

describe('dedupeImagesForEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should preserve existing images', () => {
    const existingImages = ['https://example.com/existing1.jpg', 'https://example.com/existing2.jpg'];
    const newImages = ['https://example.com/new.jpg'];

    const result = dedupeImagesForEdit(existingImages, newImages);
    expect(result.deduplicated.length).toBe(3);
    expect(result.deduplicated).toContain('https://example.com/existing1.jpg');
    expect(result.deduplicated).toContain('https://example.com/existing2.jpg');
    expect(result.deduplicated).toContain('https://example.com/new.jpg');
  });

  it('should NOT lose existing images', () => {
    const existingImages = ['https://example.com/existing1.jpg', 'https://example.com/existing2.jpg'];
    const newImages: string[] = [];

    const result = dedupeImagesForEdit(existingImages, newImages);
    expect(result.deduplicated.length).toBe(2);
    expect(result.deduplicated).toContain('https://example.com/existing1.jpg');
    expect(result.deduplicated).toContain('https://example.com/existing2.jpg');
  });

  it('should handle case-insensitive duplicates between existing and new', () => {
    const existingImages = ['https://example.com/image.jpg'];
    const newImages = ['https://EXAMPLE.com/IMAGE.JPG', 'https://example.com/new.jpg'];

    const result = dedupeImagesForEdit(existingImages, newImages);
    // Should keep existing and add new (case variant is treated as same)
    expect(result.deduplicated.length).toBe(2);
    expect(result.deduplicated).toContain('https://example.com/image.jpg');
    expect(result.deduplicated).toContain('https://example.com/new.jpg');
  });

  it('should move images to supportingMedia when URL exists there', () => {
    const existingImages = ['https://example.com/existing.jpg'];
    const newImages = ['https://example.com/new.jpg'];
    const supportingMedia = [
      {
        type: 'image',
        url: 'https://example.com/new.jpg',
      },
    ];

    const result = dedupeImagesForEdit(existingImages, newImages, supportingMedia);
    expect(result.deduplicated.length).toBe(1);
    expect(result.deduplicated).toContain('https://example.com/existing.jpg');
    expect(result.movedToSupporting.length).toBe(1);
    expect(result.movedToSupporting).toContain('https://example.com/new.jpg');
  });

  it('should NOT move images if URL does not exist in supportingMedia', () => {
    const existingImages = ['https://example.com/existing.jpg'];
    const newImages = ['https://example.com/new.jpg'];
    const supportingMedia = [
      {
        type: 'image',
        url: 'https://example.com/different.jpg',
      },
    ];

    const result = dedupeImagesForEdit(existingImages, newImages, supportingMedia);
    expect(result.deduplicated.length).toBe(2);
    expect(result.movedToSupporting.length).toBe(0);
  });

  it('should only prune when same URL exists in supportingMedia', () => {
    const existingImages: string[] = [];
    const newImages = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ];
    const supportingMedia = [
      {
        type: 'image',
        url: 'https://example.com/image1.jpg', // Only this one exists
      },
    ];

    const result = dedupeImagesForEdit(existingImages, newImages, supportingMedia);
    expect(result.deduplicated.length).toBe(1);
    expect(result.deduplicated).toContain('https://example.com/image2.jpg');
    expect(result.movedToSupporting.length).toBe(1);
    expect(result.movedToSupporting).toContain('https://example.com/image1.jpg');
  });

  it('should handle case-insensitive matching for supportingMedia', () => {
    const existingImages: string[] = [];
    const newImages = ['https://example.com/image.jpg'];
    const supportingMedia = [
      {
        type: 'image',
        url: 'https://EXAMPLE.com/IMAGE.JPG', // Different case
      },
    ];

    const result = dedupeImagesForEdit(existingImages, newImages, supportingMedia);
    expect(result.movedToSupporting.length).toBe(1);
    expect(result.deduplicated.length).toBe(0);
  });

  it('should ignore non-image items in supportingMedia', () => {
    const existingImages: string[] = [];
    const newImages = ['https://example.com/image.jpg'];
    const supportingMedia = [
      {
        type: 'link',
        url: 'https://example.com/image.jpg', // Same URL but not image type
      },
    ];

    const result = dedupeImagesForEdit(existingImages, newImages, supportingMedia);
    // Should NOT move because supportingMedia item is not type 'image'
    expect(result.deduplicated.length).toBe(1);
    expect(result.movedToSupporting.length).toBe(0);
  });

  it('should handle empty supportingMedia', () => {
    const existingImages = ['https://example.com/existing.jpg'];
    const newImages = ['https://example.com/new.jpg'];

    const result = dedupeImagesForEdit(existingImages, newImages, []);
    expect(result.deduplicated.length).toBe(2);
    expect(result.movedToSupporting.length).toBe(0);
  });

  it('should handle undefined supportingMedia', () => {
    const existingImages = ['https://example.com/existing.jpg'];
    const newImages = ['https://example.com/new.jpg'];

    const result = dedupeImagesForEdit(existingImages, newImages, undefined);
    expect(result.deduplicated.length).toBe(2);
    expect(result.movedToSupporting.length).toBe(0);
  });

  it('should log all actions', () => {
    const existingImages = ['https://example.com/existing.jpg'];
    const newImages = ['https://example.com/new.jpg'];

    const result = dedupeImagesForEdit(existingImages, newImages);
    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs.some(log => log.action === 'preserved')).toBe(true);
  });

  it('should ensure no images are lost unexpectedly', () => {
    const existingImages = [
      'https://example.com/existing1.jpg',
      'https://example.com/existing2.jpg',
      'https://example.com/existing3.jpg',
    ];
    const newImages = [
      'https://example.com/new1.jpg',
      'https://example.com/new2.jpg',
    ];

    const result = dedupeImagesForEdit(existingImages, newImages);
    // All existing + all new should be present (no unexpected loss)
    expect(result.deduplicated.length).toBe(5);
    expect(result.deduplicated).toContain('https://example.com/existing1.jpg');
    expect(result.deduplicated).toContain('https://example.com/existing2.jpg');
    expect(result.deduplicated).toContain('https://example.com/existing3.jpg');
    expect(result.deduplicated).toContain('https://example.com/new1.jpg');
    expect(result.deduplicated).toContain('https://example.com/new2.jpg');
  });
});

describe('IMAGE PRESERVATION INVARIANT: Image Lifecycle Tests', () => {
  /**
   * Test 1: Promote then Demote
   * 
   * Scenario:
   * - Start with image in images[]
   * - Promote to supportingMedia via masonry flag (showInMasonry: true)
   * - Remove from masonry (showInMasonry: false)
   * - Save and reload
   * 
   * Expected: image returns to images[]
   */
  it('Test 1 - Promote then Demote: Image should return to images[] when masonry deselected', () => {
    const existingImages = ['https://example.com/image1.jpg'];
    const newImages: string[] = [];
    
    // Step 1: Image is promoted to supportingMedia (tracked in imagesBackup)
    const imagesBackup = new Set(['https://example.com/image1.jpg']);
    
    // Step 2: Image is removed from supportingMedia (masonry deselected)
    // supportingMedia is now empty (no images with showInMasonry: true)
    const supportingMedia: any[] = [];
    
    // Step 3: Deduplication should restore image from backup
    const result = dedupeImagesForEdit(
      existingImages,
      newImages,
      supportingMedia,
      imagesBackup,
      undefined // No explicit delete
    );
    
    // Expected: Image is restored to images[]
    expect(result.restored).toContain('https://example.com/image1.jpg');
    expect(result.deduplicated).toContain('https://example.com/image1.jpg');
    expect(result.deduplicated.length).toBe(1);
    expect(result.movedToSupporting.length).toBe(0);
  });

  /**
   * Test 2: Explicit Delete
   * 
   * Scenario:
   * - Start with image in images[]
   * - Promote to supportingMedia
   * - Delete via explicit delete action
   * 
   * Expected: image removed from ALL sources (not restored)
   */
  it('Test 2 - Explicit Delete: Image should be removed from ALL sources when explicitly deleted', () => {
    const existingImages = ['https://example.com/image1.jpg'];
    const newImages: string[] = [];
    
    // Step 1: Image was promoted to supportingMedia (tracked in imagesBackup)
    const imagesBackup = new Set(['https://example.com/image1.jpg']);
    
    // Step 2: Image is removed from supportingMedia (masonry deselected)
    const supportingMedia: any[] = [];
    
    // Step 3: Image was explicitly deleted by user
    const explicitlyDeletedImages = new Set(['https://example.com/image1.jpg']);
    
    // Step 4: Deduplication should NOT restore explicitly deleted image
    const result = dedupeImagesForEdit(
      existingImages,
      newImages,
      supportingMedia,
      imagesBackup,
      explicitlyDeletedImages
    );
    
    // Expected: Image is NOT restored (explicitly deleted)
    expect(result.restored.length).toBe(0);
    expect(result.deduplicated).not.toContain('https://example.com/image1.jpg');
    expect(result.deduplicated.length).toBe(0);
  });

  /**
   * Test 3: Duplicate Re-Add Behavior
   * 
   * Scenario:
   * - Promote image from images[] → supportingMedia
   * - Demote image from supportingMedia → images[] (restored)
   * - Promote again from images[] → supportingMedia
   * 
   * Expected: no duplicates, image still persists
   */
  it('Test 3 - Duplicate Re-Add: No duplicates when promoting/demoting repeatedly', () => {
    const existingImages = ['https://example.com/image1.jpg'];
    const newImages: string[] = [];
    const imageUrl = 'https://example.com/image1.jpg';
    const normalizedUrl = imageUrl.toLowerCase().trim();
    
    // Step 1: First promotion - image moved to supportingMedia
    const imagesBackup1 = new Set([normalizedUrl]);
    const supportingMedia1: any[] = [
      { type: 'image', url: imageUrl, showInMasonry: true }
    ];
    
    const result1 = dedupeImagesForEdit(
      existingImages,
      newImages,
      supportingMedia1,
      imagesBackup1,
      undefined
    );
    
    // Image should be removed from images[] (moved to supportingMedia)
    expect(result1.deduplicated).not.toContain(imageUrl);
    expect(result1.movedToSupporting).toContain(imageUrl);
    
    // Step 2: Demotion - image removed from supportingMedia (masonry deselected)
    const supportingMedia2: any[] = []; // Empty - masonry deselected
    
    const result2 = dedupeImagesForEdit(
      existingImages,
      newImages,
      supportingMedia2,
      imagesBackup1, // Still in backup from first promotion
      undefined
    );
    
    // Image should be restored to images[]
    expect(result2.restored).toContain(imageUrl);
    expect(result2.deduplicated).toContain(imageUrl);
    
    // Step 3: Second promotion - image moved to supportingMedia again
    const imagesBackup2 = new Set([normalizedUrl]); // Updated backup
    const supportingMedia3: any[] = [
      { type: 'image', url: imageUrl, showInMasonry: true }
    ];
    
    const result3 = dedupeImagesForEdit(
      result2.deduplicated, // Use restored images as existing
      newImages,
      supportingMedia3,
      imagesBackup2,
      undefined
    );
    
    // Image should be removed from images[] again (moved to supportingMedia)
    expect(result3.deduplicated).not.toContain(imageUrl);
    expect(result3.movedToSupporting).toContain(imageUrl);
    
    // Verify no duplicates in any step
    expect(result1.deduplicated.filter(img => img === imageUrl).length).toBe(0);
    expect(result2.deduplicated.filter(img => img === imageUrl).length).toBe(1);
    expect(result3.deduplicated.filter(img => img === imageUrl).length).toBe(0);
  });
});

