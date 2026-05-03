import mongoose, { Schema } from 'mongoose';
/**
 * Cloudinary subdocument schema
 */
const CloudinarySchema = new Schema({
    publicId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    secureUrl: {
        type: String,
        required: true
    },
    resourceType: {
        type: String,
        enum: ['image', 'video', 'raw'],
        required: true
    },
    format: {
        type: String
    },
    width: {
        type: Number
    },
    height: {
        type: Number
    },
    duration: {
        type: Number
    },
    bytes: {
        type: Number
    }
}, { _id: false });
/**
 * File metadata subdocument schema
 */
const FileSchema = new Schema({
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    originalName: {
        type: String
    }
}, { _id: false });
/**
 * UsedBy subdocument schema
 */
const UsedBySchema = new Schema({
    entityType: {
        type: String,
        enum: ['nugget', 'user', 'post', 'collection'],
        required: true
    },
    entityId: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: 'usedBy.entityType'
    }
}, { _id: false });
/**
 * Media Schema
 * MongoDB-first media tracking with Cloudinary integration
 */
const MediaSchema = new Schema({
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    purpose: {
        type: String,
        enum: ['avatar', 'nugget', 'attachment', 'other'],
        required: true,
        index: true
    },
    cloudinary: {
        type: CloudinarySchema,
        required: true
    },
    file: {
        type: FileSchema,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'orphaned', 'deleted'],
        default: 'active',
        index: true
    },
    usedBy: {
        type: UsedBySchema
    },
    deletedAt: {
        type: Date,
        index: { expireAfterSeconds: 0 } // TTL index for automatic cleanup
    }
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'media'
});
// Compound indexes for common queries
MediaSchema.index({ ownerId: 1, status: 1 });
MediaSchema.index({ 'usedBy.entityType': 1, 'usedBy.entityId': 1 });
MediaSchema.index({ status: 1, deletedAt: 1 });
// Note: Unique index on 'cloudinary.publicId' is already defined in schema field definition (line 73-74)
// No need to duplicate it here - Mongoose automatically creates unique index from 'unique: true'
export const Media = mongoose.model('Media', MediaSchema);
//# sourceMappingURL=Media.js.map