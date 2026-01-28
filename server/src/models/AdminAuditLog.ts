import mongoose, { Schema, Document } from 'mongoose';

/**
 * Admin Audit Log Model
 *
 * Tracks all admin actions for security and compliance purposes.
 * This is separate from ModerationAuditLog which focuses on report/moderation actions.
 */

export type AdminAction =
  | 'VERIFY_USER_EMAIL'
  | 'UPDATE_USER_ROLE'
  | 'SUSPEND_USER'
  | 'ACTIVATE_USER'
  | 'DELETE_USER'
  | 'UPDATE_USER_PROFILE'
  | 'RESET_USER_PASSWORD';

export interface IAdminAuditLog extends Document {
  adminId: string;
  action: AdminAction;
  targetType: 'user' | 'article' | 'collection' | 'system';
  targetId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>({
  adminId: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: [
      'VERIFY_USER_EMAIL',
      'UPDATE_USER_ROLE',
      'SUSPEND_USER',
      'ACTIVATE_USER',
      'DELETE_USER',
      'UPDATE_USER_PROFILE',
      'RESET_USER_PASSWORD'
    ],
    required: true,
    index: true
  },
  targetType: {
    type: String,
    enum: ['user', 'article', 'collection', 'system'],
    required: true,
    index: true
  },
  targetId: {
    type: String,
    required: true,
    index: true
  },
  previousValue: {
    type: Schema.Types.Mixed,
    default: undefined
  },
  newValue: {
    type: Schema.Types.Mixed,
    default: undefined
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Compound indexes for efficient queries
AdminAuditLogSchema.index({ adminId: 1, timestamp: -1 });
AdminAuditLogSchema.index({ targetId: 1, targetType: 1, timestamp: -1 });
AdminAuditLogSchema.index({ action: 1, timestamp: -1 });

export const AdminAuditLog = mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
