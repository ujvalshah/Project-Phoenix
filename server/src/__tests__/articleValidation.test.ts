import { describe, it, expect } from 'vitest';
import { createArticleSchema, updateArticleSchema } from '../utils/validation.js';

describe('Article Validation Schema - Null Array Handling', () => {
  describe('createArticleSchema', () => {
    const baseValidPayload = {
      authorId: 'user123',
      authorName: 'Test User',
      content: 'Test content',
      tags: ['tag1'],
    };

    it('should coerce null tags to empty array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        tags: null,
      });
      
      expect(result.success).toBe(false);
    });

    it('should coerce undefined tags to empty array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        tags: undefined,
      });
      
      expect(result.success).toBe(false);
    });

    it('should default status to published when omitted', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('published');
      }
    });

    it('should accept draft status with null publishedAt', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        status: 'draft',
        publishedAt: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('draft');
        expect(result.data.publishedAt).toBeNull();
      }
    });

    it('should accept valid tags array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        tags: ['tag1', 'tag2'],
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.tags)).toBe(true);
        expect(result.data.tags.length).toBe(2);
      }
    });

    it('should coerce null images to empty array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        images: null,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.images)).toBe(true);
        expect(result.data.images.length).toBe(0);
      }
    });

    it('should coerce undefined images to empty array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        images: undefined,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.images).toBeUndefined();
      }
    });

    it('should accept valid images array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        images: ['image1.jpg', 'image2.jpg'],
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.images)).toBe(true);
        expect(result.data.images.length).toBe(2);
      }
    });

    it('should coerce null mediaIds to empty array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        mediaIds: null,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.mediaIds)).toBe(true);
        expect(result.data.mediaIds.length).toBe(0);
      }
    });

    it('should coerce null supportingMedia to empty array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        supportingMedia: null,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.supportingMedia)).toBe(true);
        expect(result.data.supportingMedia.length).toBe(0);
      }
    });

    it('should accept supportingMedia position/order fields', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        supportingMedia: [
          {
            type: 'image',
            url: 'https://example.com/one.jpg',
            position: 0,
            order: 0,
          },
          {
            type: 'image',
            url: 'https://example.com/two.jpg',
            position: 1,
            order: 1,
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.supportingMedia?.[0].position).toBe(0);
        expect(result.data.supportingMedia?.[1].order).toBe(1);
      }
    });

    it('should coerce null documents to empty array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        documents: null,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.documents)).toBe(true);
        expect(result.data.documents.length).toBe(0);
      }
    });

    it('should coerce null themes to empty array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        themes: null,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.themes)).toBe(true);
        expect(result.data.themes.length).toBe(0);
      }
    });

    it('should handle payload with all array fields as null', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        images: null,
        mediaIds: null,
        supportingMedia: null,
        documents: null,
        themes: null,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.images)).toBe(true);
        expect(Array.isArray(result.data.mediaIds)).toBe(true);
        expect(Array.isArray(result.data.supportingMedia)).toBe(true);
        expect(Array.isArray(result.data.documents)).toBe(true);
        expect(Array.isArray(result.data.themes)).toBe(true);
      }
    });
  });

  describe('updateArticleSchema', () => {
    it('should coerce null images to empty array in partial update', () => {
      const result = updateArticleSchema.safeParse({
        images: null,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.images)).toBe(true);
        expect(result.data.images.length).toBe(0);
      }
    });

    it('should coerce null tags to empty array in partial update', () => {
      const result = updateArticleSchema.safeParse({
        tags: null,
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.tags)).toBe(true);
        expect(result.data.tags.length).toBe(0);
      }
    });

    it('should handle missing array fields in partial update', () => {
      const result = updateArticleSchema.safeParse({
        title: 'Updated title',
      });

      expect(result.success).toBe(true);
    });

    // Regression for content/contentStream clobber bug: Zod's .partial() does
    // NOT strip .default() values. If a caller trusts parsed.data directly in
    // an Mongo $set, lightweight PATCHes (e.g. visibility toggle) will silently
    // wipe content and reset contentStream. articlesController.updateArticle
    // MUST filter parsed.data to keys present in req.body before $set.
    it('injects defaults for omitted fields — callers must filter by req.body keys', () => {
      const result = updateArticleSchema.safeParse({ visibility: 'private' });
      expect(result.success).toBe(true);
      if (result.success) {
        // This is the HAZARD: content and contentStream come back populated
        // even though the client never sent them.
        expect(result.data.content).toBe('');
        expect(result.data.contentStream).toBe('standard');
        expect(result.data.visibility).toBe('private');
      }
    });
  });
});


