import mongoose, { Schema, Document } from 'mongoose';

/**
 * Media Purpose Types
 * Defines what the media is used for in the system
 */
export type MediaPurpose = 'avatar' | 'nugget' | 'attachment' | 'other';

/**
 * Media Status
 * Tracks lifecycle state of media files
 */
export type MediaStatus = 'active' | 'orphaned' | 'deleted';

/**
 * Entity Types that can use media
 */
export type MediaEntityType = 'nugget' | 'user' | 'post' | 'collection';

/**
 * Cloudinary Resource Types
 */
export type CloudinaryResourceType = 'image' | 'video' | 'raw';

/**
 * Media Document Interface
 * MongoDB-first media tracking with Cloudinary integration
 */
export interface IMedia extends Document {
  // Ownership & Authorization
  ownerId: mongoose.Types.ObjectId; // User who uploaded
  purpose: MediaPurpose; // What this media is for
  
  // Cloudinary metadata (source of truth for storage)
  cloudinary: {
    publicId: string; // Unique Cloudinary identifier
    secureUrl: string; // HTTPS URL to the asset
    resourceType: CloudinaryResourceType; // image, video, or raw
    format?: string; // jpg, png, mp4, etc.
    width?: number; // Image/video width in pixels
    height?: number; // Image/video height in pixels
    duration?: number; // Video duration in seconds
    bytes?: number; // File size in bytes
  };
  
  // Original file metadata
  file: {
    mimeType: string; // MIME type (e.g., image/jpeg)
    size: number; // Original file size in bytes
    originalName?: string; // Original filename
  };
  
  // Lifecycle management
  status: MediaStatus; // active, orphaned, or deleted
  usedBy?: {
    entityType: MediaEntityType; // What entity is using this
    entityId: mongoose.Types.ObjectId; // ID of the entity
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // When marked as deleted (for TTL cleanup)
}

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
const MediaSchema = new Schema<IMedia>({
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

// Prevent duplicate publicIds
MediaSchema.index({ 'cloudinary.publicId': 1 }, { unique: true });

export const Media = mongoose.model<IMedia>('Media', MediaSchema);





