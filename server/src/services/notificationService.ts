import { Queue, Worker, Job } from 'bullmq';
import webPush from 'web-push';
import { getLogger } from '../utils/logger.js';
import { getRedisClient, isRedisAvailable, getRedisClientOrFallback } from '../utils/redisClient.js';
import { PushSubscription, IPushSubscription } from '../models/PushSubscription.js';
import { Notification } from '../models/Notification.js';
import { NotificationDelivery } from '../models/NotificationDelivery.js';
import { User } from '../models/User.js';
import { Article, IArticle } from '../models/Article.js';
import { getTagNameMap } from '../utils/db.js';
import { getEnv } from '../config/envValidation.js';

const REDIS_KEY_NOTIFICATIONS_ENABLED = 'notifications:enabled';
const BATCH_SIZE = 100;

/** Same-origin paths; must match public/ assets and sw.js fallbacks. */
const DEFAULT_WEB_PUSH_ICON = '/icons/icon-192.png';
const DEFAULT_WEB_PUSH_BADGE = '/icons/badge-72.png';

/**
 * Insert many with ordered:false and recover insertedDocs on bulk errors.
 * Mongoose's default .catch swallows the array of successes that the bulk
 * error carries, which made the delivery ledger blind to any fan-out that
 * overlapped an existing dedupe key.
 */
async function safeInsertMany<T extends { _id: unknown }>(
  model: { insertMany: (d: unknown[], opts: unknown) => Promise<T[]> },
  docs: unknown[],
  label: string
): Promise<T[]> {
  if (docs.length === 0) return [];
  try {
    return (await model.insertMany(docs, { ordered: false })) as T[];
  } catch (err) {
    const logger = getLogger();
    const bulkErr = err as { insertedDocs?: T[]; message?: string; writeErrors?: unknown[] };
    const inserted = Array.isArray(bulkErr?.insertedDocs) ? bulkErr.insertedDocs : [];
    logger.warn({
      msg: `[Notifications] ${label} partial insert (dedupe conflicts preserved)`,
      inserted: inserted.length,
      total: docs.length,
      writeErrors: Array.isArray(bulkErr?.writeErrors) ? bulkErr.writeErrors.length : undefined,
      error: bulkErr?.message,
    });
    return inserted;
  }
}

/**
 * Parse HH:MM to minutes-since-midnight; return null on malformed input.
 */
