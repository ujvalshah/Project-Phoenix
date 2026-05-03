import mongoose, { Schema } from 'mongoose';
const NotificationDataSchema = new Schema({
    articleId: { type: String, required: false },
    batchIds: { type: [String], required: false },
    url: { type: String, required: true },
}, { _id: false });
const NotificationSchema = new Schema({
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
export const Notification = mongoose.model('Notification', NotificationSchema);
//# sourceMappingURL=Notification.js.map