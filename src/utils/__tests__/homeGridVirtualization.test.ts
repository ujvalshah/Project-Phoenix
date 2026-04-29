import { describe, expect, it } from 'vitest';
import {
  chunkIntoGridRows,
  estimateHomeGridRowHeightPx,
  flatIndexToRowIndex,
  gridRowGapPx,
} from '@/utils/homeGridVirtualization';

describe('homeGridVirtualization', () => {
  describe('chunkIntoGridRows', () => {
    it('returns empty rows for columnCount < 1', () => {
      expect(chunkIntoGridRows([1, 2, 3], 0)).toEqual([]);
    });

    it('chunks items into full and partial last row', () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      expect(chunkIntoGridRows(items, 2)).toEqual([
        ['a', 'b'],
        ['c', 'd'],
        ['e'],
      ]);
    });

    it('produces one row per item when columnCount is 1', () => {
      expect(chunkIntoGridRows(['x', 'y'], 1)).toEqual([['x'], ['y']]);
    });
  });

  describe('flatIndexToRowIndex', () => {
    it('maps flat index to row for multi-column', () => {
      expect(flatIndexToRowIndex(0, 3)).toBe(0);
      expect(flatIndexToRowIndex(2, 3)).toBe(0);
      expect(flatIndexToRowIndex(3, 3)).toBe(1);
      expect(flatIndexToRowIndex(5, 3)).toBe(1);
      expect(flatIndexToRowIndex(6, 3)).toBe(2);
    });

    it('returns 0 when columnCount < 1', () => {
      expect(flatIndexToRowIndex(10, 0)).toBe(0);
    });
  });

  describe('estimateHomeGridRowHeightPx', () => {
    it('returns a positive height from width and columns', () => {
      const h = estimateHomeGridRowHeightPx(800, 4);
      expect(h).toBeGreaterThan(100);
    });
  });

  describe('gridRowGapPx', () => {
    it('matches Tailwind gap-6 (24px)', () => {
      expect(gridRowGapPx()).toBe(24);
    });
  });
});
