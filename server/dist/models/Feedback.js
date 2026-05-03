import mongoose, { Schema } from 'mongoose';
const FeedbackUserSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String },
    username: { type: String },
    avatar: { type: String }
}, { _id: false });
const FeedbackSchema = new Schema({
    content: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['bug', 'feature', 'general'],
        default: 'general',
        index: true
    },
    status: {
        type: String,
        enum: ['new', 'read', 'archived'],
        default: 'new',
        index: true
    },
    user: { type: FeedbackUserSchema },
    email: { type: String, trim: true, lowercase: true, sparse: true }
}, {
    timestamps: { createdAt: true, updatedAt: false } // Only createdAt, no updatedAt
});
// Indexes for efficient queries
FeedbackSchema.index({ status: 1, type: 1 });
FeedbackSchema.index({ createdAt: -1 });
export const Feedback = mongoose.model('Feedback', FeedbackSchema);
//# sourceMappingURL=Feedback.js.map