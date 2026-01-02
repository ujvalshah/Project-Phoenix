/**
 * Sanitize Bookmarks: Remove orphaned bookmarks
 */

import { Bookmark } from '../../models/Bookmark.js';
import { BookmarkFolderLink } from '../../models/BookmarkFolderLink.js';
import { Article } from '../../models/Article.js';
import { User } from '../../models/User.js';
import { CleanupResult } from './types.js';

export async function sanitizeBookmarks(dryRun: boolean = true): Promise<CleanupResult> {
  const result: CleanupResult = {
    collection: 'Bookmark',
    operation: 'Remove orphaned bookmarks',
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
    const validArticleIds = new Set(
      (await Article.find({}, '_id').lean()).map(a => a._id.toString())
    );

    const bookmarks = await Bookmark.find({}).lean();
    result.recordsScanned = bookmarks.length;

    const orphanedBookmarkIds: string[] = [];

    for (const bookmark of bookmarks) {
      const bookmarkId = bookmark._id.toString();
      const isOrphaned = 
        !validUserIds.has(bookmark.userId) || 
        !validArticleIds.has(bookmark.nuggetId);

      if (isOrphaned) {
        orphanedBookmarkIds.push(bookmarkId);
      }
    }

    if (orphanedBookmarkIds.length > 0) {
      if (dryRun) {
        console.log(`[DRY RUN] Would delete ${orphanedBookmarkIds.length} orphaned bookmarks`);
        result.recordsSkipped = orphanedBookmarkIds.length;
      } else {
        // Also delete associated folder links
        await BookmarkFolderLink.deleteMany({ bookmarkId: { $in: orphanedBookmarkIds } });
        
        const deleteResult = await Bookmark.deleteMany({ _id: { $in: orphanedBookmarkIds } });
        result.recordsCleaned = deleteResult.deletedCount || 0;
        console.log(`[CLEANUP] Deleted ${result.recordsCleaned} orphaned bookmarks and their folder links`);
      }
    }

  } catch (error: any) {
    result.errors.push(`Error sanitizing bookmarks: ${error.message}`);
  }

  return result;
}











