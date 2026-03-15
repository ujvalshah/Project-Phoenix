import mongoose, { Schema, Document } from 'mongoose';

/**
 * Media Quota Config
 * Single-document store for per-user upload limits (max files, storage, daily uploads).
 * Configurable via Admin UI; defaults used when no document exists.
 */
export interface IMediaQuotaConfig extends Document {
  id: 'default';
  maxFilesPerUser: number;
  maxStorageBytes: number;
  maxDailyUploads: number;
  updatedAt: Date;
}

const MediaQuotaConfigSchema = new Schema<IMediaQuotaConfig>({
  id: {
    type: String,
    required: true,
    unique: true,
    default: 'default'
  },
  maxFilesPerUser: {
    type: Number,
    required: true,
    min: 1,
    max: 100000
  },
  maxStorageBytes: {
    type: Number,
    required: true,
    min: 10 * 1024 * 1024, // 10 MB
    max: 5000 * 1024 * 1024 // 5000 MB
  },
  maxDailyUploads: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  collection: 'mediaquotaconfigs'
});

export const MediaQuotaConfig = mongoose.model<IMediaQuotaConfig>('MediaQuotaConfig', MediaQuotaConfigSchema);
