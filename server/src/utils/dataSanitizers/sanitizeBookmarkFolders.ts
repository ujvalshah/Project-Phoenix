/**
 * Sanitize BookmarkFolders: Remove orphaned folders and links
 */

import { BookmarkFolder } from '../../models/BookmarkFolder.js';
import { BookmarkFolderLink } from '../../models/BookmarkFolderLink.js';
import { User } from '../../models/User.js';
import { CleanupResult } from './types.js';

export async function sanitizeBookmarkFolders(dryRun: boolean = true): Promise<CleanupResult> {
  const result: CleanupResult = {
    collection: 'BookmarkFolder',
    operation: 'Remove orphaned bookmark folders',
    recordsScanned: 0,
    recordsCleaned: 0,
    recordsSkipped: 0,
    errors: []
  };

  try {
    // Get valid user IDs
    const validUserIds = new Set(
      (await User.find({}, '_id').lean()).map(u => u._id.toString())
    );

    const folders = await BookmarkFolder.find({}).lean();
    result.recordsScanned = folders.length;

    const orphanedFolderIds: string[] = [];

    for (const folder of folders) {
      if (!validUserIds.has(folder.userId)) {
        orphanedFolderIds.push(folder._id.toString());
      }
    }

    if (orphanedFolderIds.length > 0) {
      if (dryRun) {
        console.log(`[DRY RUN] Would delete ${orphanedFolderIds.length} orphaned bookmark folders`);
        result.recordsSkipped = orphanedFolderIds.length;
      } else {
        // Also delete associated links
        await BookmarkFolderLink.deleteMany({ folderId: { $in: orphanedFolderIds } });
        
        const deleteResult = await BookmarkFolder.deleteMany({ _id: { $in: orphanedFolderIds } });
        result.recordsCleaned = deleteResult.deletedCount || 0;
        console.log(`[CLEANUP] Deleted ${result.recordsCleaned} orphaned bookmark folders and their links`);
      }
    }

  } catch (error: any) {
    result.errors.push(`Error sanitizing bookmark folders: ${error.message}`);
  }

  return result;
}











