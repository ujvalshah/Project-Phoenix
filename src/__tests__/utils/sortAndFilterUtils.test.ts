/**
 * Tests for src/utils/sortAndFilter.ts
 *
 * Covers: compareValues, sortBy, filterByDate, filterByText
 */

import { describe, it, expect } from 'vitest';
import {
  compareValues,
  sortBy,
  filterByDate,
  filterByText,
  type SortConfig,
} from '@/utils/sortAndFilter';

// ---------------------------------------------------------------------------
// compareValues
// ---------------------------------------------------------------------------

describe('compareValues', () => {
  it('compares strings case-insensitively', () => {
    expect(compareValues('apple', 'Banana', 'asc')).toBeLessThan(0);
    expect(compareValues('Banana', 'apple', 'asc')).toBeGreaterThan(0);
  });

  it('compares numbers', () => {
    expect(compareValues(1, 2, 'asc')).toBeLessThan(0);
    expect(compareValues(2, 1, 'asc')).toBeGreaterThan(0);
    expect(compareValues(5, 5, 'asc')).toBe(0);
  });

  it('reverses order for desc direction', () => {
    expect(compareValues(1, 2, 'desc')).toBeGreaterThan(0);
    expect(compareValues('apple', 'Banana', 'desc')).toBeGreaterThan(0);
  });

  it('sorts nullish values last regardless of direction', () => {
    expect(compareValues(null, 'a', 'asc')).toBe(1);
    expect(compareValues(null, 'a', 'desc')).toBe(1);
    expect(compareValues('a', undefined, 'asc')).toBe(-1);
    expect(compareValues('a', undefined, 'desc')).toBe(-1);
  });

  it('treats two nullish values as equal', () => {
    expect(compareValues(null, undefined, 'asc')).toBe(0);
    expect(compareValues('', '', 'asc')).toBe(0);
  });

  it('compares booleans (false < true)', () => {
    expect(compareValues(false, true, 'asc')).toBeLessThan(0);
    expect(compareValues(true, false, 'asc')).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// sortBy
// ---------------------------------------------------------------------------

interface TestItem {
  id: number;
  name: string;
  date: string;
  score: number;
}

const items: TestItem[] = [
  { id: 1, name: 'Charlie', date: '2024-03-01', score: 90 },
  { id: 2, name: 'Alice', date: '2024-01-15', score: 85 },
  { id: 3, name: 'Bob', date: '2024-02-10', score: 90 },
];

const extractor = (item: TestItem, key: string): unknown => {
  switch (key) {
    case 'name': return item.name;
    case 'date': return new Date(item.date).getTime();
    case 'score': return item.score;
    default: return (item as unknown as Record<string, unknown>)[key];
  }
};

describe('sortBy', () => {
  it('sorts by single key ascending', () => {
    const sorted = sortBy(items, [{ key: 'name', direction: 'asc' }], extractor);
    expect(sorted.map(i => i.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('sorts by single key descending', () => {
    const sorted = sortBy(items, [{ key: 'date', direction: 'desc' }], extractor);
    expect(sorted.map(i => i.id)).toEqual([1, 3, 2]);
  });

  it('handles multi-column sort (primary + tiebreaker)', () => {
    const sorts: SortConfig[] = [
      { key: 'score', direction: 'desc' },
      { key: 'name', direction: 'asc' },
    ];
    const sorted = sortBy(items, sorts, extractor);
    // score 90: Bob, Charlie (alphabetical); then score 85: Alice
    expect(sorted.map(i => i.name)).toEqual(['Bob', 'Charlie', 'Alice']);
  });

  it('returns a new array (non-mutating)', () => {
    const sorted = sortBy(items, [{ key: 'name', direction: 'asc' }], extractor);
    expect(sorted).not.toBe(items);
    expect(items[0].name).toBe('Charlie'); // original unchanged
  });

  it('returns copy when no sorts provided', () => {
    const sorted = sortBy(items, [], extractor);
    expect(sorted).toEqual(items);
    expect(sorted).not.toBe(items);
  });
});

// ---------------------------------------------------------------------------
// filterByDate
// ---------------------------------------------------------------------------

interface Dated { id: number; createdAt: string }

describe('filterByDate', () => {
  // Use dates that are unambiguous across timezones (noon UTC)
  const data: Dated[] = [
    { id: 1, createdAt: '2024-06-15T12:00:00Z' },
    { id: 2, createdAt: '2024-06-15T13:00:00Z' },
    { id: 3, createdAt: '2024-06-16T12:00:00Z' },
  ];

  it('filters to matching calendar date', () => {
    // Use the same local-date representation as the data to avoid TZ issues
    const targetDate = new Date('2024-06-15T12:00:00Z').toISOString().split('T')[0];
    const result = filterByDate(data, targetDate, d => d.createdAt);
    expect(result.map(d => d.id)).toEqual([1, 2]);
  });

  it('returns all items when dateStr is empty', () => {
    const result = filterByDate(data, '', d => d.createdAt);
    expect(result.length).toBe(3);
  });

  it('returns empty when no items match', () => {
    const result = filterByDate(data, '2020-01-01', d => d.createdAt);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterByText
// ---------------------------------------------------------------------------

interface Named { id: number; name: string; description?: string }

describe('filterByText', () => {
  const data: Named[] = [
    { id: 1, name: 'React Hooks Guide', description: 'Advanced patterns' },
    { id: 2, name: 'Vue Composition API' },
    { id: 3, name: 'Angular Signals', description: 'Reactive hooks in Angular' },
  ];

  it('searches across multiple fields case-insensitively', () => {
    const result = filterByText(data, 'hooks', [
      d => d.name,
      d => d.description,
    ]);
    // "hooks" appears in item 1 name and item 3 description
    expect(result.map(d => d.id)).toEqual([1, 3]);
  });

  it('returns all items when query is empty', () => {
    const result = filterByText(data, '', [d => d.name]);
    expect(result.length).toBe(3);
  });

  it('returns all items when query is whitespace', () => {
    const result = filterByText(data, '   ', [d => d.name]);
    expect(result.length).toBe(3);
  });

  it('returns empty when no match', () => {
    const result = filterByText(data, 'svelte', [d => d.name, d => d.description]);
    expect(result).toEqual([]);
  });

  it('handles undefined field values without error', () => {
    const result = filterByText(data, 'advanced', [d => d.description]);
    expect(result.map(d => d.id)).toEqual([1]);
  });
});
