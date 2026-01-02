/**
 * Sanitize BookmarkFolderLinks: Remove orphaned links
 */

import { BookmarkFolderLink } from '../../models/BookmarkFolderLink.js';
import { Bookmark } from '../../models/Bookmark.js';
import { BookmarkFolder } from '../../models/BookmarkFolder.js';
import { User } from '../../models/User.js';
import { CleanupResult } from './types.js';

export async function sanitizeBookmarkFolderLinks(dryRun: boolean = true): Promise<CleanupResult> {
  const result: CleanupResult = {
    collection: 'BookmarkFolderLink',
    operation: 'Remove orphaned bookmark folder links',
    recordsScanned: 0,
    recordsCleaned: 0,
    recordsSkipped: 0,
    errors: []
  };

  try {
    // Get valid IDs
    const validUserIds = new Set(
      (await User.find({}, '_id').lean()).map(u => u._id.toString())
    );
    const validBookmarkIds = new Set(
      (await Bookmark.find({}, '_id').lean()).map(b => b._id.toString())
    );
    const validFolderIds = new Set(
      (await BookmarkFolder.find({}, '_id').lean()).map(f => f._id.toString())
    );

    const links = await BookmarkFolderLink.find({}).lean();
    result.recordsScanned = links.length;

    const orphanedLinkIds: string[] = [];

    for (const link of links) {
      const isOrphaned = 
        !validUserIds.has(link.userId) ||
        !validBookmarkIds.has(link.bookmarkId) ||
        !validFolderIds.has(link.folderId);

      if (isOrphaned) {
        orphanedLinkIds.push(link._id.toString());
      }
    }

    if (orphanedLinkIds.length > 0) {
      if (dryRun) {
        console.log(`[DRY RUN] Would delete ${orphanedLinkIds.length} orphaned bookmark folder links`);
        result.recordsSkipped = orphanedLinkIds.length;
      } else {
        const deleteResult = await BookmarkFolderLink.deleteMany({ _id: { $in: orphanedLinkIds } });
        result.recordsCleaned = deleteResult.deletedCount || 0;
        console.log(`[CLEANUP] Deleted ${result.recordsCleaned} orphaned bookmark folder links`);
      }
    }

  } catch (error: any) {
    result.errors.push(`Error sanitizing bookmark folder links: ${error.message}`);
  }

  return result;
}











