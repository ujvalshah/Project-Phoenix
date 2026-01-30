import mongoose, { Schema, Document } from 'mongoose';

/**
 * BookmarkCollectionLink Model
 *
 * Many-to-many join table linking Bookmarks to BookmarkCollections.
 * Enables one bookmark to exist in multiple collections (Instagram/Pinterest style).
 *
 * Design decisions:
 * - Separate model for clean queries and scalability
 * - userId denormalized for efficient user-scoped queries
 * - createdAt tracks when bookmark was added to collection
 */

export interface IBookmarkCollectionLink extends Document {
  userId: string;                    // Denormalized for efficient user queries
  bookmarkId: string;                // Reference to Bookmark._id
  collectionId: string;              // Reference to BookmarkCollection._id
  createdAt: string;                 // When added to this collection (ISO string)
}

const BookmarkCollectionLinkSchema = new Schema<IBookmarkCollectionLink>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  bookmarkId: {
    type: String,
    required: true
  },
  collectionId: {
    type: String,
    required: true
  },
  createdAt: {
    type: String,
    required: true
  }
}, {
  timestamps: false  // Manual date management (ISO strings)
});

// Compound indexes for performance

// Primary: Unique constraint (bookmark can only be in a collection once)
BookmarkCollectionLinkSchema.index(
  { bookmarkId: 1, collectionId: 1 },
  { unique: true, name: 'bookmarkId_collectionId_unique' }
);

// Common query: Get all bookmarks in a collection, sorted by when added
BookmarkCollectionLinkSchema.index(
  { collectionId: 1, createdAt: -1 },
  { name: 'collectionId_createdAt_desc' }
);

// Common query: Get all collections a bookmark is in
BookmarkCollectionLinkSchema.index(
  { bookmarkId: 1 },
  { name: 'bookmarkId' }
);

// Common query: User's links for cleanup/migration
BookmarkCollectionLinkSchema.index(
  { userId: 1, createdAt: -1 },
  { name: 'userId_createdAt_desc' }
);

// Efficient deletion when collection is deleted
BookmarkCollectionLinkSchema.index(
  { collectionId: 1 },
  { name: 'collectionId' }
);

export const BookmarkCollectionLink = mongoose.model<IBookmarkCollectionLink>('BookmarkCollectionLink', BookmarkCollectionLinkSchema);
