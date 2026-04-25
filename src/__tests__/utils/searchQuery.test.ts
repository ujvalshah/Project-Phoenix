import { describe, expect, it } from 'vitest';
import { normalizeSearchQuery } from '@/utils/searchQuery';

describe('normalizeSearchQuery', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeSearchQuery('   Iconiq   ')).toBe('Iconiq');
  });

  it('collapses repeated internal whitespace', () => {
    expect(normalizeSearchQuery('Iconiq    Market   Update')).toBe('Iconiq Market Update');
  });

  it('preserves original casing for backend case-insensitive search', () => {
    expect(normalizeSearchQuery('ICONIQ')).toBe('ICONIQ');
    expect(normalizeSearchQuery('iconiq')).toBe('iconiq');
  });

  it('returns empty string for nullish input', () => {
    expect(normalizeSearchQuery(undefined)).toBe('');
    expect(normalizeSearchQuery(null)).toBe('');
  });
});
