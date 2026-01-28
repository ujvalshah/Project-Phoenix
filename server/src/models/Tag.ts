import mongoose, { Schema, Document } from 'mongoose';

export interface ITag extends Document {
  rawName: string; // Exact user-entered text, preserved for display
  canonicalName: string; // Normalized lowercase version for uniqueness and lookup
  aliases: string[]; // Alternative names/variations for this tag
  usageCount: number;
  type: 'category' | 'tag'; // TODO: legacy-name-only-if-used-by-frontend - 'category' type kept for compatibility
  status: 'active' | 'pending' | 'deprecated';
  isOfficial: boolean;
  // Legacy field - kept for backward compatibility, maps to rawName
  name?: string;
}

/**
 * Canonicalize tag name: trim whitespace, lowercase, normalize spacing
 * Used for consistent duplicate detection
 */
export function canonicalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const TagSchema = new Schema<ITag>({
  rawName: { type: String, required: true, trim: true },
  canonicalName: { type: String, required: true, unique: true, trim: true, lowercase: true },
  aliases: { type: [String], default: [] }, // Alternative names/variations
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
    default: 'active'
    // Note: index removed - using compound index below instead
  },
  isOfficial: { type: Boolean, default: false, index: true }
}, {
  timestamps: true // Enable createdAt and updatedAt
});

// Compound indexes for efficient queries (more efficient than single-field indexes)
TagSchema.index({ status: 1, type: 1 }); // Covers both status and type queries
TagSchema.index({ status: 1, canonicalName: 1 }); // Compound index for active tag lookups
// Note: unique index on canonicalName is already defined in schema field definition (line 25)

/**
 * Static method: Find or create tag by name
 * Handles canonicalization and duplicate detection automatically
 */
TagSchema.statics.fromName = async function(name: string) {
  const canonical = canonicalize(name);
  let tag = await this.findOne({ canonicalName: canonical });
  if (!tag) {
    tag = await this.create({ 
      rawName: name.trim(), 
      canonicalName: canonical,
      status: 'active',
      type: 'tag'
    });
  }
  return tag;
};

// Virtual for backward compatibility - maps name to rawName
TagSchema.virtual('name').get(function() {
  return this.rawName;
});

// Ensure virtuals are included in JSON output
TagSchema.set('toJSON', { virtuals: true });
TagSchema.set('toObject', { virtuals: true });

// Add static method type definition
interface ITagModel extends mongoose.Model<ITag> {
  fromName(name: string): Promise<ITag>;
}

export const Tag = mongoose.model<ITag, ITagModel>('Tag', TagSchema);











