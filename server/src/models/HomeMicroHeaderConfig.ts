import mongoose, { Schema, Document } from 'mongoose';

/**
 * Home Micro Header Config
 * Single-document store for homepage H1 + support line copy.
 */
export interface IHomeMicroHeaderConfig extends Document {
  id: 'default';
  title: string;
  body: string;
  updatedAt: Date;
}

const HomeMicroHeaderConfigSchema = new Schema<IHomeMicroHeaderConfig>({
  id: {
    type: String,
    required: true,
    unique: true,
    default: 'default'
  },
  title: {
    type: String,
    required: true,
    maxlength: 120
  },
  body: {
    type: String,
    required: true,
    maxlength: 500
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  collection: 'homemicroheaderconfigs'
});

export const HomeMicroHeaderConfig = mongoose.model<IHomeMicroHeaderConfig>(
  'HomeMicroHeaderConfig',
  HomeMicroHeaderConfigSchema
);
