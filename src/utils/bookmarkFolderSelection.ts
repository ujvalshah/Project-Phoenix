/**
 * Private bookmark folder picker behavior (not editorial collections).
 */

export function normalizeFolderIdsForAssign(
  selectedFolderIds: string[],
  defaultSavedFolderId: string | undefined
): { folderIds: string[]; normalizedFromEmpty: boolean; error: 'missing_default' | null } {
  if (selectedFolderIds.length > 0) {
    return { folderIds: selectedFolderIds, normalizedFromEmpty: false, error: null };
  }
  if (!defaultSavedFolderId) {
    return { folderIds: [], normalizedFromEmpty: false, error: 'missing_default' };
  }
  return {
    folderIds: [defaultSavedFolderId],
    normalizedFromEmpty: true,
    error: null
  };
}
