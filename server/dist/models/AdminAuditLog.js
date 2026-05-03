import mongoose, { Schema } from 'mongoose';
const AdminAuditLogSchema = new Schema({
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
            'UPDATE_USER_SEARCH_COHORT',
            'SUSPEND_USER',
            'BAN_USER',
            'ACTIVATE_USER',
            'REVOKE_SESSIONS',
            'DELETE_USER',
            'UPDATE_USER_PROFILE',
            'RESET_USER_PASSWORD',
            'UPDATE_MEDIA_QUOTA',
            'UPDATE_DISCLAIMER_CONFIG',
            'UPDATE_VALUE_PROP_STRIP_CONFIG',
            'UPDATE_MARKET_PULSE_INTRO_CONFIG',
            'UPDATE_HOME_MICRO_HEADER_CONFIG',
            'UPDATE_MARKET_PULSE_MICRO_HEADER_CONFIG'
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
export const AdminAuditLog = mongoose.model('AdminAuditLog', AdminAuditLogSchema);
//# sourceMappingURL=AdminAuditLog.js.map