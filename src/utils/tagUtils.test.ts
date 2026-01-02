import { describe, it, expect } from 'vitest';
import {
  normalizeTag,
  tagsMatch,
  findTagIndex,
  tagsInclude,
  removeTag,
  findTag,
  deduplicateTags
} from './tagUtils';

describe('tagUtils', () => {
  describe('normalizeTag', () => {
    it('should lowercase and trim tags', () => {
      expect(normalizeTag('  AI  ')).toBe('ai');
      expect(normalizeTag('PE/VC')).toBe('pe/vc');
      expect(normalizeTag('Machine Learning')).toBe('machine learning');
      expect(normalizeTag('BLOCKCHAIN')).toBe('blockchain');
    });

    it('should handle empty and whitespace strings', () => {
      expect(normalizeTag('')).toBe('');
      expect(normalizeTag('   ')).toBe('');
    });

    it('should preserve special characters', () => {
      expect(normalizeTag('C++')).toBe('c++');
      expect(normalizeTag('Node.js')).toBe('node.js');
      expect(normalizeTag('Web3.0')).toBe('web3.0');
    });
  });

  describe('tagsMatch', () => {
    it('should match tags case-insensitively', () => {
      expect(tagsMatch('AI', 'ai')).toBe(true);
      expect(tagsMatch('PE/VC', 'pe/vc')).toBe(true);
      expect(tagsMatch('Blockchain', 'BLOCKCHAIN')).toBe(true);
      expect(tagsMatch('  AI  ', 'ai')).toBe(true);
    });

    it('should return false for non-matching tags', () => {
      expect(tagsMatch('AI', 'Blockchain')).toBe(false);
      expect(tagsMatch('PE/VC', 'Reports')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(tagsMatch('', '')).toBe(true);
      expect(tagsMatch('AI', '')).toBe(false);
      expect(tagsMatch('', 'AI')).toBe(false);
    });
  });

  describe('findTagIndex', () => {
    it('should find tag index case-insensitively', () => {
      const tags = ['AI', 'Blockchain', 'PE/VC'];
      expect(findTagIndex(tags, 'ai')).toBe(0);
      expect(findTagIndex(tags, 'blockchain')).toBe(1);
      expect(findTagIndex(tags, 'pe/vc')).toBe(2);
      expect(findTagIndex(tags, 'AI')).toBe(0);
    });

    it('should return -1 for non-existent tags', () => {
      const tags = ['AI', 'Blockchain'];
      expect(findTagIndex(tags, 'Reports')).toBe(-1);
      expect(findTagIndex(tags, 'India')).toBe(-1);
    });

    it('should handle empty arrays', () => {
      expect(findTagIndex([], 'AI')).toBe(-1);
    });
  });

  describe('tagsInclude', () => {
    it('should check tag existence case-insensitively', () => {
      const tags = ['AI', 'Blockchain', 'PE/VC'];
      expect(tagsInclude(tags, 'ai')).toBe(true);
      expect(tagsInclude(tags, 'BLOCKCHAIN')).toBe(true);
      expect(tagsInclude(tags, 'pe/vc')).toBe(true);
      expect(tagsInclude(tags, '  AI  ')).toBe(true);
    });

    it('should return false for non-existent tags', () => {
      const tags = ['AI', 'Blockchain'];
      expect(tagsInclude(tags, 'Reports')).toBe(false);
      expect(tagsInclude(tags, 'India')).toBe(false);
    });

    it('should handle empty arrays', () => {
      expect(tagsInclude([], 'AI')).toBe(false);
    });
  });

  describe('removeTag', () => {
    it('should remove tag case-insensitively', () => {
      const tags = ['AI', 'Blockchain', 'PE/VC'];
      expect(removeTag(tags, 'ai')).toEqual(['Blockchain', 'PE/VC']);
      expect(removeTag(tags, 'BLOCKCHAIN')).toEqual(['AI', 'PE/VC']);
      expect(removeTag(tags, 'pe/vc')).toEqual(['AI', 'Blockchain']);
    });

    it('should return unchanged array for non-existent tags', () => {
      const tags = ['AI', 'Blockchain'];
      expect(removeTag(tags, 'Reports')).toEqual(['AI', 'Blockchain']);
    });

    it('should remove all case variants', () => {
      const tags = ['AI', 'ai', 'Ai', 'Blockchain'];
      const result = removeTag(tags, 'AI');
      expect(result).toEqual(['Blockchain']);
    });

    it('should handle empty arrays', () => {
      expect(removeTag([], 'AI')).toEqual([]);
    });

    it('should not mutate original array', () => {
      const tags = ['AI', 'Blockchain'];
      const result = removeTag(tags, 'AI');
      expect(tags).toEqual(['AI', 'Blockchain']);
      expect(result).toEqual(['Blockchain']);
    });
  });

  describe('findTag', () => {
    it('should find tag with original casing', () => {
      const tags = ['AI', 'Blockchain', 'PE/VC'];
      expect(findTag(tags, 'ai')).toBe('AI');
      expect(findTag(tags, 'BLOCKCHAIN')).toBe('Blockchain');
      expect(findTag(tags, 'pe/vc')).toBe('PE/VC');
    });

    it('should return undefined for non-existent tags', () => {
      const tags = ['AI', 'Blockchain'];
      expect(findTag(tags, 'Reports')).toBeUndefined();
    });

    it('should handle empty arrays', () => {
      expect(findTag([], 'AI')).toBeUndefined();
    });
  });

  describe('deduplicateTags', () => {
    it('should remove case-insensitive duplicates', () => {
      const tags = ['AI', 'ai', 'Blockchain', 'blockchain', 'AI'];
      const result = deduplicateTags(tags);
      expect(result).toEqual(['AI', 'Blockchain']);
    });

    it('should keep first occurrence', () => {
      const tags = ['ai', 'AI', 'Ai'];
      const result = deduplicateTags(tags);
      expect(result).toEqual(['ai']);
    });

    it('should handle arrays without duplicates', () => {
      const tags = ['AI', 'Blockchain', 'PE/VC'];
      const result = deduplicateTags(tags);
      expect(result).toEqual(['AI', 'Blockchain', 'PE/VC']);
    });

    it('should handle empty arrays', () => {
      expect(deduplicateTags([])).toEqual([]);
    });

    it('should not mutate original array', () => {
      const tags = ['AI', 'ai', 'Blockchain'];
      const result = deduplicateTags(tags);
      expect(tags).toEqual(['AI', 'ai', 'Blockchain']);
      expect(result).toEqual(['AI', 'Blockchain']);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle edit modal tag matching', () => {
      // Scenario: Article created with "AI", admin renamed tag to "Ai"
      const articleCategories = ['AI', 'Blockchain'];
      const availableCategories = ['Ai', 'Blockchain', 'Reports'];

      // Check if "Ai" from available should be selected
      expect(tagsInclude(articleCategories, 'Ai')).toBe(true);
      expect(tagsInclude(articleCategories, 'Blockchain')).toBe(true);
      expect(tagsInclude(articleCategories, 'Reports')).toBe(false);
    });

    it('should handle tag deselection with casing differences', () => {
      // Scenario: User deselects "Ai" but article has "AI"
      const selected = ['AI', 'Blockchain'];
      const toRemove = 'Ai';

      const result = removeTag(selected, toRemove);
      expect(result).toEqual(['Blockchain']);
    });

    it('should handle duplicate prevention', () => {
      // Scenario: User tries to add "ai" when "AI" already selected
      const selected = ['AI', 'Blockchain'];
      const toAdd = 'ai';

      expect(tagsInclude(selected, toAdd)).toBe(true);  // Should detect duplicate
    });

    it('should handle tag data from multiple sources', () => {
      // Scenario: Mixing tags from different API calls with different casing
      const fromBackend = ['AI', 'pe/vc', 'Blockchain'];
      const fromArticle = ['ai', 'PE/VC', 'blockchain', 'Reports'];

      // Find which backend tags match article tags
      const matches = fromBackend.filter(tag => tagsInclude(fromArticle, tag));
      expect(matches).toEqual(['AI', 'pe/vc', 'Blockchain']);
    });
  });
});



