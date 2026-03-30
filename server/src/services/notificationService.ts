import { Queue, Worker, Job } from 'bullmq';
import webPush from 'web-push';
import { getLogger } from '../utils/logger.js';
import { getRedisClient, isRedisAvailable, getRedisClientOrFallback } from '../utils/redisClient.js';
import { PushSubscription, IPushSubscription } from '../models/PushSubscription.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Article, IArticle } from '../models/Article.js';
import { getEnv } from '../config/envValidation.js';

const REDIS_KEY_NOTIFICATIONS_ENABLED = 'notifications:enabled';
const BATCH_SIZE = 100;

let notificationQueue: Queue | null = null;
let notificationWorker: Worker | null = null;
let vapidConfigured = false;

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url: string;
  data: {
    articleId?: string;
    batchIds?: string[];
    type: string;
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function configureVapid(): boolean {
  const env = getEnv();
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    const logger = getLogger();
    logger.warn({ msg: '[Notifications] VAPID keys not configured — push notifications disabled' });
    return false;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function buildPayload(article: IArticle): NotificationPayload {
  const title = article.title || 'New Nugget';
  const body = article.excerpt || article.content?.substring(0, 120) || 'A new nugget has been published.';
  const articleId = article._id.toString();

  return {
    title,
    body: body.length > 120 ? body.substring(0, 117) + '...' : body,
    url: `/?openArticle=${articleId}`,
    data: {
      articleId,
      type: 'new_nugget',
    },
  };
}

function buildDigestPayload(articles: IArticle[]): NotificationPayload {
  const count = articles.length;
  return {
    title: `${count} new nugget${count === 1 ? '' : 's'} today`,
    body: articles.slice(0, 3).map(a => a.title || 'Untitled').join(', ') +
          (count > 3 ? ` and ${count - 3} more` : ''),
    url: '/',
    data: {
      batchIds: articles.map(a => a._id.toString()),
      type: 'digest',
    },
  };
}

async function isNotificationsEnabled(): Promise<boolean> {
  try {
    const redis = getRedisClientOrFallback();
    const value = await redis.get(REDIS_KEY_NOTIFICATIONS_ENABLED);
    // Enabled by default if key doesn't exist
    return value !== 'false';
  } catch {
    return true;
  }
}

async function sendWebPushToSubscription(
  sub: IPushSubscription,
  payload: NotificationPayload
): Promise<{ success: boolean; removed: boolean }> {
  const logger = getLogger();

  try {
    await webPush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys ? { p256dh: sub.keys.p256dh, auth: sub.keys.auth } : undefined,
      } as webPush.PushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        data: { ...payload.data, url: payload.url },
      })
    );
    return { success: true, removed: false };
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;

    // 410 Gone or 404: subscription expired or invalid
    if (statusCode === 410 || statusCode === 404) {
      logger.info({
        msg: '[Notifications] Removing dead subscription',
        endpoint: sub.endpoint.substring(0, 60),
        statusCode,
      });
      await PushSubscription.deleteOne({ _id: sub._id });
      return { success: false, removed: true };
    }

    logger.error({
      msg: '[Notifications] Push send failed',
      endpoint: sub.endpoint.substring(0, 60),
      statusCode,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, removed: false };
  }
}

