import mongoose, { Schema } from 'mongoose';
const ReportReporterSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true }
}, { _id: false });
const ReportRespondentSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true }
}, { _id: false });
const ReportSchema = new Schema({
    targetId: { type: String, required: true, index: true },
    targetType: {
        type: String,
        enum: ['nugget', 'user', 'collection'],
        required: true,
        index: true
    },
    reason: {
        type: String,
        enum: ['spam', 'harassment', 'misinformation', 'copyright', 'other'],
        required: true,
        index: true
    },
    description: { type: String, trim: true },
    reporter: { type: ReportReporterSchema, required: true },
    respondent: { type: ReportRespondentSchema },
    status: {
        type: String,
        enum: ['open', 'resolved', 'dismissed'],
        default: 'open',
        index: true
    },
    resolvedAt: { type: Date },
    dismissedAt: { type: Date },
    actionedBy: { type: String }, // Admin user ID
    actionReason: { type: String, trim: true } // Optional reason for action
}, {
    timestamps: { createdAt: true, updatedAt: false } // Only createdAt, no updatedAt
});
// Indexes for efficient queries
ReportSchema.index({ status: 1, targetType: 1 });
ReportSchema.index({ createdAt: -1 });
ReportSchema.index({ targetId: 1, targetType: 1 });
export const Report = mongoose.model('Report', ReportSchema);
//# sourceMappingURL=Report.js.map