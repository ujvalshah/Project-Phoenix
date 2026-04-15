import { describe, it, expect } from 'vitest';
import {
  buildItemIdsMatchingBookmarkQuery,
  paginateInMemory
} from '../utils/bookmarkListSearch.js';

describe('buildItemIdsMatchingBookmarkQuery', () => {
  const articles = [
    { _id: { toString: () => 'a1' }, title: 'Hello World', content: '', excerpt: '' },
    { _id: { toString: () => 'a2' }, title: 'Other', content: 'hidden needle', excerpt: '' },
    { _id: { toString: () => 'a3' }, title: 'X', content: '', excerpt: 'SUMMARY hello' }
  ];

  it('matches title, content, and excerpt (case-insensitive)', () => {
    const byTitle = buildItemIdsMatchingBookmarkQuery(articles, 'hello');
    expect([...byTitle].sort()).toEqual(['a1', 'a3']);
    const byContent = buildItemIdsMatchingBookmarkQuery(articles, 'needle');
    expect([...byContent]).toEqual(['a2']);
  });

  it('returns empty set when nothing matches', () => {
    expect(buildItemIdsMatchingBookmarkQuery(articles, 'zzz').size).toBe(0);
  });
});

describe('paginateInMemory', () => {
  const items = [1, 2, 3, 4, 5];

  it('page 1 with limit 2', () => {
    expect(paginateInMemory(items, 1, 2)).toEqual({
      pageItems: [1, 2],
      total: 5,
      hasMore: true
    });
  });

  it('last page hasMore false', () => {
    expect(paginateInMemory(items, 3, 2)).toEqual({
      pageItems: [5],
      total: 5,
      hasMore: false
    });
  });

  it('full page on last boundary', () => {
    const six = [1, 2, 3, 4, 5, 6];
    expect(paginateInMemory(six, 3, 2)).toEqual({
      pageItems: [5, 6],
      total: 6,
      hasMore: false
    });
  });
});