async function processFanOut(job: Job): Promise<void> {
  const logger = getLogger();
  const { articleId } = job.data;

  const enabled = await isNotificationsEnabled();
  if (!enabled) {
    logger.info({ msg: '[Notifications] System disabled — skipping fan-out', articleId });
    return;
  }

  const article = await Article.findById(articleId).lean() as IArticle | null;
  if (!article || article.visibility !== 'public') {
    logger.info({ msg: '[Notifications] Article not found or private — skipping', articleId });
    return;
  }

  const payload = buildPayload(article);

  // Find users who want instant notifications
  const instantUsers = await User.find({
    'preferences.notifications.pushEnabled': true,
    'preferences.notifications.frequency': 'instant',
  }).select('_id preferences.notifications.categoryFilter').lean();

  if (instantUsers.length === 0) {
    logger.info({ msg: '[Notifications] No instant subscribers — skipping', articleId });
    return;
  }

  // Filter by category preference
  const articleTags = (article.tags || []).map(t => t.toLowerCase());
  const eligibleUserIds = instantUsers
    .filter(user => {
      const catFilter = user.preferences?.notifications?.categoryFilter || [];
      if (catFilter.length === 0) return true;
      return catFilter.some(cat => articleTags.includes(cat.toLowerCase()));
    })
    .map(user => user._id.toString());

  if (eligibleUserIds.length === 0) {
    logger.info({ msg: '[Notifications] No users match category filter — skipping', articleId });
    return;
  }

  // Get active push subscriptions for eligible users
  const subscriptions = await PushSubscription.find({
    userId: { $in: eligibleUserIds },
    active: true,
  }).lean() as IPushSubscription[];

  logger.info({
    msg: '[Notifications] Starting fan-out',
    articleId,
    eligibleUsers: eligibleUserIds.length,
    subscriptions: subscriptions.length,
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;

  const batches = chunk(subscriptions, BATCH_SIZE);
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(sub => sendWebPushToSubscription(sub as IPushSubscription, payload))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) sent++;
        else if (result.value.removed) removed++;
        else failed++;
      } else {
        failed++;
      }
    }
  }

  // Create in-app notifications for all eligible users
  const notificationDocs = eligibleUserIds.map(userId => ({
    userId,
    type: 'new_nugget' as const,
    title: payload.title,
    body: payload.body,
    data: { articleId, url: payload.url },
    read: false,
    deliveredVia: ['push', 'in_app'],
  }));

  if (notificationDocs.length > 0) {
    await Notification.insertMany(notificationDocs, { ordered: false }).catch(err => {
      logger.error({ msg: '[Notifications] Failed to insert in-app notifications', error: err.message });
    });
  }

  logger.info({
    msg: '[Notifications] Fan-out complete',
    articleId,
    sent,
    failed,
    removed,
    inAppCreated: notificationDocs.length,
  });
}

async function processDailyDigest(job: Job): Promise<void> {
  const logger = getLogger();

  const enabled = await isNotificationsEnabled();
  if (!enabled) {
    logger.info({ msg: '[Notifications] System disabled — skipping digest' });
    return;
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentArticles = await Article.find({
    publishedAt: { $gte: oneDayAgo },
    visibility: 'public',
  }).sort({ publishedAt: -1 }).lean() as IArticle[];

  if (recentArticles.length === 0) {
    logger.info({ msg: '[Notifications] No articles in last 24h — skipping digest' });
    return;
  }

  const digestUsers = await User.find({
    'preferences.notifications.pushEnabled': true,
    'preferences.notifications.frequency': 'daily',
  }).select('_id').lean();

  if (digestUsers.length === 0) {
    logger.info({ msg: '[Notifications] No daily-digest subscribers' });
    return;
  }

  const payload = buildDigestPayload(recentArticles);
  const userIds = digestUsers.map(u => u._id.toString());

  const subscriptions = await PushSubscription.find({
    userId: { $in: userIds },
    active: true,
  }).lean() as IPushSubscription[];

  let sent = 0;
  const batches = chunk(subscriptions, BATCH_SIZE);
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(sub => sendWebPushToSubscription(sub as IPushSubscription, payload))
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.success) sent++;
    }
  }

  // Create in-app digest notifications
  const notificationDocs = userIds.map(userId => ({
    userId,
    type: 'digest' as const,
    title: payload.title,
    body: payload.body,
    data: {
      batchIds: recentArticles.map(a => a._id.toString()),
      url: '/',
    },
    read: false,
    deliveredVia: ['push', 'in_app'],
  }));

  if (notificationDocs.length > 0) {
    await Notification.insertMany(notificationDocs, { ordered: false }).catch(err => {
      logger.error({ msg: '[Notifications] Failed to insert digest notifications', error: err.message });
    });
  }

  logger.info({
    msg: '[Notifications] Daily digest complete',
    articles: recentArticles.length,
    users: userIds.length,
    pushSent: sent,
  });
}

/**
 * Initialize the BullMQ notification queue and worker.
 * Must be called after Redis is initialized.
 */
