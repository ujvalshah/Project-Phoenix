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
  failureCount: number;
  lastSeenAt?: Date;
  lastSuccessAt?: Date;
  invalidatedReason?: string;
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
  // Endpoint uniqueness is scoped to (userId, endpoint). A sole unique index on
  // endpoint breaks account-switching on a shared browser: when user B subscribes
  // on the same device after user A, the upsert would hit E11000.
  endpoint: { type: String, required: true },
  keys: { type: PushSubscriptionKeysSchema, required: false },
  fcmToken: { type: String, required: false },
  active: { type: Boolean, default: true },
  failureCount: { type: Number, default: 0 },
  lastSeenAt: { type: Date, required: false },
  lastSuccessAt: { type: Date, required: false },
  invalidatedReason: { type: String, required: false },
}, {
  timestamps: true,
});

PushSubscriptionSchema.index({ userId: 1, platform: 1 });
PushSubscriptionSchema.index({ active: 1, platform: 1 });
PushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });
PushSubscriptionSchema.index({ endpoint: 1 }); // Non-unique lookup for dedupe/ownership sweeps

export const PushSubscription = mongoose.model<IPushSubscription>(
  'PushSubscription',
  PushSubscriptionSchema
);
