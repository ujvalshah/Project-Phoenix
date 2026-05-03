import mongoose, { Schema } from 'mongoose';
const BookmarkCollectionSchema = new Schema({
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
    timestamps: false // Manual date management (ISO strings)
});
// Compound indexes for performance
// Unique constraint: user can't have duplicate collection names
BookmarkCollectionSchema.index({ userId: 1, canonicalName: 1 }, { unique: true, name: 'userId_canonicalName_unique' });
// Common queries: user's collections sorted by order
BookmarkCollectionSchema.index({ userId: 1, order: 1 }, { name: 'userId_order_asc' });
// Find default collection quickly
BookmarkCollectionSchema.index({ userId: 1, isDefault: 1 }, { name: 'userId_isDefault' });
// Listing collections with counts
BookmarkCollectionSchema.index({ userId: 1, createdAt: -1 }, { name: 'userId_createdAt_desc' });
export const BookmarkCollection = mongoose.model('BookmarkCollection', BookmarkCollectionSchema);
//# sourceMappingURL=BookmarkCollection.js.map