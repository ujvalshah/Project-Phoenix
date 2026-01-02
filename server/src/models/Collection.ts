import mongoose, { Schema, Document } from 'mongoose';

export interface ICollectionEntry {
  articleId: string;
  addedByUserId: string;
  addedAt: string;
  flaggedBy: string[];
}

export interface ICollection extends Document {
  rawName: string; // Exact user-entered text, preserved for display
  canonicalName: string; // Normalized lowercase version for uniqueness and lookup
  description: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  followersCount: number;
  followers: string[]; // Array of userIds who follow this collection
  entries: ICollectionEntry[];
  validEntriesCount?: number; // Validated count of entries (computed, may be undefined for legacy data)
  type: 'private' | 'public';
  // Legacy field - kept for backward compatibility, maps to rawName
  name?: string;
}

const CollectionEntrySchema = new Schema<ICollectionEntry>({
  articleId: { type: String, required: true },
  addedByUserId: { type: String, required: true },
  addedAt: { type: String, required: true },
  flaggedBy: { type: [String], default: [] }
}, { _id: false });

const CollectionSchema = new Schema<ICollection>({
  rawName: { type: String, required: true, trim: true },
  canonicalName: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, default: '' },
  creatorId: { type: String, required: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
  followersCount: { type: Number, default: 0 },
  followers: { type: [String], default: [] }, // Array of userIds
  entries: { type: [CollectionEntrySchema], default: [] },
  validEntriesCount: { type: Number }, // Optional validated count (computed field)
  type: { type: String, enum: ['private', 'public'], default: 'public' }
}, {
  timestamps: false
});

// Explicit indexes for performance
CollectionSchema.index({ creatorId: 1 }); // Ownership queries
CollectionSchema.index({ creatorId: 1, type: 1 }); // Compound: filtering by creator and type
CollectionSchema.index({ createdAt: -1 }); // List sorting
CollectionSchema.index({ type: 1, createdAt: -1 }); // Visibility filters with sorting
// Unique index on canonicalName per creator (collections can have same canonicalName if different creators)
// Note: For private collections, we want uniqueness per creator. For public, we want global uniqueness.
// We'll handle this in the controller logic, but add a compound index for efficient lookups
CollectionSchema.index({ canonicalName: 1, creatorId: 1 });

// Virtual for backward compatibility - maps name to rawName
CollectionSchema.virtual('name').get(function() {
  return this.rawName;
});

// Ensure virtuals are included in JSON output
CollectionSchema.set('toJSON', { virtuals: true });
CollectionSchema.set('toObject', { virtuals: true });

export const Collection = mongoose.model<ICollection>('Collection', CollectionSchema);


