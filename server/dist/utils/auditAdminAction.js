import { AdminAuditLog } from '../models/AdminAuditLog.js';
import { getLogger } from './logger.js';
export class AuditPersistenceError extends Error {
    constructor(message = 'Failed to persist admin audit action') {
        super(message);
        this.name = 'AuditPersistenceError';
    }
}
/**
 * Records a sensitive admin action to the AdminAuditLog collection.
 *
 * Caller is responsible for restricting invocations to admin-on-other-user
 * actions (self-edits should not be logged as admin actions). The helper
 * itself only no-ops when there is no authenticated user on the request.
 *
 * Failures are logged but never thrown — losing an audit row should not
 * unwind a successful state-changing request, but the gap MUST be visible
 * in logs for forensic reconstruction.
 */
export async function auditAdminAction(req, params, options) {
    const adminId = req.user?.userId;
    if (!adminId)
        return { persisted: false };
    try {
        await AdminAuditLog.create({
            adminId,
            action: params.action,
            targetType: params.targetType,
            targetId: params.targetId,
            previousValue: params.previousValue,
            newValue: params.newValue,
            metadata: {
                ...(params.metadata ?? {}),
                ...(params.reason !== undefined ? { reason: params.reason } : {}),
                requestId: req.id,
            },
            ipAddress: req.ip || req.socket?.remoteAddress,
            userAgent: req.get('User-Agent'),
        });
    }
    catch (error) {
        getLogger().error({
            err: error,
            action: params.action,
            targetId: params.targetId,
            adminId,
        }, 'Failed to write AdminAuditLog entry');
        if (options?.failOnError) {
            throw new AuditPersistenceError();
        }
        return { persisted: false };
    }
    return { persisted: true };
}
//# sourceMappingURL=auditAdminAction.js.map