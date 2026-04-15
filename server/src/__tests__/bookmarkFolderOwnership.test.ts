import { describe, it, expect } from 'vitest';
import { assertAllBookmarkFoldersOwned } from '../utils/bookmarkHelpers.js';

describe('assertAllBookmarkFoldersOwned', () => {
  it('accepts when every id is owned (dedupes duplicates)', () => {
    const result = assertAllBookmarkFoldersOwned(['a', 'a', 'b'], [
      { _id: 'a' },
      { _id: 'b' }
    ]);
    expect(result).toEqual({ ok: true, uniqueIds: ['a', 'b'] });
  });

  it('rejects when a foreign id is requested', () => {
    const result = assertAllBookmarkFoldersOwned(['a', 'evil'], [{ _id: 'a' }]);
    expect(result).toEqual({ ok: false });
  });

  it('rejects empty request', () => {
    expect(assertAllBookmarkFoldersOwned([], [])).toEqual({ ok: false });
  });

  it('rejects count mismatch (extra owned docs)', () => {
    const result = assertAllBookmarkFoldersOwned(['a'], [{ _id: 'a' }, { _id: 'b' }]);
    expect(result).toEqual({ ok: false });
  });
});
