import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType = 'new_nugget' | 'digest' | 'system';

export interface INotificationData {
  articleId?: string;
  batchIds?: string[];
  url: string;
}

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: INotificationData;
  read: boolean;
  // Channels we *attempted* to deliver on. Provider-ack'd (push) does not
  // mean device-received; for per-attempt truth read NotificationDelivery.
  attemptedVia: string[];
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationDataSchema = new Schema<INotificationData>({
  articleId: { type: String, required: false },
  batchIds: { type: [String], required: false },
  url: { type: String, required: true },
}, { _id: false });

const NotificationSchema = new Schema<INotification>({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['new_nugget', 'digest', 'system'], required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: NotificationDataSchema, required: true },
  read: { type: Boolean, default: false },
  attemptedVia: { type: [String], default: [] },
  dedupeKey: { type: String, required: false },
}, {
  timestamps: true,
});

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true, sparse: true });
// Auto-delete notifications after 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const Notification = mongoose.model<INotification>(
  'Notification',
  NotificationSchema
);
