import { describe, it, expect } from 'vitest';
import {
  validateBeforeSave,
  formatValidationResult,
  type ValidationInput,
  type PreSaveValidationResult,
} from '../preSaveValidation';
import type { Article, ExternalLink } from '@/types';

describe('preSaveValidation', () => {
  describe('validateBeforeSave', () => {
    describe('required fields validation (errors)', () => {
      it('should return error when tags are missing', () => {
        const input: ValidationInput = {
          content: 'Some content',
          tags: [],
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'tags',
            code: 'TAGS_REQUIRED',
          })
        );
      });

      it('should return error when tags are only whitespace', () => {
        const input: ValidationInput = {
          content: 'Some content',
          tags: ['  ', '   '],
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'tags',
            code: 'TAGS_REQUIRED',
          })
        );
      });

      it('should pass when at least one valid tag exists', () => {
        const input: ValidationInput = {
          content: 'Some content',
          tags: ['valid-tag'],
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(true);
        expect(result.errors).not.toContainEqual(
          expect.objectContaining({
            field: 'tags',
            code: 'TAGS_REQUIRED',
          })
        );
      });

      it('should return error when no content is provided', () => {
        const input: ValidationInput = {
          tags: ['tag'],
          content: '',
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'content',
            code: 'CONTENT_REQUIRED',
          })
        );
      });

      it('should pass when content exists', () => {
        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some text content',
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(true);
      });

      it('should pass when media exists but no content', () => {
        const input: ValidationInput = {
          tags: ['tag'],
          content: '',
          media: { url: 'https://example.com/image.jpg', type: 'image' },
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(true);
      });

      it('should pass when images exist but no content', () => {
        const input: ValidationInput = {
          tags: ['tag'],
          content: '',
          images: ['https://example.com/image.jpg'],
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(true);
      });
    });

    describe('external links validation', () => {
      it('should return error when multiple primary links exist', () => {
        const externalLinks: ExternalLink[] = [
          { id: '1', url: 'https://a.com', isPrimary: true },
          { id: '2', url: 'https://b.com', isPrimary: true },
        ];

        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some content',
          externalLinks,
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'externalLinks',
            code: 'MULTIPLE_PRIMARY_LINKS',
          })
        );
      });

      it('should return warning when no primary link is set', () => {
        const externalLinks: ExternalLink[] = [
          { id: '1', url: 'https://a.com', isPrimary: false },
          { id: '2', url: 'https://b.com', isPrimary: false },
        ];

        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some content',
          externalLinks,
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'externalLinks',
            code: 'NO_PRIMARY_LINK',
          })
        );
      });

      it('should return error for invalid URLs', () => {
        const externalLinks: ExternalLink[] = [
          { id: '1', url: 'not-a-valid-url', isPrimary: true },
        ];

        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some content',
          externalLinks,
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'externalLinks',
            code: 'INVALID_URL',
          })
        );
      });
    });

    describe('display image index validation', () => {
      it('should return error when displayImageIndex is out of bounds', () => {
        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some content',
          images: ['img1.jpg'],
          displayImageIndex: 5,
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'displayImageIndex',
            code: 'INVALID_DISPLAY_INDEX',
          })
        );
      });

      it('should pass when displayImageIndex is within bounds', () => {
        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some content',
          images: ['img1.jpg', 'img2.jpg'],
          displayImageIndex: 1,
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.isValid).toBe(true);
      });
    });

    describe('edit mode warnings', () => {
      it('should warn when images are being removed', () => {
        const originalArticle = {
          id: '1',
          images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
        } as Article;

        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some content',
          images: ['img1.jpg'],
        };

        const result = validateBeforeSave(originalArticle, input, 'edit');

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'images',
            code: 'IMAGES_REDUCED',
          })
        );
      });

      it('should warn when external links are being removed', () => {
        const originalArticle = {
          id: '1',
          externalLinks: [
            { id: '1', url: 'https://a.com', isPrimary: true },
            { id: '2', url: 'https://b.com', isPrimary: false },
          ],
        } as Article;

        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some content',
          externalLinks: [{ id: '1', url: 'https://a.com', isPrimary: true }],
        };

        const result = validateBeforeSave(originalArticle, input, 'edit');

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'externalLinks',
            code: 'EXTERNAL_LINKS_REDUCED',
          })
        );
      });

      it('should not warn when images are preserved', () => {
        const originalArticle = {
          id: '1',
          images: ['img1.jpg'],
        } as Article;

        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some content',
          images: ['img1.jpg', 'img2.jpg'],
        };

        const result = validateBeforeSave(originalArticle, input, 'edit');

        expect(result.warnings).not.toContainEqual(
          expect.objectContaining({
            code: 'IMAGES_REDUCED',
          })
        );
      });
    });

    describe('integrity checks', () => {
      it('should include integrity checks in result', () => {
        const input: ValidationInput = {
          tags: ['tag'],
          content: 'Some content',
        };

        const result = validateBeforeSave(null, input, 'create');

        expect(result.integrityChecks).toBeDefined();
        expect(result.integrityChecks.length).toBeGreaterThan(0);
        expect(result.integrityChecks).toContainEqual(
          expect.objectContaining({
            name: 'hasAtLeastOneTag',
            passed: true,
          })
        );
      });
    });
  });

  describe('formatValidationResult', () => {
    it('should format errors and warnings correctly', () => {
      const result: PreSaveValidationResult = {
        isValid: false,
        errors: [
          { field: 'tags', code: 'TAGS_REQUIRED', message: 'At least one tag is required' },
        ],
        warnings: [
          { field: 'externalLinks', code: 'NO_PRIMARY_LINK', message: 'No primary link set' },
        ],
        integrityChecks: [],
      };

      const formatted = formatValidationResult(result);

      expect(formatted).toContain('Errors:');
      expect(formatted).toContain('At least one tag is required');
      expect(formatted).toContain('Warnings:');
      expect(formatted).toContain('No primary link set');
    });

    it('should return empty string when no errors or warnings', () => {
      const result: PreSaveValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        integrityChecks: [],
      };

      const formatted = formatValidationResult(result);

      expect(formatted).toBe('');
    });
  });
});
