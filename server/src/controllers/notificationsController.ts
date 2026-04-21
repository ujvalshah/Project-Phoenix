import { Request, Response } from 'express';
import { z } from 'zod';
import { PushSubscription } from '../models/PushSubscription.js';
import { Notification } from '../models/Notification.js';
import { NotificationDelivery } from '../models/NotificationDelivery.js';
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

// ── Push Provider Allowlist ──
//
// We only accept endpoints whose host belongs to a known push provider.
// Without this, an attacker (or a misconfigured client) could register an
// arbitrary HTTPS URL that we'd then POST encrypted payloads to on every
// publish — turning our push pipeline into a free outbound webhook.
const PUSH_HOST_ALLOWLIST: Array<RegExp> = [
  /(^|\.)googleapis\.com$/i,           // FCM (Chrome/Edge/Brave)
  /(^|\.)mozilla\.com$/i,              // Firefox
  /(^|\.)push\.services\.mozilla\.com$/i,
  /(^|\.)push\.apple\.com$/i,          // Safari/iOS web push
  /(^|\.)windows\.com$/i,              // WNS
  /(^|\.)notify\.windows\.com$/i,
];

function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    return PUSH_HOST_ALLOWLIST.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

// ── Validation Schemas ──

const subscribeSchema = z
  .object({
    platform: z.enum(['web', 'android', 'ios']),
    endpoint: z.string().url(),
    keys: z
      .object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .optional(),
    fcmToken: z.string().min(1).optional(),
  })
  .refine(
    (data) => (data.platform === 'web' ? !!data.keys : true),
    { message: 'keys.p256dh and keys.auth are required for web push', path: ['keys'] }
  )
  .refine(
    (data) => (data.platform === 'android' ? !!data.fcmToken : true),
    { message: 'fcmToken is required for android', path: ['fcmToken'] }
  );

const renewSchema = z
  .object({
    platform: z.enum(['web', 'android', 'ios']),
    endpoint: z.string().url(),
    previousEndpoint: z.string().url(),
    keys: z
      .object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .optional(),
  })
  .refine((data) => (data.platform === 'web' ? !!data.keys : true), {
    message: 'keys.p256dh and keys.auth are required for web push',
    path: ['keys'],
  });

const preferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  frequency: z.enum(['instant', 'daily', 'weekly', 'none']).optional(),
  categoryFilter: z.array(z.string()).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  // IANA tz string (e.g. "Asia/Kolkata"). We validate via Intl so unknown
  // zones are rejected rather than silently stored and breaking quiet hours.
  timezone: z
    .string()
    .min(1)
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid IANA timezone')
    .optional(),
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

  if (platform === 'web' && !isAllowedPushEndpoint(endpoint)) {
    return sendValidationError(res, 'Endpoint host not allowed', [
      { path: ['endpoint'], message: 'Endpoint must be from a known push provider' },
    ]);
  }

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