function parseHHMM(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * Minutes-since-local-midnight for a timezone. Falls back to UTC on bad tz.
 */
function nowMinutesInZone(timezone: string | null | undefined): number {
  const tz = timezone || 'Etc/UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    // Intl sometimes emits "24" for hour in hour12:false — normalize.
    return ((hh % 24) * 60 + mm) | 0;
  } catch {
    const now = new Date();
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

/**
 * Is the user currently inside their configured quiet window? Windows that
 * wrap midnight (e.g. 22:00–07:00) are handled.
 */
function isInQuietHours(
  start: string | null | undefined,
  end: string | null | undefined,
  timezone: string | null | undefined
): boolean {
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s === null || e === null || s === e) return false;
  const now = nowMinutesInZone(timezone);
  return s < e ? now >= s && now < e : now >= s || now < e;
}

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
    icon: DEFAULT_WEB_PUSH_ICON,
    badge: DEFAULT_WEB_PUSH_BADGE,
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
    icon: DEFAULT_WEB_PUSH_ICON,
    badge: DEFAULT_WEB_PUSH_BADGE,
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
): Promise<{ success: boolean; removed: boolean; statusCode?: number; error?: string }> {
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
    await PushSubscription.updateOne(
      { _id: sub._id },
      { $set: { lastSuccessAt: new Date(), invalidatedReason: undefined, failureCount: 0 } }
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
      return { success: false, removed: true, statusCode, error: 'subscription_invalid' };
    }

    logger.error({
      msg: '[Notifications] Push send failed',
      endpoint: sub.endpoint.substring(0, 60),
      statusCode,
      error: error instanceof Error ? error.message : String(error),
    });
    await PushSubscription.updateOne(
      { _id: sub._id },
      { $inc: { failureCount: 1 } }
    );
    return {
      success: false,
      removed: false,
      statusCode,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function processFanOut(job: Job): Promise<void> {
  const logger = getLogger();
  const { articleId, publishEventId } = job.data as { articleId: string; publishEventId?: number };
  // Guarantee a publishEventId even for legacy enqueues that predate the field;
  // fall back to the job creation timestamp so dedupe keys remain unique per job.
  const eventId = publishEventId || job.timestamp || Date.now();

  const enabled = await isNotificationsEnabled();
  if (!enabled) {
    logger.info({ msg: '[Notifications] System disabled — skipping fan-out', articleId });
    return;
  }

  const article = await Article.findById(articleId).lean() as IArticle | null;
  const isPublished = article?.status === 'published' || article?.status === undefined || article?.status === null;
  if (!article || article.visibility !== 'public' || !isPublished) {
    logger.info({ msg: '[Notifications] Article not found or private — skipping', articleId });
    return;
  }

  const payload = buildPayload(article);
  const dedupeKey = `fanout:${articleId}:${eventId}`;

  // Find users who want instant notifications
  const instantUsers = await User.find({
    'preferences.notifications.pushEnabled': true,
    'preferences.notifications.frequency': 'instant',
  })
    .select('_id preferences.notifications.categoryFilter preferences.notifications.quietHoursStart preferences.notifications.quietHoursEnd preferences.notifications.timezone')
    .lean();

  if (instantUsers.length === 0) {
    logger.info({ msg: '[Notifications] No instant subscribers — skipping', articleId });
    return;
  }

  // Filter by category preference — resolve tagIds to names (P2-6)
  const tagNameMap = await getTagNameMap();
  const articleTagNames = (article.tagIds || [])
    .map((tid) => tagNameMap.get(tid.toString())?.toLowerCase())
    .filter(Boolean) as string[];

  // Build two sets: users eligible for in-app (passes category filter),
  // and users eligible for push (also outside quiet hours). Quiet hours must
  // not suppress the inbox — only the device alert.
  const inAppEligibleIds: string[] = [];
  const pushSuppressedForQuiet = new Set<string>();
  for (const user of instantUsers) {
    const prefs = user.preferences?.notifications;
    const catFilter = prefs?.categoryFilter || [];
    const passesCategory =
      catFilter.length === 0 ||
      catFilter.some((cat) => articleTagNames.includes(cat.toLowerCase()));
    if (!passesCategory) continue;
    const userId = user._id.toString();
    inAppEligibleIds.push(userId);
    if (
      isInQuietHours(
        prefs?.quietHoursStart,
        prefs?.quietHoursEnd,
        (prefs as { timezone?: string } | undefined)?.timezone
      )
    ) {
      pushSuppressedForQuiet.add(userId);
    }
  }

  if (inAppEligibleIds.length === 0) {
    logger.info({ msg: '[Notifications] No users match category filter — skipping', articleId });
    return;
  }

  const pushEligibleIds = inAppEligibleIds.filter((id) => !pushSuppressedForQuiet.has(id));

  // Get active push subscriptions for push-eligible users (quiet hours excluded)
  const subscriptions = pushEligibleIds.length
    ? ((await PushSubscription.find({
        userId: { $in: pushEligibleIds },
        active: true,
      }).lean()) as IPushSubscription[])
    : [];

  logger.info({
    msg: '[Notifications] Starting fan-out',
    articleId,
    eventId,
    inAppEligible: inAppEligibleIds.length,
    pushEligible: pushEligibleIds.length,
    quietSuppressed: pushSuppressedForQuiet.size,
    subscriptions: subscriptions.length,
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;
  const successfulUserIds = new Set<string>();
  const deliveryDocs: Array<Record<string, unknown>> = [];

  const batches = chunk(subscriptions, BATCH_SIZE);
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(sub => sendWebPushToSubscription(sub as IPushSubscription, payload))
    );

    for (const [idx, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        const currentSub = batch[idx] as IPushSubscription;
        if (result.value.success) {
          sent++;
          successfulUserIds.add(currentSub.userId.toString());
          deliveryDocs.push({
            userId: currentSub.userId.toString(),
            subscriptionId: currentSub._id.toString(),
            endpoint: currentSub.endpoint,
            channel: 'push',
            status: 'sent_to_provider',
            jobName: job.name,
            dedupeKey,
            attempt: (job.attemptsMade || 0) + 1,
            payloadType: payload.data.type,
          });
        } else if (result.value.removed) {
          removed++;
          deliveryDocs.push({
            userId: currentSub.userId.toString(),
            subscriptionId: currentSub._id.toString(),
            endpoint: currentSub.endpoint,
            channel: 'push',
            status: 'subscription_removed',
            jobName: job.name,
            dedupeKey,
            attempt: (job.attemptsMade || 0) + 1,
            providerStatusCode: result.value.statusCode,
            error: result.value.error,
            payloadType: payload.data.type,
          });
        } else {
          failed++;
          deliveryDocs.push({
            userId: currentSub.userId.toString(),
            subscriptionId: currentSub._id.toString(),
            endpoint: currentSub.endpoint,
            channel: 'push',
            status: 'provider_failed',
            jobName: job.name,
            dedupeKey,
            attempt: (job.attemptsMade || 0) + 1,
            providerStatusCode: result.value.statusCode,
            error: result.value.error,
            payloadType: payload.data.type,
          });
        }
      } else {
        failed++;
      }
    }
  }

  // Create in-app notifications for all category-eligible users. `attemptedVia`
  // reflects the channels we tried — 'push' means provider-acked, not delivered.
  const notificationDocs = inAppEligibleIds.map((userId) => ({
    userId,
    type: 'new_nugget' as const,
    title: payload.title,
    body: payload.body,
    data: { articleId, url: payload.url },
    read: false,
    dedupeKey: `${dedupeKey}:${userId}`,
    attemptedVia: successfulUserIds.has(userId) ? ['push', 'in_app'] : ['in_app'],
  }));

  const insertedNotifications = await safeInsertMany<{
    _id: { toString: () => string };
    userId: string;
  }>(Notification as unknown as Parameters<typeof safeInsertMany>[0], notificationDocs, 'in-app fan-out');

  for (const doc of insertedNotifications) {
    deliveryDocs.push({
      notificationId: doc._id.toString(),
      userId: doc.userId,
      channel: 'in_app',
      status: 'shown_in_app',
      jobName: job.name,
      dedupeKey,
      attempt: (job.attemptsMade || 0) + 1,
      payloadType: payload.data.type,
    });
  }

  if (deliveryDocs.length > 0) {
    await safeInsertMany(
      NotificationDelivery as unknown as Parameters<typeof safeInsertMany>[0],
      deliveryDocs,
      'delivery-ledger'
    );
  }

  logger.info({
    msg: '[Notifications] Fan-out complete',
    articleId,
    eventId,
    sent,
    failed,
    removed,
    inAppCreated: insertedNotifications.length,
    inAppAttempted: notificationDocs.length,
  });
}

async function processDailyDigest(job: Job): Promise<void> {
  const logger = getLogger();

  const enabled = await isNotificationsEnabled();
  if (!enabled) {
    logger.info({ msg: '[Notifications] System disabled — skipping digest' });
    return;
  }

  const lookbackHours = job.name === 'weekly-digest' ? 24 * 7 : 24;
  const oneDayAgo = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const recentArticles = await Article.find({
    publishedAt: { $gte: oneDayAgo },
    visibility: 'public',
    $or: [{ status: 'published' }, { status: { $exists: false } }, { status: null }],
  }).sort({ publishedAt: -1 }).lean() as IArticle[];

  if (recentArticles.length === 0) {
    logger.info({ msg: '[Notifications] No articles in last 24h — skipping digest' });
    return;
  }

  const digestUsers = await User.find({
    'preferences.notifications.pushEnabled': true,
    'preferences.notifications.frequency': job.name === 'weekly-digest' ? 'weekly' : 'daily',
  })
    .select('_id preferences.notifications.quietHoursStart preferences.notifications.quietHoursEnd preferences.notifications.timezone')
    .lean();

  if (digestUsers.length === 0) {
    logger.info({ msg: '[Notifications] No daily-digest subscribers' });
    return;
  }

  const payload = buildDigestPayload(recentArticles);
  const userIds = digestUsers.map((u) => u._id.toString());
  const pushSuppressedForQuiet = new Set<string>();
  for (const u of digestUsers) {
    const prefs = u.preferences?.notifications;
    if (
      isInQuietHours(
        prefs?.quietHoursStart,
        prefs?.quietHoursEnd,
        (prefs as { timezone?: string } | undefined)?.timezone
      )
    ) {
      pushSuppressedForQuiet.add(u._id.toString());
    }
  }
  const pushEligibleIds = userIds.filter((id) => !pushSuppressedForQuiet.has(id));

  const subscriptions = pushEligibleIds.length
    ? ((await PushSubscription.find({
        userId: { $in: pushEligibleIds },
        active: true,
      }).lean()) as IPushSubscription[])
    : [];

  let sent = 0;
  const dedupeKey = `${job.name}:${oneDayAgo}`;
  const successfulUserIds = new Set<string>();
  const deliveryDocs: Array<Record<string, unknown>> = [];
  const batches = chunk(subscriptions, BATCH_SIZE);
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map((sub) => sendWebPushToSubscription(sub as IPushSubscription, payload))
    );
    for (const [idx, r] of results.entries()) {
      const currentSub = batch[idx] as IPushSubscription;
      if (r.status === 'fulfilled' && r.value.success) {
        sent++;
        successfulUserIds.add(currentSub.userId.toString());
        deliveryDocs.push({
          userId: currentSub.userId.toString(),
          subscriptionId: currentSub._id.toString(),
          endpoint: currentSub.endpoint,
          channel: 'push',
          status: 'sent_to_provider',
          jobName: job.name,
          dedupeKey,
          attempt: (job.attemptsMade || 0) + 1,
          payloadType: payload.data.type,
        });
      }
    }
  }

  // Create in-app digest notifications for every digest subscriber, regardless
  // of quiet hours — the inbox stays accurate; only the device alert is gated.
  const notificationDocs = userIds.map((userId) => ({
    userId,
    type: 'digest' as const,
    title: payload.title,
    body: payload.body,
    data: {
      batchIds: recentArticles.map((a) => a._id.toString()),
      url: '/',
    },
    read: false,
    dedupeKey: `${dedupeKey}:${userId}`,
    attemptedVia: successfulUserIds.has(userId) ? ['push', 'in_app'] : ['in_app'],
  }));

  const insertedDigestDocs = await safeInsertMany<{
    _id: { toString: () => string };
    userId: string;
  }>(Notification as unknown as Parameters<typeof safeInsertMany>[0], notificationDocs, 'in-app digest');

  for (const doc of insertedDigestDocs) {
    deliveryDocs.push({
      notificationId: doc._id.toString(),
      userId: doc.userId,
      channel: 'in_app',
      status: 'shown_in_app',
      jobName: job.name,
      dedupeKey,
      attempt: (job.attemptsMade || 0) + 1,
      payloadType: payload.data.type,
    });
  }

  if (deliveryDocs.length > 0) {
    await safeInsertMany(
      NotificationDelivery as unknown as Parameters<typeof safeInsertMany>[0],
      deliveryDocs,
      'delivery-ledger-digest'
    );
  }

  logger.info({
    msg: '[Notifications] Daily digest complete',
    articles: recentArticles.length,
    users: userIds.length,
    pushSent: sent,
    quietSuppressed: pushSuppressedForQuiet.size,
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

  // One-shot index migration: drop the legacy endpoint-only unique index.
  // The schema now only enforces {userId, endpoint} unique, so account switching
  // on a shared browser no longer E11000s. Best-effort; ignore if missing.
  try {
    const indexes = await PushSubscription.collection.indexes();
    if (indexes.some((i) => i.name === 'endpoint_1' && (i as { unique?: boolean }).unique)) {
      await PushSubscription.collection.dropIndex('endpoint_1');
      logger.info({ msg: '[Notifications] Dropped legacy unique index endpoint_1' });
    }
  } catch (err) {
    logger.warn({
      msg: '[Notifications] endpoint_1 index migration skipped',
      error: err instanceof Error ? err.message : String(err),
    });
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

  // Schedule repeatable digest jobs.
  // Wrapped in try/catch with a timeout so a Redis outage cannot block server startup —
  // if the queue can't be reached, we log and continue; HTTP must come up regardless.
  const scheduleWithTimeout = async (name: string, opts: Parameters<typeof notificationQueue.add>[2]) => {
    const addPromise = notificationQueue!.add(name, {}, opts);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`BullMQ ${name} schedule timed out after 5s`)), 5000)
    );
    try {
      await Promise.race([addPromise, timeout]);
    } catch (err) {
      logger.warn({
        msg: '[Notifications] Failed to schedule repeatable job — continuing startup',
        job: name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  await scheduleWithTimeout('daily-digest', {
    repeat: { pattern: '0 8 * * *' },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  });

  await scheduleWithTimeout('weekly-digest', {
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
 * Called from Article model save/findOneAndUpdate hooks and from controllers
 * that mutate visibility via paths that skip Mongoose document hooks.
 *
 * `publishEventId` (caller-supplied ms timestamp) scopes idempotency to this
 * publish event, so a private→public→private→public toggle produces two
 * distinct fan-outs rather than colliding on a single article-scoped key.
 */
export async function onArticlePublished(
  articleId: string,
  publishEventId: number = Date.now()
): Promise<void> {
  const logger = getLogger();

  if (!notificationQueue) {
    logger.warn({ msg: '[Notifications] Queue not initialized — creating in-app fallback only', articleId });
    const article = (await Article.findById(articleId).lean()) as IArticle | null;
    const isPublished = article?.status === 'published' || article?.status === undefined || article?.status === null;
    if (!article || article.visibility !== 'public' || !isPublished) return;
    const payload = buildPayload(article);

    const instantUsers = await User.find({
      'preferences.notifications.pushEnabled': true,
      'preferences.notifications.frequency': 'instant',
    })
      .select('_id preferences.notifications.categoryFilter')
      .lean();
    if (instantUsers.length === 0) return;

    // Mirror the queued path's category filter so the fallback doesn't over-notify.
    const tagNameMap = await getTagNameMap();
    const articleTagNames = (article.tagIds || [])
      .map((tid) => tagNameMap.get(tid.toString())?.toLowerCase())
      .filter(Boolean) as string[];
    const eligibleIds = instantUsers
      .filter((u) => {
        const catFilter = u.preferences?.notifications?.categoryFilter || [];
        return (
          catFilter.length === 0 ||
          catFilter.some((cat) => articleTagNames.includes(cat.toLowerCase()))
        );
      })
      .map((u) => u._id.toString());

    if (eligibleIds.length === 0) return;

    await safeInsertMany(
      Notification as unknown as Parameters<typeof safeInsertMany>[0],
      eligibleIds.map((userId) => ({
        userId,
        type: 'new_nugget' as const,
        title: payload.title,
        body: payload.body,
        data: { articleId, url: payload.url },
        read: false,
        dedupeKey: `fanout:${articleId}:${publishEventId}:${userId}`,
        attemptedVia: ['in_app'],
      })),
      'in-app fallback (queue down)'
    );
    return;
  }

  try {
    await notificationQueue.add(
      'fan-out',
      { articleId, publishEventId },
      {
        jobId: `fanout:${articleId}:${publishEventId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      }
    );
    logger.info({ msg: '[Notifications] Fan-out job enqueued', articleId, publishEventId });
  } catch (error: unknown) {
    logger.error({
      msg: '[Notifications] Failed to enqueue fan-out job',
      articleId,
      publishEventId,
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

export function getNotificationRuntimeStatus(): {
  queueInitialized: boolean;
  vapidConfigured: boolean;
} {
  return {
    queueInitialized: notificationQueue !== null,
    vapidConfigured,
  };
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
