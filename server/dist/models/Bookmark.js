import mongoose, { Schema } from 'mongoose';
const BookmarkSchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true // Frequent queries by user
    },
    itemId: {
        type: String,
        required: true
    },
    itemType: {
        type: String,
        enum: ['nugget', 'article', 'video', 'course'],
        default: 'nugget',
        required: true
    },
    createdAt: {
        type: String,
        required: true
    },
    lastAccessedAt: {
        type: String,
        required: true
    },
    notes: {
        type: String,
        maxlength: 1000 // Reasonable limit for notes
    }
}, {
    timestamps: false // Manual date management (ISO strings)
});
// Compound indexes for performance
// Primary lookup: user's bookmark on a specific item
BookmarkSchema.index({ userId: 1, itemId: 1, itemType: 1 }, { unique: true, name: 'userId_itemId_itemType_unique' });
// Common queries: user's bookmarks sorted by date
BookmarkSchema.index({ userId: 1, createdAt: -1 }, { name: 'userId_createdAt_desc' });
// Common queries: user's bookmarks by type, sorted by date
BookmarkSchema.index({ userId: 1, itemType: 1, createdAt: -1 }, { name: 'userId_itemType_createdAt_desc' });
// Recently accessed sorting
BookmarkSchema.index({ userId: 1, lastAccessedAt: -1 }, { name: 'userId_lastAccessedAt_desc' });
export const Bookmark = mongoose.model('Bookmark', BookmarkSchema);
//# sourceMappingURL=Bookmark.js.map