import { describe, it, expect } from 'vitest';
import { filtersToParams, paramsToFilters } from '@/hooks/useFilterState';
import type { SerializableFilterState } from '@/types';

describe('filtersToParams', () => {
  it('returns empty params for default state', () => {
    const result = filtersToParams({});
    expect(result.toString()).toBe('');
  });

  it('serialises search query', () => {
    const result = filtersToParams({ q: 'hello world' });
    expect(result.get('q')).toBe('hello world');
  });

  it('serialises categories as repeated "cat" params', () => {
    const result = filtersToParams({ categories: ['Tech', 'Science'] });
    expect(result.getAll('cat')).toEqual(['Tech', 'Science']);
  });

  it('serialises tag', () => {
    const result = filtersToParams({ tag: 'react' });
    expect(result.get('tag')).toBe('react');
  });

  it('omits sort when "latest" (default)', () => {
    const result = filtersToParams({ sort: 'latest' });
    expect(result.has('sort')).toBe(false);
  });

  it('includes non-default sort', () => {
    const result = filtersToParams({ sort: 'title' });
    expect(result.get('sort')).toBe('title');
  });

  it('serialises boolean flags as "1"', () => {
    const result = filtersToParams({ favorites: true, unread: true });
    expect(result.get('favorites')).toBe('1');
    expect(result.get('unread')).toBe('1');
  });

  it('omits false boolean flags', () => {
    const result = filtersToParams({ favorites: false, unread: false });
    expect(result.has('favorites')).toBe(false);
    expect(result.has('unread')).toBe(false);
  });

  it('serialises formats as repeated "fmt" params', () => {
    const result = filtersToParams({ formats: ['video', 'link'] });
    expect(result.getAll('fmt')).toEqual(['video', 'link']);
  });

  it('omits default timeRange ("all")', () => {
    const result = filtersToParams({ timeRange: 'all' });
    expect(result.has('time')).toBe(false);
  });

  it('includes non-default timeRange', () => {
    const result = filtersToParams({ timeRange: '24h' });
    expect(result.get('time')).toBe('24h');
  });
});

describe('paramsToFilters', () => {
  it('returns defaults for empty params', () => {
    const result = paramsToFilters(new URLSearchParams());
    expect(result.q).toBeUndefined();
    expect(result.categories).toEqual([]);
    expect(result.tag).toBeUndefined();
    expect(result.sort).toBeUndefined();
    expect(result.favorites).toBeUndefined();
    expect(result.unread).toBeUndefined();
    expect(result.formats).toEqual([]);
    expect(result.timeRange).toBeUndefined();
  });

  it('parses search query', () => {
    const result = paramsToFilters(new URLSearchParams('q=test'));
    expect(result.q).toBe('test');
  });

  it('parses multiple categories', () => {
    const result = paramsToFilters(new URLSearchParams('cat=Tech&cat=Science'));
    expect(result.categories).toEqual(['Tech', 'Science']);
  });

  it('parses tag', () => {
    const result = paramsToFilters(new URLSearchParams('tag=react'));
    expect(result.tag).toBe('react');
  });

  it('parses valid sort values', () => {
    expect(paramsToFilters(new URLSearchParams('sort=oldest')).sort).toBe('oldest');
    expect(paramsToFilters(new URLSearchParams('sort=title')).sort).toBe('title');
    expect(paramsToFilters(new URLSearchParams('sort=title-desc')).sort).toBe('title-desc');
  });

  it('ignores invalid sort values', () => {
    expect(paramsToFilters(new URLSearchParams('sort=invalid')).sort).toBeUndefined();
  });

  it('parses boolean flags', () => {
    const result = paramsToFilters(new URLSearchParams('favorites=1&unread=1'));
    expect(result.favorites).toBe(true);
    expect(result.unread).toBe(true);
  });

  it('treats non-"1" boolean as falsy', () => {
    const result = paramsToFilters(new URLSearchParams('favorites=yes'));
    expect(result.favorites).toBeUndefined();
  });

  it('parses formats', () => {
    const result = paramsToFilters(new URLSearchParams('fmt=video&fmt=link'));
    expect(result.formats).toEqual(['video', 'link']);
  });

  it('parses valid timeRange', () => {
    expect(paramsToFilters(new URLSearchParams('time=24h')).timeRange).toBe('24h');
    expect(paramsToFilters(new URLSearchParams('time=7d')).timeRange).toBe('7d');
  });

  it('ignores invalid timeRange', () => {
    expect(paramsToFilters(new URLSearchParams('time=30d')).timeRange).toBeUndefined();
  });
});

describe('round-trip: filtersToParams → paramsToFilters', () => {
  it('preserves a full filter state through serialisation', () => {
    const original: SerializableFilterState = {
      q: 'climate change',
      categories: ['Science', 'Today'],
      tag: 'environment',
      sort: 'oldest',
      favorites: true,
      unread: false,
      formats: ['video', 'document'],
      timeRange: '7d',
    };

    const params = filtersToParams(original);
    const restored = paramsToFilters(params);

    expect(restored.q).toBe(original.q);
    expect(restored.categories).toEqual(original.categories);
    expect(restored.tag).toBe(original.tag);
    expect(restored.sort).toBe(original.sort);
    expect(restored.favorites).toBe(true);
    // unread is false → not serialised → restored as undefined (falsy)
    expect(restored.unread).toBeFalsy();
    expect(restored.formats).toEqual(original.formats);
    expect(restored.timeRange).toBe(original.timeRange);
  });

  it('handles empty/default state round-trip', () => {
    const params = filtersToParams({});
    const restored = paramsToFilters(params);
    expect(restored.categories).toEqual([]);
    expect(restored.formats).toEqual([]);
  });
});

describe('edge cases', () => {
  it('handles special characters in search query', () => {
    const params = filtersToParams({ q: 'hello & world = "test"' });
    const restored = paramsToFilters(params);
    expect(restored.q).toBe('hello & world = "test"');
  });

  it('handles empty string values', () => {
    const result = filtersToParams({ q: '', tag: '' });
    expect(result.has('q')).toBe(false);
    expect(result.has('tag')).toBe(false);
  });

  it('handles empty arrays', () => {
    const result = filtersToParams({ categories: [], formats: [] });
    expect(result.has('cat')).toBe(false);
    expect(result.has('fmt')).toBe(false);
  });
});
