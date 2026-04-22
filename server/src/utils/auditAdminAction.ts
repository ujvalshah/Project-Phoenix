import type { Request } from 'express';
import { AdminAuditLog, AdminAction } from '../models/AdminAuditLog.js';
import { getLogger } from './logger.js';

export interface AuditAdminActionParams {
  action: AdminAction;
  targetType: 'user' | 'article' | 'collection' | 'system';
  targetId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
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
export async function auditAdminAction(
  req: Request,
  params: AuditAdminActionParams
): Promise<void> {
  const adminId = (req as { user?: { userId?: string } }).user?.userId;
  if (!adminId) return;

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
        requestId: (req as { id?: string }).id,
      },
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('User-Agent'),
    });
  } catch (error) {
    getLogger().error(
      {
        err: error,
        action: params.action,
        targetId: params.targetId,
        adminId,
      },
      'Failed to write AdminAuditLog entry'
    );
  }
}
