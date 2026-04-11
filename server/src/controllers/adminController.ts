import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Article } from '../models/Article.js';
import { Report } from '../models/Report.js';
import { Feedback } from '../models/Feedback.js';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
import { MediaQuotaConfig } from '../models/MediaQuotaConfig.js';
import { DisclaimerConfig } from '../models/DisclaimerConfig.js';
import { LRUCache } from '../utils/lruCache.js';
import { buildModerationQuery, getModerationStats } from '../services/moderationService.js';
import {
  getMediaQuotaConfig,
  invalidateMediaQuotaCache
} from '../services/mediaQuotaConfigService.js';
import {
  getDisclaimerConfig,
  invalidateDisclaimerCache
} from '../services/disclaimerConfigService.js';
import { AdminRequest } from '../middleware/requireAdmin.js';
import { getLogger } from '../utils/logger.js';

const updateMediaLimitsSchema = z.object({
  maxFilesPerUser: z.number().int().min(1).max(100000).optional(),
  maxStorageMB: z.number().int().min(10).max(5000).optional(),
  maxDailyUploads: z.number().int().min(1).max(1000).optional()
});

const updateDisclaimerSchema = z.object({
  defaultText: z.string().min(1, 'Disclaimer text is required').max(500, 'Disclaimer text too long').optional(),
  enableByDefault: z.boolean().optional()
});

// Short-lived cache to avoid hammering the database
// Cache up to 10 entries for 2 minutes each
const statsCache = new LRUCache<any>(10, 2 * 60 * 1000);
const CACHE_KEY = 'admin_stats';

