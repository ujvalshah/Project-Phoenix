import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Article } from '../models/Article.js';
import { Report } from '../models/Report.js';
import { Feedback } from '../models/Feedback.js';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
import { MediaQuotaConfig } from '../models/MediaQuotaConfig.js';
import { DisclaimerConfig } from '../models/DisclaimerConfig.js';
import { HomeMicroHeaderConfig } from '../models/HomeMicroHeaderConfig.js';
import { MarketPulseMicroHeaderConfig } from '../models/MarketPulseMicroHeaderConfig.js';
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
import {
  getHomeMicroHeaderConfig,
  invalidateHomeMicroHeaderCache
} from '../services/homeMicroHeaderConfigService.js';
import {
  getMarketPulseMicroHeaderConfig,
  invalidateMarketPulseMicroHeaderCache
} from '../services/marketPulseMicroHeaderConfigService.js';
import { invalidateRedisOnboardingBundleCache } from '../config/publicReadCache.js';
import { AdminRequest } from '../middleware/requireAdminRole.js';
import { getLogger } from '../utils/logger.js';
import { auditAdminAction } from '../utils/auditAdminAction.js';
import {
  revokeAllRefreshTokensDetailed,
  upsertUserTokenVersionCache,
} from '../services/tokenService.js';
import type { AdminAction } from '../models/AdminAuditLog.js';
import type { UserStatus } from '../models/User.js';

const updateMediaLimitsSchema = z.object({
  maxFilesPerUser: z.number().int().min(1).max(100000).optional(),
  maxStorageMB: z.number().int().min(10).max(5000).optional(),
  maxDailyUploads: z.number().int().min(1).max(1000).optional()
});

const updateDisclaimerSchema = z.object({
  defaultText: z.string().min(1, 'Disclaimer text is required').max(500, 'Disclaimer text too long').optional(),
  enableByDefault: z.boolean().optional()
});

/** Shared for editable home copy surfaces (title + body). */
const updateOnboardingTitleBodySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title too long').optional(),
  body: z.string().trim().min(1, 'Body is required').max(500, 'Body too long').optional()
});

// Optional `reason` body for lifecycle endpoints. Free-text is captured in the
// audit metadata; we cap length so a typo can't bloat the audit collection.
const lifecycleBodySchema = z.object({
  reason: z.string().max(500).optional()
}).strict().optional();

