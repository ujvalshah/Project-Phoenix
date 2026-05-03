import mongoose, { Schema } from 'mongoose';
const ModerationAuditLogSchema = new Schema({
    reportId: {
        type: String,
        required: true,
        index: true
    },
    action: {
        type: String,
        enum: ['resolve', 'dismiss'],
        required: true,
        index: true
    },
    performedBy: {
        type: String,
        required: true,
        index: true
    },
    previousStatus: {
        type: String,
        enum: ['open', 'resolved', 'dismissed'],
        required: true
    },
    newStatus: {
        type: String,
        enum: ['open', 'resolved', 'dismissed'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: false // We use timestamp field instead
});
// Indexes for efficient queries
ModerationAuditLogSchema.index({ reportId: 1, timestamp: -1 });
ModerationAuditLogSchema.index({ performedBy: 1, timestamp: -1 });
export const ModerationAuditLog = mongoose.model('ModerationAuditLog', ModerationAuditLogSchema);
//# sourceMappingURL=ModerationAuditLog.js.map