// SW-driven renewal after `pushsubscriptionchange`. Unlike plain subscribe,
// this requires the SW to prove which subscription it's renewing — without a
// `previousEndpoint` ownership check, any authenticated caller could swap
// arbitrary endpoints onto the account by hitting this route.
export const renewSubscriptionFromServiceWorker = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return sendUnauthorizedError(res);

  const result = renewSchema.safeParse(req.body);
  if (!result.success) {
    return sendValidationError(
      res,
      'Invalid renewal payload',
      result.error.errors.map((e) => ({ path: e.path, message: e.message }))
    );
  }

  const { platform, endpoint, previousEndpoint, keys } = result.data;

  if (platform === 'web' && !isAllowedPushEndpoint(endpoint)) {
    return sendValidationError(res, 'Endpoint host not allowed', [
      { path: ['endpoint'], message: 'Endpoint must be from a known push provider' },
    ]);
  }

  // No-op renewals (browser handed back the same endpoint) shouldn't fail.
  if (endpoint === previousEndpoint) {
    try {
      await PushSubscription.updateOne(
        { userId, endpoint, active: true },
        { lastSeenAt: new Date(), keys }
      );
      return res.json({ message: 'Subscription unchanged' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return sendInternalError(res, msg);
    }
  }

  try {
    // Require that the previousEndpoint belongs to this user and was active.
    // Anything else is either drift, replay, or a forged renewal.
    const previous = await PushSubscription.findOne({
      userId,
      endpoint: previousEndpoint,
    });

    if (!previous) {
      return sendValidationError(res, 'Unknown previous endpoint', [
        { path: ['previousEndpoint'], message: 'No matching subscription for this user' },
      ]);
    }

    // Atomic-ish swap: write the new sub, then deactivate the old one. Order
    // matters — if the new write fails, the old record stays usable.
    await PushSubscription.findOneAndUpdate(
      { userId, endpoint },
      {
        userId,
        platform,
        endpoint,
        keys,
        active: true,
        invalidatedReason: undefined,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await PushSubscription.updateOne(
      { _id: previous._id },
      { active: false, invalidatedReason: 'rotated_by_pushsubscriptionchange' }
    );

    // Defense in depth: if the new endpoint also exists under another user
    // (rare — would require two users to land on the exact same token), drop
    // the duplicate.
    await PushSubscription.updateMany(
      { endpoint, userId: { $ne: userId }, active: true },
      { active: false, invalidatedReason: 'reassigned_to_another_user' }
    );

    res.json({ message: 'Subscription renewed' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
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
    if (data.timezone !== undefined) {
      update['preferences.notifications.timezone'] = data.timezone;
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

// Admin diagnostics: a fleet-wide health snapshot. Designed to answer the
// questions an on-caller actually has at 3am — "is push working at all,
// what's failing, and what just got removed?" — not the previous per-caller
// counts which were never meaningful at admin scope.
export const getNotificationDiagnostics = async (_req: Request, res: Response) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since1h = new Date(Date.now() - 60 * 60 * 1000);

    const [
      enabled,
      totalActiveSubscriptions,
      totalUsersSubscribed,
      subscriptionsByPlatform,
      providerFailures24h,
      providerFailures1h,
      stalenessRemovals24h,
      sentToProvider24h,
      shownInApp24h,
      recentFailures,
    ] = await Promise.all([
      getNotificationsEnabled(),
      PushSubscription.countDocuments({ active: true }),
      PushSubscription.distinct('userId', { active: true }).then((u) => u.length),
      PushSubscription.aggregate([
        { $match: { active: true } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
      NotificationDelivery.countDocuments({ status: 'provider_failed', createdAt: { $gte: since24h } }),
      NotificationDelivery.countDocuments({ status: 'provider_failed', createdAt: { $gte: since1h } }),
      NotificationDelivery.countDocuments({ status: 'subscription_removed', createdAt: { $gte: since24h } }),
      NotificationDelivery.countDocuments({ status: 'sent_to_provider', createdAt: { $gte: since24h } }),
      NotificationDelivery.countDocuments({ status: 'shown_in_app', createdAt: { $gte: since24h } }),
      NotificationDelivery.find({ status: 'provider_failed' })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('userId endpoint providerStatusCode error createdAt jobName')
        .lean(),
    ]);

    const runtime = getNotificationRuntimeStatus();

    const platformBreakdown = subscriptionsByPlatform.reduce<Record<string, number>>(
      (acc, row: { _id: string; count: number }) => {
        acc[row._id || 'unknown'] = row.count;
        return acc;
      },
      {}
    );

    res.json({
      enabled,
      runtime,
      fleet: {
        totalActiveSubscriptions,
        totalUsersSubscribed,
        subscriptionsByPlatform: platformBreakdown,
      },
      delivery24h: {
        sentToProvider: sentToProvider24h,
        shownInApp: shownInApp24h,
        providerFailures: providerFailures24h,
        subscriptionsRemoved: stalenessRemovals24h,
      },
      delivery1h: {
        providerFailures: providerFailures1h,
      },
      recentFailures,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendInternalError(res, msg);
  }
};
