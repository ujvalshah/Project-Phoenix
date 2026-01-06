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
      
      // Should fail validation because tags are required (empty array fails refinement)
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some(e => e.path.includes('tags'))).toBe(true);
      }
    });

    it('should coerce undefined tags to empty array', () => {
      const result = createArticleSchema.safeParse({
        ...baseValidPayload,
        tags: undefined,
      });
      
      // Should fail validation because tags are required
      expect(result.success).toBe(false);
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
        expect(Array.isArray(result.data.images)).toBe(true);
        expect(result.data.images.length).toBe(0);
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
  });
});

