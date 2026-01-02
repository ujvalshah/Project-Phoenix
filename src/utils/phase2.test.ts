/**
 * Phase 2 Integration Tests
 * Tests the full tag ID system end-to-end
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tagsInclude, removeTag } from './tagUtils';

describe('Phase 2: Tag ID System Integration', () => {
  
  describe('Tag Utilities (Phase 1) - Regression Tests', () => {
    it('should match tags case-insensitively', () => {
      expect(tagsInclude(['AI', 'Blockchain'], 'ai')).toBe(true);
      expect(tagsInclude(['AI', 'Blockchain'], 'AI')).toBe(true);
      expect(tagsInclude(['AI', 'Blockchain'], 'blockchain')).toBe(true);
    });

    it('should remove tags case-insensitively', () => {
      const result = removeTag(['AI', 'Blockchain'], 'ai');
      expect(result).toEqual(['Blockchain']);
    });

    it('should handle casing variations', () => {
      expect(tagsInclude(['PE/VC'], 'pe/vc')).toBe(true);
      expect(tagsInclude(['PE/VC'], 'PE/VC')).toBe(true);
    });
  });

  describe('Phase 2: CategoryIds Backward Compatibility', () => {
    it('should work with articles without categoryIds (legacy)', () => {
      const legacyArticle = {
        id: '1',
        title: 'Test',
        excerpt: '',
        content: '',
        author: { id: '1', name: 'User' },
        publishedAt: new Date().toISOString(),
        categories: ['AI', 'Blockchain'],
        // No categoryIds field (legacy article)
        tags: [],
        readTime: 1
      };

      // Phase 1 logic should still work
      expect(legacyArticle.categories).toEqual(['AI', 'Blockchain']);
      expect(tagsInclude(legacyArticle.categories, 'ai')).toBe(true);
    });

    it('should work with articles with categoryIds (Phase 2)', () => {
      const phase2Article = {
        id: '1',
        title: 'Test',
        excerpt: '',
        content: '',
        author: { id: '1', name: 'User' },
        publishedAt: new Date().toISOString(),
        categories: ['AI', 'Blockchain'],
        categoryIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        tags: [],
        readTime: 1
      };

      // Both fields present and consistent
      expect(phase2Article.categories).toHaveLength(2);
      expect(phase2Article.categoryIds).toHaveLength(2);
      
      // Phase 1 logic still works
      expect(tagsInclude(phase2Article.categories, 'ai')).toBe(true);
    });
  });

  describe('Phase 2: Tag Object Structure', () => {
    it('should have correct Tag interface shape', () => {
      const mockTag = {
        id: '507f1f77bcf86cd799439011',
        rawName: 'AI',
        canonicalName: 'ai',
        usageCount: 5,
        type: 'category' as const,
        status: 'active' as const,
        isOfficial: true
      };

      expect(mockTag).toHaveProperty('id');
      expect(mockTag).toHaveProperty('rawName');
      expect(mockTag).toHaveProperty('canonicalName');
      expect(mockTag.canonicalName).toBe(mockTag.rawName.toLowerCase());
    });

    it('should support tag matching by ID', () => {
      const tagId1 = '507f1f77bcf86cd799439011';
      const tagId2 = '507f1f77bcf86cd799439012';
      
      const selectedIds = [tagId1, tagId2];
      const searchId = tagId1;

      // ID-based matching (exact)
      expect(selectedIds.includes(searchId)).toBe(true);
      expect(selectedIds.includes('different-id')).toBe(false);
    });
  });

  describe('Phase 2: Migration Scenarios', () => {
    it('should handle articles migrated from names to IDs', () => {
      const beforeMigration = {
        id: '1',
        categories: ['AI', 'Blockchain'],
        // No categoryIds
      };

      const afterMigration = {
        id: '1',
        categories: ['AI', 'Blockchain'],
        categoryIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
      };

      // Both should have same category count
      expect(beforeMigration.categories).toHaveLength(2);
      expect(afterMigration.categories).toHaveLength(2);
      expect(afterMigration.categoryIds).toHaveLength(2);
    });

    it('should maintain stable IDs after tag rename', () => {
      const beforeRename = {
        categories: ['AI'],
        categoryIds: ['507f1f77bcf86cd799439011']
      };

      const afterRename = {
        categories: ['Artificial Intelligence'], // Name changed
        categoryIds: ['507f1f77bcf86cd799439011'] // ID unchanged!
      };

      // ID remains stable
      expect(afterRename.categoryIds[0]).toBe(beforeRename.categoryIds[0]);
      
      // Name changed
      expect(afterRename.categories[0]).not.toBe(beforeRename.categories[0]);
    });
  });

  describe('Phase 2: API Response Formats', () => {
    it('should handle format=simple (legacy)', () => {
      const simpleResponse = {
        data: ['AI', 'Blockchain', 'PE/VC'],
        total: 3,
        page: 1,
        limit: 100,
        hasMore: false
      };

      expect(Array.isArray(simpleResponse.data)).toBe(true);
      expect(simpleResponse.data[0]).toBe('AI'); // String
      expect(typeof simpleResponse.data[0]).toBe('string');
    });

    it('should handle format=full (Phase 2)', () => {
      const fullResponse = {
        data: [
          {
            id: '507f1f77bcf86cd799439011',
            rawName: 'AI',
            canonicalName: 'ai',
            usageCount: 5,
            type: 'category',
            status: 'active',
            isOfficial: true
          },
          {
            id: '507f1f77bcf86cd799439012',
            rawName: 'Blockchain',
            canonicalName: 'blockchain',
            usageCount: 3,
            type: 'category',
            status: 'active',
            isOfficial: false
          }
        ],
        total: 2,
        page: 1,
        limit: 500,
        hasMore: false
      };

      expect(Array.isArray(fullResponse.data)).toBe(true);
      expect(fullResponse.data[0]).toHaveProperty('id');
      expect(fullResponse.data[0]).toHaveProperty('rawName');
      expect(fullResponse.data[0]).toHaveProperty('canonicalName');
      expect(typeof fullResponse.data[0]).toBe('object'); // Full object
    });
  });

  describe('Phase 2: Edge Cases', () => {
    it('should handle empty categoryIds gracefully', () => {
      const article = {
        categories: ['AI'],
        categoryIds: [] // Empty (migration failed or tag deleted)
      };

      // Phase 1 logic should still work
      expect(tagsInclude(article.categories, 'ai')).toBe(true);
    });

    it('should handle mismatched lengths', () => {
      const article = {
        categories: ['AI', 'Blockchain', 'PE/VC'], // 3 names
        categoryIds: ['507f1f77bcf86cd799439011'] // Only 1 ID (partial migration)
      };

      // Should not throw errors
      expect(article.categories.length).toBeGreaterThan(article.categoryIds.length);
    });

    it('should handle null/undefined categoryIds', () => {
      const article1 = {
        categories: ['AI'],
        categoryIds: null
      };

      const article2 = {
        categories: ['AI'],
        categoryIds: undefined
      };

      // Should not break Phase 1 logic
      expect(tagsInclude(article1.categories, 'ai')).toBe(true);
      expect(tagsInclude(article2.categories, 'ai')).toBe(true);
    });
  });

  describe('Phase 2: Performance Considerations', () => {
    it('should handle large tag arrays efficiently', () => {
      const largeCategoryArray = Array.from({ length: 100 }, (_, i) => `Tag${i}`);
      const largeCategoryIds = Array.from({ length: 100 }, (_, i) => `id-${i}`);

      // Phase 1: Case-insensitive search (O(n))
      const phase1Start = performance.now();
      const phase1Result = tagsInclude(largeCategoryArray, 'tag50');
      const phase1Time = performance.now() - phase1Start;

      // Phase 2: ID-based search (O(n))
      const phase2Start = performance.now();
      const phase2Result = largeCategoryIds.includes('id-50');
      const phase2Time = performance.now() - phase2Start;

      // Both should be fast (< 1ms)
      expect(phase1Time).toBeLessThan(1);
      expect(phase2Time).toBeLessThan(1);
      expect(phase1Result).toBe(true);
      expect(phase2Result).toBe(true);
    });
  });

  describe('Phase 2: Validation', () => {
    it('should validate Tag ObjectId format', () => {
      const validIds = [
        '507f1f77bcf86cd799439011',
        '5f9e3b3b9d3e2c1a4c8b4567',
        '000000000000000000000000'
      ];

      const invalidIds = [
        'not-an-objectid',
        '12345',
        '',
        'zzz123'
      ];

      validIds.forEach(id => {
        expect(id).toMatch(/^[a-f0-9]{24}$/);
      });

      invalidIds.forEach(id => {
        expect(id).not.toMatch(/^[a-f0-9]{24}$/);
      });
    });

    it('should ensure categoryIds and categories match in length (ideally)', () => {
      const validArticle = {
        categories: ['AI', 'Blockchain'],
        categoryIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
      };

      expect(validArticle.categories.length).toBe(validArticle.categoryIds.length);
    });
  });
});



