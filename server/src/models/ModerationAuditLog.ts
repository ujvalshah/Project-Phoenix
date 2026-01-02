import mongoose, { Schema, Document } from 'mongoose';

export interface IModerationAuditLog extends Document {
  reportId: string;
  action: 'resolve' | 'dismiss';
  performedBy: string; // Admin user ID
  previousStatus: 'open' | 'resolved' | 'dismissed';
  newStatus: 'open' | 'resolved' | 'dismissed';
  timestamp: Date;
  metadata?: Record<string, any>; // Optional additional data
}

const ModerationAuditLogSchema = new Schema<IModerationAuditLog>({
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

export const ModerationAuditLog = mongoose.model<IModerationAuditLog>('ModerationAuditLog', ModerationAuditLogSchema);












