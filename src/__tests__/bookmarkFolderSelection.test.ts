import { describe, it, expect } from 'vitest';
import { normalizeFolderIdsForAssign } from '@/utils/bookmarkFolderSelection';

describe('normalizeFolderIdsForAssign', () => {
  it('passes through non-empty selection', () => {
    expect(normalizeFolderIdsForAssign(['f1', 'f2'], 'def')).toEqual({
      folderIds: ['f1', 'f2'],
      normalizedFromEmpty: false,
      error: null
    });
  });

  it('normalizes empty to default Saved folder', () => {
    expect(normalizeFolderIdsForAssign([], 'saved-id')).toEqual({
      folderIds: ['saved-id'],
      normalizedFromEmpty: true,
      error: null
    });
  });

  it('reports missing default when empty and no default id', () => {
    expect(normalizeFolderIdsForAssign([], undefined)).toEqual({
      folderIds: [],
      normalizedFromEmpty: false,
      error: 'missing_default'
    });
  });
});
