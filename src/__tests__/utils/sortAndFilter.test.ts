/**
 * Sort stability and filter edge-case tests
 *
 * Pure function tests for sorting determinism, null handling,
 * and filter boundary conditions.
 */

import { describe, it, expect } from 'vitest';
import { createMockArticle, verifyArticleOrder, verifyNoDuplicates } from './mockArticles';
import { Article } from '@/types';

// ---------------------------------------------------------------------------
// Sort stability: ties, nulls, mixed types
// ---------------------------------------------------------------------------

describe('sort stability', () => {
  it('maintains deterministic order when publishedAt values are identical', () => {
    const sameDate = '2024-06-15T12:00:00.000Z';
    const articles: Article[] = [
      createMockArticle(3, sameDate),
      createMockArticle(1, sameDate),
      createMockArticle(2, sameDate),
    ];

    // Sort descending by publishedAt, then descending by ID (simulates backend)
    const sorted = [...articles].sort((a, b) => {
      const dateDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (dateDiff !== 0) return dateDiff;
      // Secondary sort: higher ID first (matches MongoDB _id descending)
      const idA = parseInt(a.id.split('-')[1]);
      const idB = parseInt(b.id.split('-')[1]);
      return idB - idA;
    });

    expect(sorted.map(a => a.id)).toEqual(['article-3', 'article-2', 'article-1']);
    expect(verifyArticleOrder(sorted)).toBe(true);
  });

  it('handles articles with undefined title for title sort', () => {
    const articles: Article[] = [
      { ...createMockArticle(1), title: undefined },
      { ...createMockArticle(2), title: 'Beta Article' },
      { ...createMockArticle(3), title: 'Alpha Article' },
    ];

    const sorted = [...articles].sort((a, b) => {
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });

    // Empty string sorts first
    expect(sorted[0].id).toBe('article-1');
    expect(sorted[1].title).toBe('Alpha Article');
    expect(sorted[2].title).toBe('Beta Article');
  });

  it('title sort is case-insensitive', () => {
    const articles: Article[] = [
      { ...createMockArticle(1), title: 'zebra' },
      { ...createMockArticle(2), title: 'Apple' },
      { ...createMockArticle(3), title: 'banana' },
    ];

    const sorted = [...articles].sort((a, b) => {
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });

    expect(sorted.map(a => a.title)).toEqual(['Apple', 'banana', 'zebra']);
  });

  it('handles mixed valid and invalid dates gracefully', () => {
    const articles: Article[] = [
      { ...createMockArticle(1), publishedAt: '2024-06-15T00:00:00.000Z' },
      { ...createMockArticle(2), publishedAt: '' }, // empty
      { ...createMockArticle(3), publishedAt: '2024-06-16T00:00:00.000Z' },
    ];

    const sorted = [...articles].sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime() || 0;
      const dateB = new Date(b.publishedAt).getTime() || 0;
      return dateB - dateA;
    });

    // Valid dates first (descending), then invalid
    expect(sorted[0].id).toBe('article-3');
    expect(sorted[1].id).toBe('article-1');
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('deduplication', () => {
  it('verifyNoDuplicates detects duplicates', () => {
    const articles = [createMockArticle(1), createMockArticle(2), createMockArticle(1)];
    expect(verifyNoDuplicates(articles)).toBe(false);
  });

  it('verifyNoDuplicates passes for unique articles', () => {
    const articles = [createMockArticle(1), createMockArticle(2), createMockArticle(3)];
    expect(verifyNoDuplicates(articles)).toBe(true);
  });

  it('Set-based dedup preserves insertion order (first occurrence wins)', () => {
    const articles = [
      createMockArticle(1),
      createMockArticle(2),
      createMockArticle(1), // duplicate
      createMockArticle(3),
      createMockArticle(2), // duplicate
    ];

    const seen = new Set<string>();
    const deduplicated: Article[] = [];
    for (const article of articles) {
      if (article?.id && !seen.has(article.id)) {
        seen.add(article.id);
        deduplicated.push(article);
      }
    }

    expect(deduplicated.map(a => a.id)).toEqual(['article-1', 'article-2', 'article-3']);
    expect(verifyNoDuplicates(deduplicated)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filter edge cases
// ---------------------------------------------------------------------------

describe('filter edge cases', () => {
  it('empty results when no articles match tag filter', () => {
    const articles = [
      createMockArticle(1),
      createMockArticle(2),
    ];

    const filtered = articles.filter(a =>
      a.tags.includes('nonexistent-tag')
    );

    expect(filtered).toEqual([]);
  });

  it('all articles returned when tag filter is null', () => {
    const articles = [createMockArticle(1), createMockArticle(2)];
    const tag: string | null = null;

    const filtered = tag
      ? articles.filter(a => a.tags.includes(tag))
      : articles;

    expect(filtered.length).toBe(2);
  });

  it('handles articles with empty tags array', () => {
    const articles: Article[] = [
      { ...createMockArticle(1), tags: [] },
      { ...createMockArticle(2), tags: ['react'] },
    ];

    const filtered = articles.filter(a => a.tags.includes('react'));
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('article-2');
  });

  it('category filter is case-sensitive by default on client', () => {
    const articles: Article[] = [
      { ...createMockArticle(1), tags: ['React'] },
      { ...createMockArticle(2), tags: ['react'] },
    ];

    // Client-side exact match (server uses case-insensitive regex)
    const filtered = articles.filter(a => a.tags.includes('React'));
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('article-1');
  });

  it('handles zero articles (empty dataset)', () => {
    const articles: Article[] = [];
    const tag = 'anything';

    const filtered = tag ? articles.filter(a => a.tags.includes(tag)) : articles;
    expect(filtered).toEqual([]);
  });

  it('conflicting filters: category + tag that never overlap still return empty', () => {
    // Simulates user selecting a category AND a tag that no article has together
    const articles: Article[] = [
      { ...createMockArticle(1), tags: ['Tech'] },
      { ...createMockArticle(2), tags: ['Science'] },
    ];

    // Filter by category "Tech" (server-side) then tag "Science" (was client-side, now also server-side)
    // In the old architecture, this would fail silently. In the new architecture,
    // both are sent to the server and combined.
    const afterCategory = articles.filter(a => a.tags.includes('Tech'));
    const afterTag = afterCategory.filter(a => a.tags.includes('Science'));

    expect(afterTag).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Pagination boundary edge cases
// ---------------------------------------------------------------------------

describe('pagination boundary', () => {
  it('last page with fewer items than limit', () => {
    // 7 items total, limit 5 → page 2 has 2 items
    const total = 7;
    const limit = 5;
    const page = 2;
    const startId = (page - 1) * limit + 1; // 6
    const endId = Math.min(page * limit, total); // 7
    const itemsInPage = endId - startId + 1; // 2

    expect(itemsInPage).toBe(2);
    expect(page * limit >= total).toBe(true); // hasMore = false
  });

  it('exact boundary: total is exact multiple of limit', () => {
    const total = 50;
    const limit = 25;
    const page2HasMore = 2 * limit < total;
    const page3HasMore = 3 * limit < total;

    expect(page2HasMore).toBe(false); // 50 < 50 → false
    expect(page3HasMore).toBe(false);
  });

  it('single item total', () => {
    const total = 1;
    const limit = 25;
    const hasMore = 1 * limit < total;
    expect(hasMore).toBe(false);
  });
});
