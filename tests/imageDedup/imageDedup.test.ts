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

