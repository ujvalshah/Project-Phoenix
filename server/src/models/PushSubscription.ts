import mongoose, { Schema, Document } from 'mongoose';

export type PushPlatform = 'web' | 'android' | 'ios';

export interface IPushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface IPushSubscription extends Document {
  userId: string;
  platform: PushPlatform;
  endpoint: string;
  keys?: IPushSubscriptionKeys;
  fcmToken?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionKeysSchema = new Schema<IPushSubscriptionKeys>({
  p256dh: { type: String, required: true },
  auth: { type: String, required: true },
}, { _id: false });

const PushSubscriptionSchema = new Schema<IPushSubscription>({
  userId: { type: String, required: true, index: true },
  platform: { type: String, enum: ['web', 'android', 'ios'], required: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { type: PushSubscriptionKeysSchema, required: false },
  fcmToken: { type: String, required: false },
  active: { type: Boolean, default: true },
}, {
  timestamps: true,
});

PushSubscriptionSchema.index({ userId: 1, platform: 1 });
PushSubscriptionSchema.index({ active: 1, platform: 1 });

export const PushSubscription = mongoose.model<IPushSubscription>(
  'PushSubscription',
  PushSubscriptionSchema
);
