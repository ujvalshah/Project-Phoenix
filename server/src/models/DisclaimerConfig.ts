import mongoose, { Schema, Document } from 'mongoose';

/**
 * Disclaimer Config
 * Single-document store for site-wide default disclaimer text.
 * Configurable via Admin UI; defaults used when no document exists.
 */
export interface IDisclaimerConfig extends Document {
  id: 'default';
  defaultText: string;
  enableByDefault: boolean;
  updatedAt: Date;
}

const DisclaimerConfigSchema = new Schema<IDisclaimerConfig>({
  id: {
    type: String,
    required: true,
    unique: true,
    default: 'default'
  },
  defaultText: {
    type: String,
    required: true,
    maxlength: 500
  },
  enableByDefault: {
    type: Boolean,
    required: true,
    default: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  collection: 'disclaimerconfigs'
});

export const DisclaimerConfig = mongoose.model<IDisclaimerConfig>('DisclaimerConfig', DisclaimerConfigSchema);