const updateSearchCohortSchema = z.object({
  searchCohort: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, 'searchCohort can include letters, numbers, dot, underscore, and hyphen')
    .nullable()
    .optional(),
}).strict();

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
    // User stats. PR10 / P1.7 — `active`, `suspended`, and `banned` come from
    // the real User.status field (added in PR7b), not the placeholder
    // "everyone is active" we used before the field existed. Legacy docs
    // written before the migration have status=undefined; we treat those as
    // active so the totals stay consistent with the lifecycle endpoints,
    // which all default missing status to 'active'.
    User.aggregate([
      {
        $project: {
          role: 1,
          status: 1,
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
          suspended: {
            $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] }
          },
          banned: {
            $sum: { $cond: [{ $eq: ['$status', 'banned'] }, 1, 0] }
          },
          // Active = explicit 'active' OR missing status (legacy pre-PR7b docs).
          active: {
            $sum: {
              $cond: [
                { $in: ['$status', ['active', null, undefined]] },
                1,
                0
              ]
            }
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
          status: 1,
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
          draft: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          published: {
            $sum: {
              $cond: [
                { $in: ['$status', ['published', null, undefined]] },
                1,
                0
              ]
            }
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

  const userStatsRaw = userAgg[0] || { total: 0, admins: 0, newToday: 0, active: 0, suspended: 0, banned: 0 };
  const articleStatsRaw = articleAgg[0] || {
    total: 0,
    public: 0,
    private: 0,
    draft: 0,
    published: 0,
    createdToday: 0,
  };
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
      // PR10 / P1.7 — real status counts (was hardcoded "active=total" before
      // PR7b added the status field). `inactive` is preserved for the older
      // dashboard widgets and is the union of suspended + banned.
      active: userStatsRaw.active || 0,
      suspended: userStatsRaw.suspended || 0,
      banned: userStatsRaw.banned || 0,
      inactive: (userStatsRaw.suspended || 0) + (userStatsRaw.banned || 0)
    },
    nuggets: {
      total: articleStatsRaw.total || 0,
      public: articleStatsRaw.public || 0,
      private: articleStatsRaw.private || 0,
      draft: articleStatsRaw.draft || 0,
      published: articleStatsRaw.published || 0,
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
 * PATCH /api/admin/users/:userId/search-cohort
 * Body: { searchCohort: string | null }
 *
 * Sets (or clears with null) the server-assigned search rollout cohort.
 */
export async function updateUserSearchCohort(req: AdminRequest, res: Response) {
  const adminId = req.userId;
  const targetUserId = req.params.userId;
  if (!adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }
  if (!targetUserId) {
    return res.status(400).json({ message: 'User ID is required' });
  }
  if (adminId === targetUserId) {
    return res.status(400).json({
      message: 'Admins cannot mutate their own rollout cohort through this endpoint',
      code: 'CANNOT_MUTATE_SELF',
    });
  }

  const parsed = updateSearchCohortSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid request',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const nextSearchCohort =
    parsed.data.searchCohort === undefined ? undefined : parsed.data.searchCohort;
  if (nextSearchCohort === undefined) {
    return res.status(400).json({ message: 'searchCohort is required (string or null)' });
  }

  try {
    const user = await User.findById(targetUserId).select('auth.email profile.username appState.searchCohort');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const previousSearchCohort =
      typeof user.appState?.searchCohort === 'string' && user.appState.searchCohort.trim().length > 0
        ? user.appState.searchCohort.trim()
        : null;
    const normalizedNext = nextSearchCohort ? nextSearchCohort.trim() : null;
    const changed = previousSearchCohort !== normalizedNext;

    user.appState = {
      ...user.appState,
      searchCohort: normalizedNext || undefined,
    };
    await user.save();

    const auditResult = await auditAdminAction(req, {
      action: 'UPDATE_USER_SEARCH_COHORT',
      targetType: 'user',
      targetId: targetUserId,
      previousValue: { searchCohort: previousSearchCohort },
      newValue: { searchCohort: normalizedNext },
      metadata: {
        targetEmail: user.auth?.email,
        targetUsername: user.profile?.username,
        changed,
      },
    });

    return res.json({
      message: changed ? 'Search cohort updated' : 'Search cohort unchanged',
      searchCohort: normalizedNext,
      auditPersisted: auditResult.persisted,
    });
  } catch (error) {
    getLogger().error(
      { err: error, adminId, targetUserId },
      'Failed to update user search cohort'
    );
    return res.status(500).json({ message: 'Failed to update user search cohort' });
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

/**
 * Get current Home micro-header copy.
 * GET /api/admin/settings/home-micro-header
 * Returns effective config (from DB or defaults).
 */
export async function getHomeMicroHeaderSettings(_req: AdminRequest, res: Response) {
  try {
    const config = await getHomeMicroHeaderConfig();
    return res.json(config);
  } catch (error) {
    getLogger().error({ error }, 'Failed to get Home micro-header config');
    return res.status(500).json({ message: 'Failed to get Home micro-header config' });
  }
}

/**
 * Update Home micro-header copy (admin only).
 * PATCH /api/admin/settings/home-micro-header
 * Body: { title?, body? }
 */
export async function updateHomeMicroHeaderSettings(req: AdminRequest, res: Response) {
  const adminId = req.userId;
  if (!adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }

  const parseResult = updateOnboardingTitleBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: 'Invalid request', errors: parseResult.error.flatten().fieldErrors });
  }

  const updates = parseResult.data;
  if (updates.title === undefined && updates.body === undefined) {
    return res.status(400).json({ message: 'At least one field must be provided' });
  }

  try {
    const current = await getHomeMicroHeaderConfig();
    const previousValue = { ...current };

    const newDoc = {
      id: 'default' as const,
      title: updates.title ?? current.title,
      body: updates.body ?? current.body,
      updatedAt: new Date()
    };

    await HomeMicroHeaderConfig.findOneAndUpdate(
      { id: 'default' },
      { $set: newDoc },
      { upsert: true, new: true }
    );

    invalidateHomeMicroHeaderCache();
    void invalidateRedisOnboardingBundleCache();

    const newValue = {
      title: newDoc.title,
      body: newDoc.body
    };

    await AdminAuditLog.create({
      adminId,
      action: 'UPDATE_HOME_MICRO_HEADER_CONFIG',
      targetType: 'system',
      targetId: 'home_micro_header_config',
      previousValue: previousValue as Record<string, unknown>,
      newValue: newValue as Record<string, unknown>,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    getLogger().info(
      { action: 'UPDATE_HOME_MICRO_HEADER_CONFIG', adminId, previousValue, newValue, target: 'home_micro_header_config' },
      'Admin updated Home micro-header config'
    );

    return res.json({
      message: 'Home micro-header config updated',
      config: newValue
    });
  } catch (error) {
    getLogger().error({ error, adminId }, 'Failed to update Home micro-header config');
    return res.status(500).json({ message: 'Failed to update Home micro-header config' });
  }
}

/**
 * Get current Market Pulse micro-header copy.
 * GET /api/admin/settings/market-pulse-micro-header
 * Returns effective config (from DB or defaults).
 */
export async function getMarketPulseMicroHeaderSettings(_req: AdminRequest, res: Response) {
  try {
    const config = await getMarketPulseMicroHeaderConfig();
    return res.json(config);
  } catch (error) {
    getLogger().error({ error }, 'Failed to get Market Pulse micro-header config');
    return res.status(500).json({ message: 'Failed to get Market Pulse micro-header config' });
  }
}

/**
 * Update Market Pulse micro-header copy (admin only).
 * PATCH /api/admin/settings/market-pulse-micro-header
 * Body: { title?, body? }
 */
export async function updateMarketPulseMicroHeaderSettings(req: AdminRequest, res: Response) {
  const adminId = req.userId;
  if (!adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }

  const parseResult = updateOnboardingTitleBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: 'Invalid request', errors: parseResult.error.flatten().fieldErrors });
  }

  const updates = parseResult.data;
  if (updates.title === undefined && updates.body === undefined) {
    return res.status(400).json({ message: 'At least one field must be provided' });
  }

  try {
    const current = await getMarketPulseMicroHeaderConfig();
    const previousValue = { ...current };

    const newDoc = {
      id: 'default' as const,
      title: updates.title ?? current.title,
      body: updates.body ?? current.body,
      updatedAt: new Date()
    };

    await MarketPulseMicroHeaderConfig.findOneAndUpdate(
      { id: 'default' },
      { $set: newDoc },
      { upsert: true, new: true }
    );

    invalidateMarketPulseMicroHeaderCache();
    void invalidateRedisOnboardingBundleCache();

    const newValue = {
      title: newDoc.title,
      body: newDoc.body
    };

    await AdminAuditLog.create({
      adminId,
      action: 'UPDATE_MARKET_PULSE_MICRO_HEADER_CONFIG',
      targetType: 'system',
      targetId: 'market_pulse_micro_header_config',
      previousValue: previousValue as Record<string, unknown>,
      newValue: newValue as Record<string, unknown>,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    getLogger().info(
      { action: 'UPDATE_MARKET_PULSE_MICRO_HEADER_CONFIG', adminId, previousValue, newValue, target: 'market_pulse_micro_header_config' },
      'Admin updated Market Pulse micro-header config'
    );

    return res.json({
      message: 'Market Pulse micro-header config updated',
      config: newValue
    });
  } catch (error) {
    getLogger().error({ error, adminId }, 'Failed to update Market Pulse micro-header config');
    return res.status(500).json({ message: 'Failed to update Market Pulse micro-header config' });
  }
}

// ============================================================================
// Account lifecycle (suspend / ban / activate / revoke-sessions)
// ----------------------------------------------------------------------------
// These endpoints are the SOLE write path for `User.status` — the PUT user
// schema deliberately omits the field so every status transition is forced
// through here and audited. Suspend and ban additionally bump tokenVersion
// and revoke refresh tokens so live sessions die immediately, not at the
// next access-token TTL. Activate intentionally does NOT bump tokenVersion:
// the user was already locked out by the suspend/ban transition, so they
// have to reauthenticate anyway and a second bump would just invalidate
// the fresh tokens of any admin tooling already inspecting the account.
// ============================================================================

type LifecycleVerb = 'suspend' | 'ban' | 'activate';

const LIFECYCLE_TARGET_STATUS: Record<LifecycleVerb, UserStatus> = {
  suspend: 'suspended',
  ban: 'banned',
  activate: 'active'
};

const LIFECYCLE_AUDIT_ACTION: Record<LifecycleVerb, AdminAction> = {
  suspend: 'SUSPEND_USER',
  ban: 'BAN_USER',
  activate: 'ACTIVATE_USER'
};

/**
 * Shared body for the three status-mutating endpoints.
 */
async function applyLifecycle(
  verb: LifecycleVerb,
  req: AdminRequest,
  res: Response
): Promise<Response> {
  const adminId = req.userId;
  const targetUserId = req.params.userId;

  if (!adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }
  if (!targetUserId) {
    return res.status(400).json({ message: 'User ID is required' });
  }
  // Self-action prevention: an admin can lock themselves out by suspending or
  // banning their own account, and "activate self" is meaningless. Force the
  // admin to use a peer admin so there's always a second pair of eyes on the
  // mutation.
  if (adminId === targetUserId) {
    return res.status(400).json({
      message: 'Admins cannot change their own account status',
      code: 'CANNOT_MUTATE_SELF'
    });
  }

  const parsed = lifecycleBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid request',
      errors: parsed.error.flatten().fieldErrors
    });
  }
  const reason = parsed.data?.reason;
  const targetStatus = LIFECYCLE_TARGET_STATUS[verb];

  try {
    const user = await User.findById(targetUserId).select('role status auth.email profile.username');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const previousStatus: UserStatus = (user.status ?? 'active') as UserStatus;
    const wasAlreadyInState = previousStatus === targetStatus;

    // Bump tokenVersion + revoke refresh tokens only on transitions that
    // actually take privileges away (suspend, ban). Activate is recovery —
    // see the header comment for why we don't bump on it.
    const shouldRevokeSessions =
      !wasAlreadyInState && (verb === 'suspend' || verb === 'ban');

    const updateOp: Record<string, unknown> = { $set: { status: targetStatus } };
    if (shouldRevokeSessions) {
      updateOp.$inc = { tokenVersion: 1 };
    }

    const updatedUser = await User.findByIdAndUpdate(targetUserId, updateOp, {
      runValidators: true,
      new: true,
    }).select('tokenVersion');

    if (shouldRevokeSessions && updatedUser) {
      await upsertUserTokenVersionCache(targetUserId, updatedUser.tokenVersion ?? 0);
    }

    let sessionsRevoked = !shouldRevokeSessions;
    let revocationFailureReason: string | undefined;
    if (shouldRevokeSessions) {
      const revokeResult = await revokeAllRefreshTokensDetailed(targetUserId);
      sessionsRevoked = revokeResult.ok;
      if (!revokeResult.ok) {
        revocationFailureReason = revokeResult.reason;
        // Non-fatal for the status transition, but response/audit must be truthful.
        getLogger().warn({
          msg: '[Lifecycle] Failed to revoke refresh tokens after status change',
          targetUserId,
          verb,
          reason: revokeResult.reason,
        });
      }
    }

    const auditResult = await auditAdminAction(req, {
      action: LIFECYCLE_AUDIT_ACTION[verb],
      targetType: 'user',
      targetId: targetUserId,
      previousValue: { status: previousStatus },
      newValue: { status: targetStatus },
      reason,
      metadata: {
        targetEmail: user.auth?.email,
        targetUsername: user.profile?.username,
        wasAlreadyInState,
        sessionsRevoked,
        ...(revocationFailureReason ? { revocationFailureReason } : {})
      }
    });

    return res.json({
      message: wasAlreadyInState
        ? `User was already ${targetStatus}`
        : `User ${targetStatus}`,
      status: targetStatus,
      sessionsRevoked,
      ...(revocationFailureReason ? { revocationFailureReason } : {}),
      auditPersisted: auditResult.persisted
    });
  } catch (error) {
    getLogger().error({ err: error, adminId, targetUserId, verb }, 'Failed to change user status');
    return res.status(500).json({ message: `Failed to ${verb} user` });
  }
}

export async function suspendUser(req: AdminRequest, res: Response) {
  return applyLifecycle('suspend', req, res);
}

export async function banUser(req: AdminRequest, res: Response) {
  return applyLifecycle('ban', req, res);
}

export async function activateUser(req: AdminRequest, res: Response) {
  return applyLifecycle('activate', req, res);
}

/**
 * POST /api/admin/users/:userId/revoke-sessions
 *
 * Force-logs the user out everywhere by bumping tokenVersion (kills every
 * access token the next time it's presented, immediately when
 * ENFORCE_TOKEN_VERSION=true) and clearing every refresh token in Redis.
 * Status is unchanged — use suspend/ban to also block re-login.
 */
export async function revokeUserSessions(req: AdminRequest, res: Response) {
  const adminId = req.userId;
  const targetUserId = req.params.userId;

  if (!adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }
  if (!targetUserId) {
    return res.status(400).json({ message: 'User ID is required' });
  }
  if (adminId === targetUserId) {
    return res.status(400).json({
      message: 'Admins cannot revoke their own sessions through this endpoint',
      code: 'CANNOT_MUTATE_SELF'
    });
  }

  const parsed = lifecycleBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid request',
      errors: parsed.error.flatten().fieldErrors
    });
  }
  const reason = parsed.data?.reason;

  try {
    const user = await User.findByIdAndUpdate(
      targetUserId,
      { $inc: { tokenVersion: 1 } },
      { new: true }
    ).select('tokenVersion auth.email profile.username');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await upsertUserTokenVersionCache(targetUserId, user.tokenVersion ?? 0);

    const revokeResult = await revokeAllRefreshTokensDetailed(targetUserId);
    const sessionsRevoked = revokeResult.ok;
    if (!sessionsRevoked) {
      getLogger().warn({
        msg: '[Lifecycle] Failed to revoke refresh tokens during explicit revoke-sessions',
        targetUserId,
        reason: revokeResult.reason,
      });
    }

    const auditResult = await auditAdminAction(req, {
      action: 'REVOKE_SESSIONS',
      targetType: 'user',
      targetId: targetUserId,
      newValue: { tokenVersion: user.tokenVersion },
      reason,
      metadata: {
        targetEmail: user.auth?.email,
        targetUsername: user.profile?.username,
        refreshTokensRevoked: sessionsRevoked,
        ...(revokeResult.reason ? { revocationFailureReason: revokeResult.reason } : {})
      }
    });

    return res.json({
      message: 'Sessions revoked',
      tokenVersion: user.tokenVersion,
      refreshTokensRevoked: sessionsRevoked,
      ...(revokeResult.reason ? { revocationFailureReason: revokeResult.reason } : {}),
      auditPersisted: auditResult.persisted
    });
  } catch (error) {
    getLogger().error({ err: error, adminId, targetUserId }, 'Failed to revoke user sessions');
    return res.status(500).json({ message: 'Failed to revoke sessions' });
  }
}
