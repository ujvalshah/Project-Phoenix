import mongoose, { Schema, Document } from 'mongoose';

export interface IBookmarkFolderLink extends Document {
  userId: string;
  bookmarkId: string; // Reference to Bookmark._id
  folderId: string; // Reference to BookmarkFolder._id
  createdAt: string;
}

const BookmarkFolderLinkSchema = new Schema<IBookmarkFolderLink>({
  userId: { type: String, required: true, index: true },
  bookmarkId: { type: String, required: true, index: true },
  folderId: { type: String, required: true, index: true },
  createdAt: { type: String, required: true }
}, {
  timestamps: false
});

// Compound unique index: (bookmarkId, folderId) unique
BookmarkFolderLinkSchema.index({ bookmarkId: 1, folderId: 1 }, { unique: true });

// Index for efficient querying by bookmark
BookmarkFolderLinkSchema.index({ bookmarkId: 1 });

// Index for efficient querying by folder
BookmarkFolderLinkSchema.index({ folderId: 1 });

export const BookmarkFolderLink = mongoose.model<IBookmarkFolderLink>('BookmarkFolderLink', BookmarkFolderLinkSchema);

