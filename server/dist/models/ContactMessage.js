import mongoose, { Schema } from 'mongoose';
const ContactMessageSchema = new Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
        type: String,
        enum: ['new', 'read', 'replied', 'archived'],
        default: 'new',
        index: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});
// Indexes for efficient queries
ContactMessageSchema.index({ status: 1, createdAt: -1 });
ContactMessageSchema.index({ createdAt: -1 });
export const ContactMessage = mongoose.model('ContactMessage', ContactMessageSchema);
//# sourceMappingURL=ContactMessage.js.map