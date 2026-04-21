import { Request, Response } from 'express';
import { z } from 'zod';
import { PushSubscription } from '../models/PushSubscription.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { getEnv } from '../config/envValidation.js';
import {
  setNotificationsEnabled,
  getNotificationsEnabled,
  getNotificationRuntimeStatus,
} from '../services/notificationService.js';
import {
  sendValidationError,
  sendUnauthorizedError,
  sendNotFoundError,
  sendInternalError,
} from '../utils/errorResponse.js';

// ── Validation Schemas ──

const subscribeSchema = z.object({
  platform: z.enum(['web', 'android', 'ios']),
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }).optional(),
  fcmToken: z.string().min(1).optional(),
});

const preferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  frequency: z.enum(['instant', 'daily', 'weekly', 'none']).optional(),
  categoryFilter: z.array(z.string()).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
});

const toggleSchema = z.object({
  enabled: z.boolean(),
});

// ── Helpers ──

function getUserId(req: Request): string | undefined {
  return (req as unknown as { user?: { userId?: string } }).user?.userId;
}

// ── Public Endpoints ──

export const getVapidKey = (req: Request, res: Response) => {
  const env = getEnv();
  const publicKey = env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return res.json({ configured: false, publicKey: null });
  }

  res.json({ configured: true, publicKey });
};

// ── Subscription Management ──

export const subscribe = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);

  const result = subscribeSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(
      res,
      'Invalid subscription data',
      result.error.errors.map(e => ({ path: e.path, message: e.message }))
    );
  }

  const { platform, endpoint, keys, fcmToken } = result.data;

  try {
    await PushSubscription.findOneAndUpdate(
      { userId, endpoint },
      {
        userId,
        platform,
        endpoint,
        keys,
        fcmToken,
        active: true,
        invalidatedReason: undefined,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Prevent endpoint ownership drift across accounts by deactivating any
    // duplicate endpoint records attached to other users.
    await PushSubscription.updateMany(
      { endpoint, userId: { $ne: userId }, active: true },
      { active: false, invalidatedReason: 'reassigned_to_another_user' }
    );

    // Mark pushEnabled in user preferences
    await User.findByIdAndUpdate(userId, {
      'preferences.notifications.pushEnabled': true,
    });

    res.status(201).json({ message: 'Subscription saved' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

export const renewSubscriptionFromServiceWorker = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);
  return subscribe(req, res);
};

export const unsubscribe = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);

  const { endpoint } = req.body;
  if (!endpoint || typeof endpoint !== 'string') {
    return sendValidationError(res, 'Endpoint is required', [
      { path: ['endpoint'], message: 'Must provide the subscription endpoint' },
    ]);
  }

  try {
    await PushSubscription.updateOne(
      { endpoint, userId },
      { active: false, invalidatedReason: 'user_unsubscribed' }
    );

    // If no more active subscriptions, disable push
    const remaining = await PushSubscription.countDocuments({ userId, active: true });
    if (remaining === 0) {
      await User.findByIdAndUpdate(userId, {
        'preferences.notifications.pushEnabled': false,
      });
    }

    res.json({ message: 'Subscription removed' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

export const getSubscriptionStatus = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);
  try {
    const count = await PushSubscription.countDocuments({ userId, active: true });
    res.json({ hasSubscription: count > 0, activeSubscriptions: count });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

// ── Notification Preferences ──

export const getPreferences = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);

  try {
    const user = await User.findById(userId).select('preferences.notifications').lean();
    if (!user) return sendNotFoundError(res, 'User not found');

    res.json(user.preferences?.notifications || {});
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

export const updatePreferences = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);

  const result = preferencesSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(
      res,
      'Invalid preferences',
      result.error.errors.map(e => ({ path: e.path, message: e.message }))
    );
  }

  try {
    const update: Record<string, unknown> = {};
    const data = result.data;

    if (data.pushEnabled !== undefined) {
      update['preferences.notifications.pushEnabled'] = data.pushEnabled;
    }
    if (data.frequency !== undefined) {
      update['preferences.notifications.frequency'] = data.frequency;
    }
    if (data.categoryFilter !== undefined) {
      update['preferences.notifications.categoryFilter'] = data.categoryFilter;
    }
    if (data.quietHoursStart !== undefined) {
      update['preferences.notifications.quietHoursStart'] = data.quietHoursStart;
    }
    if (data.quietHoursEnd !== undefined) {
      update['preferences.notifications.quietHoursEnd'] = data.quietHoursEnd;
    }

    const user = await User.findByIdAndUpdate(userId, update, { new: true })
      .select('preferences.notifications')
      .lean();

    if (!user) return sendNotFoundError(res, 'User not found');

    res.json(user.preferences?.notifications || {});
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

// ── In-App Notifications ──

export const listNotifications = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip = (page - 1) * limit;

  try {
    const [notifications, total] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId }),
    ]);

    res.json({
      data: notifications,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);

  try {
    const count = await Notification.countDocuments({ userId, read: false });
    res.json({ count });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { read: true },
      { new: true }
    ).lean();

    if (!notification) return sendNotFoundError(res, 'Notification not found');
    res.json(notification);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);

  try {
    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );
    res.json({ updated: result.modifiedCount });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

// ── Admin: Kill Switch ──

export const toggleNotifications = async (req: Request, res: Response) => {
  const result = toggleSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(
      res,
      'Invalid toggle value',
      result.error.errors.map(e => ({ path: e.path, message: e.message }))
    );
  }

  try {
    await setNotificationsEnabled(result.data.enabled);
    res.json({ enabled: result.data.enabled });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

export const getNotificationStatus = async (_req: Request, res: Response) => {
  try {
    const enabled = await getNotificationsEnabled();
    res.json({ enabled });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};

export const getNotificationDiagnostics = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);
  try {
    const [activeSubscriptions, unreadCount, enabled] = await Promise.all([
      PushSubscription.countDocuments({ userId, active: true }),
      Notification.countDocuments({ userId, read: false }),
      getNotificationsEnabled(),
    ]);
    const runtime = getNotificationRuntimeStatus();
    res.json({
      enabled,
      runtime,
      user: {
        activeSubscriptions,
        unreadCount,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};
