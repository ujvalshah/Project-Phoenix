import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { Article } from '../models/Article.js';
import { Report } from '../models/Report.js';
import { Feedback } from '../models/Feedback.js';
import { LRUCache } from '../utils/lruCache.js';
import { buildModerationQuery, getModerationStats } from '../services/moderationService.js';

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
        $group: {
          _id: null,
          total: { $sum: 1 },
          public: {
            $sum: { $cond: [{ $eq: ['$visibility', 'public'] }, 1, 0] }
          },
          private: {
            $sum: { $cond: [{ $eq: ['$visibility', 'private'] }, 1, 0] }
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
  const articleStatsRaw = articleAgg[0] || { total: 0, public: 0, private: 0 };
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


