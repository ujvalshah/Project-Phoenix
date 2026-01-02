import mongoose, { Schema, Document } from 'mongoose';

export interface IBookmarkFolder extends Document {
  userId: string;
  name: string;
  order: number;
  isDefault: boolean;
  createdAt: string;
}

const BookmarkFolderSchema = new Schema<IBookmarkFolder>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  order: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: String, required: true }
}, {
  timestamps: false
});

// Compound unique index: folder names unique per user
BookmarkFolderSchema.index({ userId: 1, name: 1 }, { unique: true });

// Index for efficient querying by user and order
BookmarkFolderSchema.index({ userId: 1, order: 1 });

export const BookmarkFolder = mongoose.model<IBookmarkFolder>('BookmarkFolder', BookmarkFolderSchema);

