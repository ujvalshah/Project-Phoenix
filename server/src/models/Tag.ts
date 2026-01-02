import mongoose, { Schema, Document } from 'mongoose';

export interface ITag extends Document {
  rawName: string; // Exact user-entered text, preserved for display
  canonicalName: string; // Normalized lowercase version for uniqueness and lookup
  usageCount: number;
  type: 'category' | 'tag';
  status: 'active' | 'pending' | 'deprecated';
  isOfficial: boolean;
  // Legacy field - kept for backward compatibility, maps to rawName
  name?: string;
}

const TagSchema = new Schema<ITag>({
  rawName: { type: String, required: true, trim: true },
  canonicalName: { type: String, required: true, unique: true, trim: true, lowercase: true },
  usageCount: { type: Number, default: 0 },
  type: { 
    type: String, 
    enum: ['category', 'tag'], 
    default: 'tag',
    index: true
  },
  status: { 
    type: String, 
    enum: ['active', 'pending', 'deprecated'], 
    default: 'active',
    index: true
  },
  isOfficial: { type: Boolean, default: false, index: true }
}, {
  timestamps: false
});

// Index for efficient queries
TagSchema.index({ status: 1, type: 1 });
// Note: unique index on canonicalName is already defined in schema field definition

// Virtual for backward compatibility - maps name to rawName
TagSchema.virtual('name').get(function() {
  return this.rawName;
});

// Ensure virtuals are included in JSON output
TagSchema.set('toJSON', { virtuals: true });
TagSchema.set('toObject', { virtuals: true });

export const Tag = mongoose.model<ITag>('Tag', TagSchema);











