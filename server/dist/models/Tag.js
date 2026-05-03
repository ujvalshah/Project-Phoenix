import mongoose, { Schema } from 'mongoose';
/**
 * Canonicalize tag name: trim whitespace, lowercase, normalize spacing
 * Used for consistent duplicate detection
 */
export function canonicalize(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
const TagSchema = new Schema({
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
    isOfficial: { type: Boolean, default: false, index: true },
    // ── Two-axis taxonomy fields ──────────────────────────────────────────────
    dimension: { type: String, enum: ['format', 'domain', 'subtopic'], required: false, index: true },
    parentTagId: { type: Schema.Types.ObjectId, ref: 'Tag', default: null, index: true },
    sortOrder: { type: Number, default: 0 }
}, {
    timestamps: true // Enable createdAt and updatedAt
});
// Compound indexes for efficient queries (more efficient than single-field indexes)
TagSchema.index({ status: 1, type: 1 }); // Covers both status and type queries
TagSchema.index({ status: 1, canonicalName: 1 }); // Compound index for active tag lookups
// Note: unique index on canonicalName is already defined in schema field definition
TagSchema.index({ dimension: 1, parentTagId: 1, sortOrder: 1 }); // Dimension taxonomy queries
TagSchema.index({ dimension: 1, status: 1, sortOrder: 1 }); // Active tags by dimension
/**
 * Static method: Find or create tag by name
 * Handles canonicalization and duplicate detection automatically
 */
TagSchema.statics.fromName = async function (name) {
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
TagSchema.virtual('name').get(function () {
    return this.rawName;
});
// Ensure virtuals are included in JSON output
TagSchema.set('toJSON', { virtuals: true });
TagSchema.set('toObject', { virtuals: true });
export const Tag = mongoose.model('Tag', TagSchema);
//# sourceMappingURL=Tag.js.map