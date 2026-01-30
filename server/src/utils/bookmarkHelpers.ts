import { Bookmark, BookmarkItemType } from '../models/Bookmark.js';
import { BookmarkCollection } from '../models/BookmarkCollection.js';
import { BookmarkCollectionLink } from '../models/BookmarkCollectionLink.js';

/**
 * Bookmark Helper Utilities
 *
 * Core helper functions for bookmark operations.
 * These are used by controllers to ensure consistent behavior.
 */

const DEFAULT_COLLECTION_NAME = 'Saved';
const DEFAULT_COLLECTION_CANONICAL = 'saved';

/**
 * Ensure the user's default "Saved" collection exists.
 * Creates it lazily if it doesn't exist.
 * Handles race conditions gracefully (duplicate key errors).
 *
 * @param userId - The user's ID
 * @returns The default collection's ID
 */
export async function ensureDefaultCollection(userId: string): Promise<string> {
  // Try to find existing default collection
  const existing = await BookmarkCollection.findOne({
    userId,
    isDefault: true
  }).lean();

  if (existing) {
    return existing._id.toString();
  }

  // Create default collection
  const now = new Date().toISOString();
  try {
    const defaultCollection = await BookmarkCollection.create({
      userId,
      name: DEFAULT_COLLECTION_NAME,
      canonicalName: DEFAULT_COLLECTION_CANONICAL,
      description: 'Your saved items',
      order: 0,  // Default collection always first
      isDefault: true,
      bookmarkCount: 0,
      createdAt: now,
      updatedAt: now
    });

    return defaultCollection._id.toString();
  } catch (error: any) {
    // Handle race condition: another request created the collection first
    if (error.code === 11000) {
      // Duplicate key error - collection was created by concurrent request
      const created = await BookmarkCollection.findOne({
        userId,
        isDefault: true
      }).lean();

      if (created) {
        return created._id.toString();
      }
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get or create a bookmark for a specific item.
 * If bookmark exists, returns existing. Otherwise creates new.
 * Handles race conditions gracefully (duplicate key errors).
 *
 * @param userId - The user's ID
 * @param itemId - The item to bookmark
 * @param itemType - Type of item (default: 'nugget')
 * @returns Object with bookmarkId and whether it was newly created
 */
export async function getOrCreateBookmark(
  userId: string,
  itemId: string,
  itemType: BookmarkItemType = 'nugget'
): Promise<{ bookmarkId: string; created: boolean }> {
  // Check for existing bookmark
  const existing = await Bookmark.findOne({
    userId,
    itemId,
    itemType
  }).lean();

  if (existing) {
    // Update lastAccessedAt
    await Bookmark.updateOne(
      { _id: existing._id },
      { $set: { lastAccessedAt: new Date().toISOString() } }
    );
    return { bookmarkId: existing._id.toString(), created: false };
  }

  // Create new bookmark
  const now = new Date().toISOString();
  try {
    const bookmark = await Bookmark.create({
      userId,
      itemId,
      itemType,
      createdAt: now,
      lastAccessedAt: now
    });

    return { bookmarkId: bookmark._id.toString(), created: true };
  } catch (error: any) {
    // Handle race condition: another request created the bookmark first
    if (error.code === 11000) {
      // Duplicate key error - bookmark was created by concurrent request
      const created = await Bookmark.findOne({
        userId,
        itemId,
        itemType
      }).lean();

      if (created) {
        return { bookmarkId: created._id.toString(), created: false };
      }
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Ensure a bookmark is linked to the default collection.
 * Idempotent - safe to call multiple times.
 * Handles race conditions gracefully (duplicate key errors).
 *
 * @param bookmarkId - The bookmark's ID
 * @param userId - The user's ID
 * @returns The default collection's ID
 */
export async function ensureBookmarkInDefaultCollection(
  bookmarkId: string,
  userId: string
): Promise<string> {
  const defaultCollectionId = await ensureDefaultCollection(userId);

  // Check if link already exists
  const existingLink = await BookmarkCollectionLink.findOne({
    bookmarkId,
    collectionId: defaultCollectionId
  }).lean();

  if (!existingLink) {
    try {
      // Create the link
      await BookmarkCollectionLink.create({
        userId,
        bookmarkId,
        collectionId: defaultCollectionId,
        createdAt: new Date().toISOString()
      });

      // Increment bookmark count
      await BookmarkCollection.updateOne(
        { _id: defaultCollectionId },
        { $inc: { bookmarkCount: 1 }, $set: { updatedAt: new Date().toISOString() } }
      );
    } catch (error: any) {
      // Handle race condition: another request created the link first
      if (error.code === 11000) {
        // Duplicate key error - link already exists, safe to ignore
        // Don't increment count since the link already existed
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  }

  return defaultCollectionId;
}

/**
 * Add a bookmark to specific collections.
 * Removes from all other collections first, then adds to specified ones.
 *
 * @param bookmarkId - The bookmark's ID
 * @param userId - The user's ID
 * @param collectionIds - Array of collection IDs to add to
 */
export async function assignBookmarkToCollections(
  bookmarkId: string,
  userId: string,
  collectionIds: string[]
): Promise<void> {
  // Get current collection links for this bookmark
  const currentLinks = await BookmarkCollectionLink.find({
    bookmarkId
  }).lean();

  const currentCollectionIds = new Set(currentLinks.map(l => l.collectionId));
  const targetCollectionIds = new Set(collectionIds);

  const now = new Date().toISOString();

  // Collections to remove from
  const toRemove = [...currentCollectionIds].filter(id => !targetCollectionIds.has(id));

  // Collections to add to
  const toAdd = [...targetCollectionIds].filter(id => !currentCollectionIds.has(id));

  // Remove links
  if (toRemove.length > 0) {
    await BookmarkCollectionLink.deleteMany({
      bookmarkId,
      collectionId: { $in: toRemove }
    });

    // Decrement bookmark counts
    await BookmarkCollection.updateMany(
      { _id: { $in: toRemove } },
      { $inc: { bookmarkCount: -1 }, $set: { updatedAt: now } }
    );
  }

  // Add new links
  if (toAdd.length > 0) {
    const newLinks = toAdd.map(collectionId => ({
      userId,
      bookmarkId,
      collectionId,
      createdAt: now
    }));

    await BookmarkCollectionLink.insertMany(newLinks, { ordered: false });

    // Increment bookmark counts
    await BookmarkCollection.updateMany(
      { _id: { $in: toAdd } },
      { $inc: { bookmarkCount: 1 }, $set: { updatedAt: now } }
    );
  }
}

/**
 * Remove a bookmark from a specific collection.
 *
 * @param bookmarkId - The bookmark's ID
 * @param collectionId - The collection's ID
 */
export async function removeBookmarkFromCollection(
  bookmarkId: string,
  collectionId: string
): Promise<boolean> {
  const result = await BookmarkCollectionLink.deleteOne({
    bookmarkId,
    collectionId
  });

  if (result.deletedCount > 0) {
    // Decrement bookmark count
    await BookmarkCollection.updateOne(
      { _id: collectionId },
      {
        $inc: { bookmarkCount: -1 },
        $set: { updatedAt: new Date().toISOString() }
      }
    );
    return true;
  }

  return false;
}

/**
 * Delete a bookmark and all its collection links.
 *
 * @param bookmarkId - The bookmark's ID
 * @param userId - The user's ID (for verification)
 */
export async function deleteBookmarkCompletely(
  bookmarkId: string,
  userId: string
): Promise<boolean> {
  // Verify ownership
  const bookmark = await Bookmark.findOne({
    _id: bookmarkId,
    userId
  }).lean();

  if (!bookmark) {
    return false;
  }

  // Get all collection links
  const links = await BookmarkCollectionLink.find({
    bookmarkId
  }).lean();

  const collectionIds = links.map(l => l.collectionId);

  // Delete all links
  await BookmarkCollectionLink.deleteMany({ bookmarkId });

  // Decrement bookmark counts for all affected collections
  if (collectionIds.length > 0) {
    await BookmarkCollection.updateMany(
      { _id: { $in: collectionIds } },
      {
        $inc: { bookmarkCount: -1 },
        $set: { updatedAt: new Date().toISOString() }
      }
    );
  }

  // Delete the bookmark itself
  await Bookmark.deleteOne({ _id: bookmarkId });

  return true;
}

/**
 * Get all collection IDs that a bookmark belongs to.
 *
 * @param bookmarkId - The bookmark's ID
 * @returns Array of collection IDs
 */
export async function getBookmarkCollectionIds(bookmarkId: string): Promise<string[]> {
  const links = await BookmarkCollectionLink.find({
    bookmarkId
  }).select('collectionId').lean();

  return links.map(l => l.collectionId);
}

/**
 * Check if an item is bookmarked by a user.
 *
 * @param userId - The user's ID
 * @param itemId - The item's ID
 * @param itemType - Type of item (default: 'nugget')
 * @returns Bookmark status and details
 */
export async function getBookmarkStatus(
  userId: string,
  itemId: string,
  itemType: BookmarkItemType = 'nugget'
): Promise<{
  isBookmarked: boolean;
  bookmarkId?: string;
  collectionIds: string[];
}> {
  const bookmark = await Bookmark.findOne({
    userId,
    itemId,
    itemType
  }).lean();

  if (!bookmark) {
    return { isBookmarked: false, collectionIds: [] };
  }

  const collectionIds = await getBookmarkCollectionIds(bookmark._id.toString());

  return {
    isBookmarked: true,
    bookmarkId: bookmark._id.toString(),
    collectionIds
  };
}

/**
 * Recalculate and fix bookmark count for a collection.
 * Useful for maintenance/migration.
 *
 * @param collectionId - The collection's ID
 */
export async function recalculateCollectionCount(collectionId: string): Promise<number> {
  const count = await BookmarkCollectionLink.countDocuments({ collectionId });

  await BookmarkCollection.updateOne(
    { _id: collectionId },
    {
      $set: {
        bookmarkCount: count,
        updatedAt: new Date().toISOString()
      }
    }
  );

  return count;
}
