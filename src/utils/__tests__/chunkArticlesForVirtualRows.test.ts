import { describe, expect, it } from 'vitest';
import { chunkArticlesForVirtualRows } from '@/utils/chunkArticlesForVirtualRows';

describe('chunkArticlesForVirtualRows', () => {
  it('returns empty for empty input', () => {
    expect(chunkArticlesForVirtualRows([], 4)).toEqual([]);
  });

  it('wraps each item when columnCount is 1', () => {
    expect(chunkArticlesForVirtualRows(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
  });

  it('chunks by column count', () => {
    expect(chunkArticlesForVirtualRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkArticlesForVirtualRows([1, 2, 3, 4], 4)).toEqual([[1, 2, 3, 4]]);
  });

  it('treats non-positive column count as single-column rows', () => {
    expect(chunkArticlesForVirtualRows(['x', 'y'], 0)).toEqual([['x'], ['y']]);
  });
});
