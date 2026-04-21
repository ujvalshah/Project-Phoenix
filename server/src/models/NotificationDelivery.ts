import mongoose, { Schema, Document } from 'mongoose';

export type DeliveryChannel = 'push' | 'in_app';
export type DeliveryStatus = 'queued' | 'sent_to_provider' | 'provider_failed' | 'subscription_removed' | 'shown_in_app';

export interface INotificationDelivery extends Document {
  notificationId?: string;
  userId: string;
  subscriptionId?: string;
  endpoint?: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  jobName: string;
  dedupeKey: string;
  attempt: number;
  providerStatusCode?: number;
  error?: string;
  payloadType: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationDeliverySchema = new Schema<INotificationDelivery>({
  notificationId: { type: String, required: false, index: true },
  userId: { type: String, required: true, index: true },
  subscriptionId: { type: String, required: false, index: true },
  endpoint: { type: String, required: false },
  channel: { type: String, enum: ['push', 'in_app'], required: true },
  status: {
    type: String,
    enum: ['queued', 'sent_to_provider', 'provider_failed', 'subscription_removed', 'shown_in_app'],
    required: true,
  },
  jobName: { type: String, required: true },
  dedupeKey: { type: String, required: true, index: true },
  attempt: { type: Number, required: true, default: 1 },
  providerStatusCode: { type: Number, required: false },
  error: { type: String, required: false },
  payloadType: { type: String, required: true },
}, { timestamps: true });

NotificationDeliverySchema.index({ dedupeKey: 1, channel: 1, status: 1 });
NotificationDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 3600 });

export const NotificationDelivery = mongoose.model<INotificationDelivery>(
  'NotificationDelivery',
  NotificationDeliverySchema
);
