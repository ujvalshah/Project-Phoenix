import mongoose, { Schema, Document } from 'mongoose';

/**
 * Value Prop Strip Config
 * Single-document store for first-time home-page value proposition copy.
 */
export interface IValuePropStripConfig extends Document {
  id: 'default';
  title: string;
  body: string;
  updatedAt: Date;
}

const ValuePropStripConfigSchema = new Schema<IValuePropStripConfig>({
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
  collection: 'valuepropstripconfigs'
});

export const ValuePropStripConfig = mongoose.model<IValuePropStripConfig>(
  'ValuePropStripConfig',
  ValuePropStripConfigSchema
);
