import mongoose, { Schema, Document } from 'mongoose';

/**
 * Market Pulse Intro Config
 * Single-document store for first-time Market Pulse stream intro copy.
 */
export interface IMarketPulseIntroConfig extends Document {
  id: 'default';
  title: string;
  body: string;
  enabled: boolean;
  updatedAt: Date;
}

const MarketPulseIntroConfigSchema = new Schema<IMarketPulseIntroConfig>({
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
  enabled: {
    type: Boolean,
    default: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  collection: 'marketpulseintroconfigs'
});

export const MarketPulseIntroConfig = mongoose.model<IMarketPulseIntroConfig>(
  'MarketPulseIntroConfig',
  MarketPulseIntroConfigSchema
);
