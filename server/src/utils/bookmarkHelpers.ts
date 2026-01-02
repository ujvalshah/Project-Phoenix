import { BookmarkFolder } from '../models/BookmarkFolder.js';
import { Bookmark } from '../models/Bookmark.js';
import { BookmarkFolderLink } from '../models/BookmarkFolderLink.js';

/**
 * Ensure default "General" folder exists for a user
 * Called lazily when needed (bookmarking, opening bookmarks page, etc.)
 * Idempotent - safe to call multiple times
 */
export async function ensureDefaultFolder(userId: string): Promise<string> {
  // Check if default folder already exists
  const existing = await BookmarkFolder.findOne({
    userId,
    isDefault: true
  });

  if (existing) {
    return existing._id.toString();
  }

  // Create default folder
  const defaultFolder = await BookmarkFolder.create({
    userId,
    name: 'General',
    order: 0,
    isDefault: true,
    createdAt: new Date().toISOString()
  });

  return defaultFolder._id.toString();
}

/**
 * Get or create a bookmark for a user and nugget
 * Returns bookmark ID
 */
export async function getOrCreateBookmark(userId: string, nuggetId: string): Promise<string> {
  const existing = await Bookmark.findOne({ userId, nuggetId });
  
  if (existing) {
    return existing._id.toString();
  }

  const bookmark = await Bookmark.create({
    userId,
    nuggetId,
    createdAt: new Date().toISOString()
  });

  return bookmark._id.toString();
}

/**
 * Get folder ID for "General" folder (must exist)
 */
export async function getGeneralFolderId(userId: string): Promise<string> {
  const folder = await BookmarkFolder.findOne({
    userId,
    isDefault: true
  });

  if (!folder) {
    // Should not happen if ensureDefaultFolder was called, but handle gracefully
    return await ensureDefaultFolder(userId);
  }

  return folder._id.toString();
}

/**
 * Ensure bookmark belongs to at least one folder (General fallback)
 * Called when removing last folder link
 */
export async function ensureBookmarkInGeneralFolder(bookmarkId: string, userId: string): Promise<void> {
  // Check if bookmark has any folder links
  const existingLinks = await BookmarkFolderLink.find({ bookmarkId });
  
  if (existingLinks.length === 0) {
    // No links exist - add to General
    const generalFolderId = await getGeneralFolderId(userId);
    
    // Check if link already exists (idempotent)
    const existingLink = await BookmarkFolderLink.findOne({ bookmarkId, folderId: generalFolderId });
    if (existingLink) {
      return; // Already linked to General
    }
    
    try {
      await BookmarkFolderLink.create({
        userId,
        bookmarkId,
        folderId: generalFolderId,
        createdAt: new Date().toISOString()
      });
    } catch (error: any) {
      // Ignore duplicate key errors (race condition - link created by another request)
      if (error.code === 11000) {
        return;
      }
      // Re-throw other errors
      throw error;
    }
  }
}