export async function initNotificationService(): Promise<void> {
  const logger = getLogger();

  vapidConfigured = configureVapid();
  if (!vapidConfigured) {
    logger.warn({ msg: '[Notifications] Service starting without VAPID — push delivery disabled' });
  }

  // BullMQ needs the raw ioredis-compatible connection.
  // Respect USE_LOCAL_REDIS flag — same priority as redisClient.ts
  let redisUrl: string | null;
  if (process.env.USE_LOCAL_REDIS === 'true') {
    redisUrl = process.env.REDIS_LOCAL_URL || 'redis://localhost:6379';
  } else if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
    redisUrl = 'redis://localhost:6379';
  } else {
    redisUrl = process.env.REDIS_URL || process.env.REDIS_LOCAL_URL || null;
  }

  // Skip BullMQ initialization if no Redis is available
  if (!redisUrl) {
    logger.warn({ msg: '[Notifications] No Redis URL configured — queue-based notifications disabled' });
    return;
  }

  let connectionConfig: { host: string; port: number; password?: string; tls?: object };

  try {
    const url = new URL(redisUrl);
    connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    };
  } catch {
    connectionConfig = { host: 'localhost', port: 6379 };
  }

  notificationQueue = new Queue('notifications', { connection: connectionConfig });

  notificationWorker = new Worker(
    'notifications',
    async (job: Job) => {
      if (job.name === 'fan-out') {
        await processFanOut(job);
      } else if (job.name === 'daily-digest') {
        await processDailyDigest(job);
      } else if (job.name === 'weekly-digest') {
        // Weekly uses the same logic but queries 7 days
        await processDailyDigest(job);
      }
    },
    {
      connection: connectionConfig,
      concurrency: 3,
    }
  );

  notificationWorker.on('failed', (job, err) => {
    logger.error({
      msg: '[Notifications] Job failed',
      jobId: job?.id,
      jobName: job?.name,
      error: err.message,
    });
  });

  notificationWorker.on('completed', (job) => {
    logger.debug({
      msg: '[Notifications] Job completed',
      jobId: job.id,
      jobName: job.name,
    });
  });

  // Schedule repeatable digest jobs
  await notificationQueue.add('daily-digest', {}, {
    repeat: { pattern: '0 8 * * *' },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  });

  await notificationQueue.add('weekly-digest', {}, {
    repeat: { pattern: '0 8 * * 0' },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  });

  // Default kill switch to enabled
  try {
    const redis = getRedisClientOrFallback();
    const current = await redis.get(REDIS_KEY_NOTIFICATIONS_ENABLED);
    if (current === null) {
      await redis.set(REDIS_KEY_NOTIFICATIONS_ENABLED, 'true');
    }
  } catch {
    // Non-critical — will default to enabled
  }

  logger.info({
    msg: '[Notifications] Service initialized',
    vapid: vapidConfigured,
    queue: 'notifications',
  });
}

/**
 * Enqueue a push notification fan-out for a newly published article.
 * Called from Mongoose post-save hook on Article.
 */
export async function onArticlePublished(articleId: string): Promise<void> {
  const logger = getLogger();

  if (!notificationQueue) {
    logger.warn({ msg: '[Notifications] Queue not initialized — skipping', articleId });
    return;
  }

  if (!vapidConfigured) {
    logger.debug({ msg: '[Notifications] VAPID not configured — skipping push', articleId });
    return;
  }

  try {
    await notificationQueue.add('fan-out', { articleId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    });
    logger.info({ msg: '[Notifications] Fan-out job enqueued', articleId });
  } catch (error: unknown) {
    logger.error({
      msg: '[Notifications] Failed to enqueue fan-out job',
      articleId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Toggle notification system on/off via Redis flag.
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  const redis = getRedisClientOrFallback();
  await redis.set(REDIS_KEY_NOTIFICATIONS_ENABLED, enabled ? 'true' : 'false');
}

/**
 * Get notification system status.
 */
export async function getNotificationsEnabled(): Promise<boolean> {
  return isNotificationsEnabled();
}

/**
 * Gracefully close queue and worker.
 */
export async function closeNotificationService(): Promise<void> {
  const logger = getLogger();
  try {
    if (notificationWorker) {
      await notificationWorker.close();
      notificationWorker = null;
    }
    if (notificationQueue) {
      await notificationQueue.close();
      notificationQueue = null;
    }
    logger.info({ msg: '[Notifications] Service closed' });
  } catch (error: unknown) {
    logger.error({
      msg: '[Notifications] Error closing service',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
