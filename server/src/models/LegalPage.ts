import mongoose, { Schema, Document } from 'mongoose';

export interface ILegalPage extends Document {
  id: string; // Custom ID field (slug-based)
  title: string;
  slug: string;
  isEnabled: boolean;
  content: string;
  lastUpdated: string;
}

const LegalPageSchema = new Schema<ILegalPage>({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  isEnabled: { type: Boolean, default: true },
  content: { type: String, required: true },
  lastUpdated: { type: String, required: true }
}, {
  timestamps: false
});

// Explicit indexes for performance
LegalPageSchema.index({ slug: 1 }); // Already unique, but explicit for clarity
LegalPageSchema.index({ id: 1 }); // Already unique, but explicit for clarity
LegalPageSchema.index({ isEnabled: 1 }); // For filtering enabled pages

export const LegalPage = mongoose.model<ILegalPage>('LegalPage', LegalPageSchema);












