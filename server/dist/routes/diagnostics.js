/**
 * Diagnostics Routes
 * For debugging authentication and Redis issues
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { diagnoseRedisTokenStorage, verifyRefreshTokenExists } from '../utils/redisDiagnostics.js';
import { getRedisClientOrFallback, isRedisAvailable } from '../utils/redisClient.js';
import { createRequestLogger } from '../utils/logger.js';
import { snapshotAppCounters } from '../utils/metrics.js';
import { countApiResponseCacheRedisKeysByPrefix } from '../utils/cacheRedisKeyStats.js';
const router = Router();
/**
 * GET /api/diagnostics/cache-stats
 * API response Redis key counts + in-process counters (hits/misses, public-read observations).
 */
router.get('/cache-stats', authenticateToken, async (req, res) => {
    const logger = createRequestLogger(req.id || 'unknown', req.user?.userId, req.path);
    try {
        const allCounters = snapshotAppCounters();
        const cacheCounters = {};
        for (const [k, v] of Object.entries(allCounters)) {
            if (k.includes('api_response_cache') || k.includes('public_read_cache')) {
                cacheCounters[k] = v;
            }
        }
        let redisCounts;
        let scanMethod;
        try {
            const scanned = await countApiResponseCacheRedisKeysByPrefix();
            redisCounts = scanned.byPrefix;
            scanMethod = scanned.method;
        }
        catch (scanError) {
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
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ msg: '[Diagnostics] cache-stats failed', err: { message: msg } });
        res.status(500).json({ error: 'cache-stats failed', message: msg });
    }
});
/**
 * GET /api/diagnostics/redis
 * Comprehensive Redis diagnostics (requires auth)
 */
router.get('/redis', authenticateToken, async (req, res) => {
    const logger = createRequestLogger(req.id || 'unknown', req.user?.userId, req.path);
    try {
        const diagnostics = await diagnoseRedisTokenStorage();
        res.json({
            timestamp: new Date().toISOString(),
            diagnostics,
        });
    }
    catch (error) {
        logger.error({ msg: 'Diagnostics failed', err: { message: error.message } });
        res.status(500).json({ error: 'Diagnostics failed', message: error.message });
    }
});
/**
 * POST /api/diagnostics/verify-refresh-token
 * Verify if a refresh token exists in Redis (requires auth)
 */
router.post('/verify-refresh-token', authenticateToken, async (req, res) => {
    const logger = createRequestLogger(req.id || 'unknown', req.user?.userId, req.path);
    const userId = req.user?.userId;
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
    }
    catch (error) {
        logger.error({ msg: 'Token verification failed', err: { message: error.message } });
        res.status(500).json({ error: 'Verification failed', message: error.message });
    }
});
/**
 * GET /api/diagnostics/my-sessions
 * List all refresh tokens for current user (requires auth)
 */
router.get('/my-sessions', authenticateToken, async (req, res) => {
    const logger = createRequestLogger(req.id || 'unknown', req.user?.userId, req.path);
    const userId = req.user?.userId;
    try {
        if (!isRedisAvailable()) {
            return res.json({ sessions: [], message: 'Redis not available' });
        }
        const client = getRedisClientOrFallback();
        // Check if real Redis client (has sMembers method)
        if (!isRedisAvailable() || typeof client.sMembers !== 'function') {
            return res.json({
                userId,
                sessionCount: 0,
                sessions: [],
                message: 'Real Redis client not available - sessions require actual Redis connection'
            });
        }
        const sessionKey = `sess:${userId}`;
        const tokenHashes = await client.sMembers(sessionKey);
        const sessions = [];
        for (const hash of tokenHashes) {
            const key = `rt:${userId}:${hash}`;
            const dataStr = await client.get(key);
            const ttl = await client.ttl(key);
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
    }
    catch (error) {
        logger.error({ msg: 'Failed to get sessions', err: { message: error.message } });
        res.status(500).json({ error: 'Failed to get sessions', message: error.message });
    }
});
export default router;
//# sourceMappingURL=diagnostics.js.map