import mongoose, { Schema, Document } from 'mongoose';

export interface IBookmark extends Document {
  userId: string;
  nuggetId: string; // articleId/nuggetId
  createdAt: string;
}

const BookmarkSchema = new Schema<IBookmark>({
  userId: { type: String, required: true, index: true },
  nuggetId: { type: String, required: true, index: true },
  createdAt: { type: String, required: true }
}, {
  timestamps: false
});

// Compound unique index: (userId, nuggetId) uniquely defines a bookmark
BookmarkSchema.index({ userId: 1, nuggetId: 1 }, { unique: true });

export const Bookmark = mongoose.model<IBookmark>('Bookmark', BookmarkSchema);

