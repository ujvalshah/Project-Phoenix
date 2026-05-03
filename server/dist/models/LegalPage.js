import mongoose, { Schema } from 'mongoose';
const LegalPageSchema = new Schema({
    slug: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    noindex: { type: Boolean, default: false },
    lastUpdated: { type: String, required: true },
    effectiveDate: { type: String, required: true },
    showInFooter: { type: Boolean, default: true },
    description: { type: String, default: '', trim: true },
    order: { type: Number, default: 0 },
}, { timestamps: false });
LegalPageSchema.index({ order: 1 });
LegalPageSchema.index({ enabled: 1, showInFooter: 1 });
export const LegalPage = mongoose.model('LegalPage', LegalPageSchema);
//# sourceMappingURL=LegalPage.js.map