import mongoose, { Schema, Document } from 'mongoose';

/**
 * Market Pulse Micro Header Config
 * Single-document store for Market Pulse permanent H1 + support line copy.
 */
export interface IMarketPulseMicroHeaderConfig extends Document {
  id: 'default';
  title: string;
  body: string;
  updatedAt: Date;
}

const MarketPulseMicroHeaderConfigSchema = new Schema<IMarketPulseMicroHeaderConfig>({
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
  collection: 'marketpulsemicroheaderconfigs'
});

export const MarketPulseMicroHeaderConfig = mongoose.model<IMarketPulseMicroHeaderConfig>(
  'MarketPulseMicroHeaderConfig',
  MarketPulseMicroHeaderConfigSchema
);