export async function getAdminStats(req: Request, res: Response) {
  // Serve from cache when available
  const cached = statsCache.get(CACHE_KEY);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    userAgg,
    articleAgg,
    flaggedNuggetsAgg,
    moderationStats,
    feedbackAgg
  ] = await Promise.all([
    // User stats
    User.aggregate([
      {
        $project: {
          role: 1,
          createdAtDate: {
            $dateFromString: {
              dateString: '$auth.createdAt',
              onError: null,
              onNull: null
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          admins: {
            $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
          },
          newToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$createdAtDate', null] },
                    { $gte: ['$createdAtDate', startOfToday] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]),

    // Article (nugget) stats
    Article.aggregate([
      {
        $project: {
          visibility: 1,
          publishedAtDate: {
            $cond: [
              { $ne: ['$publishedAt', null] },
              { $dateFromString: { dateString: '$publishedAt', onError: null, onNull: null } },
              null
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          public: {
            $sum: { $cond: [{ $eq: ['$visibility', 'public'] }, 1, 0] }
          },
          private: {
            $sum: { $cond: [{ $eq: ['$visibility', 'private'] }, 1, 0] }
          },
          createdToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$publishedAtDate', null] },
                    { $gte: ['$publishedAtDate', startOfToday] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]),

    // Flagged nuggets (unique targetIds with open reports)
    // Use shared query builder for consistency
    Report.aggregate([
      { $match: buildModerationQuery({ status: 'open', targetType: 'nugget' }) },
      { $group: { _id: '$targetId' } },
      { $count: 'flagged' }
    ]),

    // Moderation stats by status
    // Use shared query builder for consistency with moderation list endpoint
    getModerationStats(),

    // Feedback stats by status
    Feedback.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const userStatsRaw = userAgg[0] || { total: 0, admins: 0, newToday: 0 };
  const articleStatsRaw = articleAgg[0] || { total: 0, public: 0, private: 0, createdToday: 0 };
  const flaggedNuggets = flaggedNuggetsAgg[0]?.flagged || 0;

  // Moderation stats already in correct format from getModerationStats()
  const feedbackStats = feedbackAgg.reduce(
    (acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    },
    { new: 0, read: 0, archived: 0 }
  );

  const response = {
    cached: false,
    generatedAt: new Date().toISOString(),
    users: {
      total: userStatsRaw.total || 0,
      newToday: userStatsRaw.newToday || 0,
      admins: userStatsRaw.admins || 0,
      active: userStatsRaw.total || 0, // No status field; treat all as active
      inactive: 0
    },
    nuggets: {
      total: articleStatsRaw.total || 0,
      public: articleStatsRaw.public || 0,
      private: articleStatsRaw.private || 0,
      createdToday: articleStatsRaw.createdToday || 0,
      flagged: flaggedNuggets,
      pendingModeration: moderationStats.open || 0
    },
    moderation: {
      total: (moderationStats.open || 0) + (moderationStats.resolved || 0) + (moderationStats.dismissed || 0),
      open: moderationStats.open || 0,
      resolved: moderationStats.resolved || 0,
      dismissed: moderationStats.dismissed || 0
    },
    feedback: {
      total: (feedbackStats.new || 0) + (feedbackStats.read || 0) + (feedbackStats.archived || 0),
      new: feedbackStats.new || 0,
      read: feedbackStats.read || 0,
      archived: feedbackStats.archived || 0
    }
  };

  // Cache the response
  statsCache.set(CACHE_KEY, response);

  return res.json(response);
}

/**
 * Manually verify a user's email (admin action)
 * PATCH /api/admin/users/:userId/verify-email
 *
 * This is idempotent - calling on an already-verified user returns success.
 * Creates an audit log entry for compliance tracking.
 */
export async function verifyUserEmail(req: AdminRequest, res: Response) {
  const { userId } = req.params;
  const adminId = req.userId;

  if (!adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Find the target user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const previousValue = user.auth.emailVerified;

    // Update emailVerified status (idempotent)
    user.auth.emailVerified = true;
    user.auth.updatedAt = new Date().toISOString();
    await user.save();

    // Create audit log entry
    await AdminAuditLog.create({
      adminId,
      action: 'VERIFY_USER_EMAIL',
      targetType: 'user',
      targetId: userId,
      previousValue: { emailVerified: previousValue },
      newValue: { emailVerified: true },
      metadata: {
        targetEmail: user.auth.email,
        targetUsername: user.profile.username,
        wasAlreadyVerified: previousValue
      },
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    getLogger().info({
      action: 'ADMIN_VERIFY_USER_EMAIL',
      adminId,
      targetUserId: userId,
      targetEmail: user.auth.email,
      wasAlreadyVerified: previousValue
    }, 'Admin manually verified user email');

    // Return updated user data (without password)
    const userResponse = {
      id: user._id,
      role: user.role,
      auth: {
        email: user.auth.email,
        emailVerified: user.auth.emailVerified,
        provider: user.auth.provider,
        createdAt: user.auth.createdAt,
        updatedAt: user.auth.updatedAt
      },
      profile: user.profile,
      appState: user.appState
    };

    return res.json({
      message: previousValue ? 'Email was already verified' : 'Email verified successfully',
      user: userResponse
    });
  } catch (error) {
    getLogger().error({ error, userId, adminId }, 'Failed to verify user email');
    return res.status(500).json({ message: 'Failed to verify user email' });
  }
}

/**
 * Get current media quota limits (admin only).
 * GET /api/admin/settings/media-limits
 * Returns effective limits (from DB or defaults).
 */
export async function getMediaLimits(req: AdminRequest, res: Response) {
  try {
    const limits = await getMediaQuotaConfig();
    return res.json({
      maxFilesPerUser: limits.maxFilesPerUser,
      maxStorageMB: Math.round(limits.maxStorageBytes / (1024 * 1024)),
      maxDailyUploads: limits.maxDailyUploads
    });
  } catch (error) {
    getLogger().error({ error }, 'Failed to get media limits');
    return res.status(500).json({ message: 'Failed to get media limits' });
  }
}

/**
 * Update media quota limits (admin only).
 * PATCH /api/admin/settings/media-limits
 * Body: { maxFilesPerUser?, maxStorageMB?, maxDailyUploads? }
 */
export async function updateMediaLimits(req: AdminRequest, res: Response) {
  const adminId = req.userId;
  if (!adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }

  const parseResult = updateMediaLimitsSchema.safeParse(req.body);
  if (!parseResult.success) {
    const message = parseResult.error.errors.map((e) => e.message).join('; ') || 'Validation failed';
    return res.status(400).json({ message: 'Invalid request', errors: parseResult.error.flatten().fieldErrors });
  }

  const updates = parseResult.data;
  if (!updates.maxFilesPerUser && updates.maxStorageMB === undefined && !updates.maxDailyUploads) {
    return res.status(400).json({ message: 'At least one limit must be provided' });
  }

  try {
    const current = await getMediaQuotaConfig();
    const previousValue = {
      maxFilesPerUser: current.maxFilesPerUser,
      maxStorageMB: Math.round(current.maxStorageBytes / (1024 * 1024)),
      maxDailyUploads: current.maxDailyUploads
    };

    const maxStorageBytes =
      updates.maxStorageMB !== undefined ? updates.maxStorageMB * 1024 * 1024 : current.maxStorageBytes;
    const newDoc = {
      id: 'default' as const,
      maxFilesPerUser: updates.maxFilesPerUser ?? current.maxFilesPerUser,
      maxStorageBytes,
      maxDailyUploads: updates.maxDailyUploads ?? current.maxDailyUploads,
      updatedAt: new Date()
    };

    await MediaQuotaConfig.findOneAndUpdate(
      { id: 'default' },
      { $set: newDoc },
      { upsert: true, new: true }
    );

    invalidateMediaQuotaCache();

    const newValue = {
      maxFilesPerUser: newDoc.maxFilesPerUser,
      maxStorageMB: Math.round(newDoc.maxStorageBytes / (1024 * 1024)),
      maxDailyUploads: newDoc.maxDailyUploads
    };

    await AdminAuditLog.create({
      adminId,
      action: 'UPDATE_MEDIA_QUOTA',
      targetType: 'system',
      targetId: 'media_limits',
      previousValue: previousValue as Record<string, unknown>,
      newValue: newValue as Record<string, unknown>,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    getLogger().info(
      { action: 'UPDATE_MEDIA_QUOTA', adminId, previousValue, newValue },
      'Admin updated media quota limits'
    );

    return res.json({
      message: 'Media limits updated',
      limits: newValue
    });
  } catch (error) {
    getLogger().error({ error, adminId }, 'Failed to update media limits');
    return res.status(500).json({ message: 'Failed to update media limits' });
  }
}

/**
 * Get current disclaimer config (admin or public).
 * GET /api/admin/settings/disclaimer
 * Returns effective config (from DB or defaults).
 */
export async function getDisclaimerSettings(req: AdminRequest, res: Response) {
  try {
    const config = await getDisclaimerConfig();
    return res.json(config);
  } catch (error) {
    getLogger().error({ error }, 'Failed to get disclaimer config');
    return res.status(500).json({ message: 'Failed to get disclaimer config' });
  }
}

/**
 * Update disclaimer config (admin only).
 * PATCH /api/admin/settings/disclaimer
 * Body: { defaultText?, enableByDefault? }
 */
export async function updateDisclaimerSettings(req: AdminRequest, res: Response) {
  const adminId = req.userId;
  if (!adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }

  const parseResult = updateDisclaimerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: 'Invalid request', errors: parseResult.error.flatten().fieldErrors });
  }

  const updates = parseResult.data;
  if (updates.defaultText === undefined && updates.enableByDefault === undefined) {
    return res.status(400).json({ message: 'At least one field must be provided' });
  }

  try {
    const current = await getDisclaimerConfig();
    const previousValue = { ...current };

    const newDoc = {
      id: 'default' as const,
      defaultText: updates.defaultText ?? current.defaultText,
      enableByDefault: updates.enableByDefault ?? current.enableByDefault,
      updatedAt: new Date()
    };

    await DisclaimerConfig.findOneAndUpdate(
      { id: 'default' },
      { $set: newDoc },
      { upsert: true, new: true }
    );

    invalidateDisclaimerCache();

    const newValue = {
      defaultText: newDoc.defaultText,
      enableByDefault: newDoc.enableByDefault
    };

    await AdminAuditLog.create({
      adminId,
      action: 'UPDATE_DISCLAIMER_CONFIG',
      targetType: 'system',
      targetId: 'disclaimer_config',
      previousValue: previousValue as Record<string, unknown>,
      newValue: newValue as Record<string, unknown>,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    getLogger().info(
      { action: 'UPDATE_DISCLAIMER_CONFIG', adminId, previousValue, newValue },
      'Admin updated disclaimer config'
    );

    return res.json({
      message: 'Disclaimer config updated',
      config: newValue
    });
  } catch (error) {
    getLogger().error({ error, adminId }, 'Failed to update disclaimer config');
    return res.status(500).json({ message: 'Failed to update disclaimer config' });
  }
}

