import { describe, it, expect } from 'vitest';
import {
  extractAllUrls,
  filterExistingExternalLinks,
  getUrlCountsBySource,
  type ExtractedUrl,
} from '../extractAllUrls';
import type { Article } from '@/types';

describe('extractAllUrls', () => {
  describe('extractAllUrls', () => {
    it('should return empty array for null/undefined article', () => {
      expect(extractAllUrls(null)).toEqual([]);
      expect(extractAllUrls(undefined)).toEqual([]);
    });

    it('should extract URL from primaryMedia', () => {
      const article = {
        primaryMedia: { url: 'https://example.com/primary.jpg' },
      } as Article;

      const result = extractAllUrls(article);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        url: 'https://example.com/primary.jpg',
        source: 'primaryMedia',
        isCloudinary: false,
      });
    });

    it('should extract URLs from supportingMedia', () => {
      const article = {
        supportingMedia: [
          { url: 'https://example.com/supporting1.jpg' },
          { url: 'https://example.com/supporting2.jpg' },
        ],
      } as Article;

      const result = extractAllUrls(article);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        url: 'https://example.com/supporting1.jpg',
        source: 'supportingMedia',
        index: 0,
      });
      expect(result[1]).toMatchObject({
        url: 'https://example.com/supporting2.jpg',
        source: 'supportingMedia',
        index: 1,
      });
    });

    it('should extract URL from legacy media field', () => {
      const article = {
        media: { url: 'https://example.com/media.jpg', type: 'image' },
      } as Article;

      const result = extractAllUrls(article);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        url: 'https://example.com/media.jpg',
        source: 'media',
      });
    });

    it('should extract URL from media.previewMetadata', () => {
      const article = {
        media: {
          url: 'https://youtube.com/watch?v=123',
          type: 'youtube',
          previewMetadata: {
            url: 'https://youtube.com/watch?v=123',
            title: 'Test Video',
          },
        },
      } as Article;

      const result = extractAllUrls(article);

      // Should only get 1 because media.url and previewMetadata.url are the same
      expect(result).toHaveLength(1);
    });

    it('should extract URLs from images array', () => {
      const article = {
        images: [
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
        ],
      } as Article;

      const result = extractAllUrls(article);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        url: 'https://example.com/img1.jpg',
        source: 'images',
        index: 0,
      });
    });

    it('should detect Cloudinary URLs', () => {
      const article = {
        images: [
          'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        ],
      } as Article;

      const result = extractAllUrls(article);

      expect(result[0].isCloudinary).toBe(true);
      expect(result[0].sourceLabel).toContain('Uploaded');
    });

    it('should deduplicate URLs across sources', () => {
      const article = {
        primaryMedia: { url: 'https://example.com/same.jpg' },
        images: ['https://example.com/same.jpg'],
      } as Article;

      const result = extractAllUrls(article);

      // Should only have 1 because URLs are the same
      expect(result).toHaveLength(1);
      // primaryMedia has higher priority
      expect(result[0].source).toBe('primaryMedia');
    });

    it('should extract from all sources', () => {
      const article = {
        primaryMedia: { url: 'https://example.com/primary.jpg' },
        supportingMedia: [{ url: 'https://example.com/supporting.jpg' }],
        media: { url: 'https://example.com/media.jpg', type: 'image' },
        images: ['https://example.com/image.jpg'],
      } as Article;

      const result = extractAllUrls(article);

      expect(result).toHaveLength(4);
    });

    it('should skip empty or invalid URLs', () => {
      const article = {
        images: ['', null, undefined, 'https://example.com/valid.jpg', '   '] as unknown as string[],
      } as Article;

      const result = extractAllUrls(article);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/valid.jpg');
    });

    it('should handle case-insensitive deduplication', () => {
      const article = {
        primaryMedia: { url: 'https://Example.COM/image.jpg' },
        images: ['https://example.com/IMAGE.JPG'],
      } as Article;

      const result = extractAllUrls(article);

      // Normalized URLs should match (depending on normalizeImageUrl implementation)
      // The first URL wins (primaryMedia)
      expect(result).toHaveLength(1);
    });
  });

  describe('filterExistingExternalLinks', () => {
    it('should return all URLs when no external links exist', () => {
      const extractedUrls: ExtractedUrl[] = [
        { url: 'https://a.com', source: 'primaryMedia', sourceLabel: 'Primary Media', isCloudinary: false },
      ];

      const result = filterExistingExternalLinks(extractedUrls, null);

      expect(result).toEqual(extractedUrls);
    });

    it('should filter out URLs already in external links', () => {
      const extractedUrls: ExtractedUrl[] = [
        { url: 'https://a.com', source: 'primaryMedia', sourceLabel: 'Primary Media', isCloudinary: false },
        { url: 'https://b.com', source: 'images', sourceLabel: 'Image #1', isCloudinary: false, index: 0 },
      ];

      const externalLinks = [{ url: 'https://a.com' }];

      const result = filterExistingExternalLinks(extractedUrls, externalLinks);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://b.com');
    });

    it('should handle empty external links array', () => {
      const extractedUrls: ExtractedUrl[] = [
        { url: 'https://a.com', source: 'primaryMedia', sourceLabel: 'Primary Media', isCloudinary: false },
      ];

      const result = filterExistingExternalLinks(extractedUrls, []);

      expect(result).toEqual(extractedUrls);
    });
  });

  describe('getUrlCountsBySource', () => {
    it('should count URLs by source type', () => {
      const extractedUrls: ExtractedUrl[] = [
        { url: 'https://a.com', source: 'primaryMedia', sourceLabel: '', isCloudinary: false },
        { url: 'https://b.com', source: 'images', sourceLabel: '', isCloudinary: false, index: 0 },
        { url: 'https://c.com', source: 'images', sourceLabel: '', isCloudinary: false, index: 1 },
        { url: 'https://d.com', source: 'supportingMedia', sourceLabel: '', isCloudinary: false, index: 0 },
      ];

      const result = getUrlCountsBySource(extractedUrls);

      expect(result.primaryMedia).toBe(1);
      expect(result.images).toBe(2);
      expect(result.supportingMedia).toBe(1);
      expect(result.media).toBe(0);
      expect(result['media.previewMetadata']).toBe(0);
    });

    it('should return zeros for empty array', () => {
      const result = getUrlCountsBySource([]);

      expect(result.primaryMedia).toBe(0);
      expect(result.images).toBe(0);
      expect(result.supportingMedia).toBe(0);
      expect(result.media).toBe(0);
    });
  });
});
