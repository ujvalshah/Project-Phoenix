/**
 * Diagnostics Routes
 * For debugging authentication and Redis issues
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { diagnoseRedisTokenStorage, verifyRefreshTokenExists } from '../utils/redisDiagnostics.js';
import { getRedisClientOrFallback, isRedisAvailable } from '../utils/redisClient.js';
import { createRequestLogger } from '../utils/logger.js';
import { snapshotAppCounters } from '../utils/metrics.js';
import { countApiResponseCacheRedisKeysByPrefix } from '../utils/cacheRedisKeyStats.js';

type RequestWithAuthContext = Request & {
  id?: string;
  user?: { userId?: string };
};

function getRequestId(req: Request): string {
  const id = (req as RequestWithAuthContext).id;
  return typeof id === 'string' && id.length > 0 ? id : 'unknown';
}

function getRequestUserId(req: Request): string | undefined {
  const id = (req as RequestWithAuthContext).user?.userId;
  return typeof id === 'string' ? id : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Narrow Redis client shape used by my-sessions (ioredis-compatible subset). */
interface RedisSessionClient {
  sMembers(key: string): Promise<string[]>;
  get(key: string): Promise<string | null>;
  ttl(key: string): Promise<number>;
}

function asRedisSessionClient(client: unknown): RedisSessionClient | null {
  if (typeof client !== 'object' || client === null) return null;
  const o = client as Record<string, unknown>;
  if (typeof o.sMembers !== 'function' || typeof o.get !== 'function' || typeof o.ttl !== 'function') {
    return null;
  }
  return client as RedisSessionClient;
}

const router = Router();

/**
 * GET /api/diagnostics/cache-stats
 * API response Redis key counts + in-process counters (hits/misses, public-read observations).
 */
router.get('/cache-stats', authenticateToken, async (req: Request, res: Response) => {
  const logger = createRequestLogger(getRequestId(req), getRequestUserId(req), req.path);

  try {
    const allCounters = snapshotAppCounters();
    const cacheCounters: Record<string, number> = {};
    for (const [k, v] of Object.entries(allCounters)) {
      if (k.includes('api_response_cache') || k.includes('public_read_cache')) {
        cacheCounters[k] = v;
      }
    }

    let redisCounts: Record<string, number>;
    let scanMethod: 'scan' | 'keys' | 'unavailable';

    try {
      const scanned = await countApiResponseCacheRedisKeysByPrefix();
      redisCounts = scanned.byPrefix;
      scanMethod = scanned.method;
    } catch (scanError: unknown) {
      const msg = scanError instanceof Error ? scanError.message : String(scanError);
      logger.warn({ msg: '[Diagnostics] Redis cache key scan failed', error: msg });
      redisCounts = {};
      scanMethod = 'unavailable';
    }

    res.json({
      timestamp: new Date().toISOString(),
      redis: {
        tierAvailable: isRedisAvailable(),
        keyCountsByNamespacePrefix: redisCounts,
        scanMethod,
      },
      counters: cacheCounters,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error({ msg: '[Diagnostics] cache-stats failed', err: { message: msg } });
    res.status(500).json({ error: 'cache-stats failed', message: msg });
  }
});

/**
 * GET /api/diagnostics/redis
 * Comprehensive Redis diagnostics (requires auth)
 */
router.get('/redis', authenticateToken, async (req: Request, res: Response) => {
  const logger = createRequestLogger(getRequestId(req), getRequestUserId(req), req.path);

  try {
    const diagnostics = await diagnoseRedisTokenStorage();
    res.json({
      timestamp: new Date().toISOString(),
      diagnostics,
    });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    logger.error({ msg: 'Diagnostics failed', err: { message: msg } });
    res.status(500).json({ error: 'Diagnostics failed', message: msg });
  }
});

/**
 * POST /api/diagnostics/verify-refresh-token
 * Verify if a refresh token exists in Redis (requires auth)
 */
router.post('/verify-refresh-token', authenticateToken, async (req: Request, res: Response) => {
  const logger = createRequestLogger(getRequestId(req), getRequestUserId(req), req.path);
  const userId = getRequestUserId(req);

  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const verification = await verifyRefreshTokenExists(userId, refreshToken);
    res.json({
      timestamp: new Date().toISOString(),
      userId,
      verification,
    });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    logger.error({ msg: 'Token verification failed', err: { message: msg } });
    res.status(500).json({ error: 'Verification failed', message: msg });
  }
});

/**
 * GET /api/diagnostics/my-sessions
 * List all refresh tokens for current user (requires auth)
 */
router.get('/my-sessions', authenticateToken, async (req: Request, res: Response) => {
  const logger = createRequestLogger(getRequestId(req), getRequestUserId(req), req.path);
  const userId = getRequestUserId(req);

  try {
    if (!isRedisAvailable()) {
      return res.json({ sessions: [], message: 'Redis not available' });
    }

    const client = getRedisClientOrFallback();

    // Check if real Redis client (has sMembers method)
    const redis = asRedisSessionClient(client);
    if (!isRedisAvailable() || !redis) {
      return res.json({
        userId,
        sessionCount: 0,
        sessions: [],
        message: 'Real Redis client not available - sessions require actual Redis connection',
      });
    }

    const sessionKey = `sess:${userId}`;
    const tokenHashes = await redis.sMembers(sessionKey);

    const sessions = [];
    for (const hash of tokenHashes) {
      const key = `rt:${userId}:${hash}`;
      const dataStr = await redis.get(key);
      const ttl = await redis.ttl(key);
      
      if (dataStr) {
        const data = JSON.parse(dataStr);
        sessions.push({
          tokenHash: hash.substring(0, 8) + '...',
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          deviceInfo: data.deviceInfo,
          ipAddress: data.ipAddress,
          ttlSeconds: ttl,
          isExpired: ttl === -2,
        });
      }
    }

    res.json({
      userId,
      sessionCount: sessions.length,
      sessions,
    });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    logger.error({ msg: 'Failed to get sessions', err: { message: msg } });
    res.status(500).json({ error: 'Failed to get sessions', message: msg });
  }
});

export default router;
