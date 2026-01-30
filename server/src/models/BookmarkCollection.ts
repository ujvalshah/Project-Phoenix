import mongoose, { Schema, Document } from 'mongoose';

/**
 * BookmarkCollection Model
 *
 * User's bookmark collections/folders for organizing saved items.
 * Follows Instagram/Pinterest collection pattern.
 *
 * Features:
 * - Default "Saved" collection auto-created lazily
 * - Multi-collection support (one bookmark can be in multiple collections)
 * - Custom ordering via `order` field
 * - Optional description for user notes
 */

export interface IBookmarkCollection extends Document {
  userId: string;                    // Owner of the collection
  name: string;                      // Display name (user-entered)
  canonicalName: string;             // Lowercase for uniqueness check
  description?: string;              // Optional user description
  order: number;                     // Sort order (lower = first)
  isDefault: boolean;                // Default "Saved" collection flag
  bookmarkCount: number;             // Cached count for UI display
  createdAt: string;                 // ISO date string
  updatedAt: string;                 // ISO date string
}

const BookmarkCollectionSchema = new Schema<IBookmarkCollection>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  canonicalName: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  order: {
    type: Number,
    default: 0
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  bookmarkCount: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: String,
    required: true
  },
  updatedAt: {
    type: String,
    required: true
  }
}, {
  timestamps: false  // Manual date management (ISO strings)
});

// Compound indexes for performance

// Unique constraint: user can't have duplicate collection names
BookmarkCollectionSchema.index(
  { userId: 1, canonicalName: 1 },
  { unique: true, name: 'userId_canonicalName_unique' }
);

// Common queries: user's collections sorted by order
BookmarkCollectionSchema.index({ userId: 1, order: 1 }, { name: 'userId_order_asc' });

// Find default collection quickly
BookmarkCollectionSchema.index(
  { userId: 1, isDefault: 1 },
  { name: 'userId_isDefault' }
);

// Listing collections with counts
BookmarkCollectionSchema.index({ userId: 1, createdAt: -1 }, { name: 'userId_createdAt_desc' });

export const BookmarkCollection = mongoose.model<IBookmarkCollection>('BookmarkCollection', BookmarkCollectionSchema);
