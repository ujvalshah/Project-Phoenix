/**
 * Diagnostics Routes
 * For debugging authentication and Redis issues
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { diagnoseRedisTokenStorage, verifyRefreshTokenExists } from '../utils/redisDiagnostics.js';
import { getRedisClientOrFallback, isRedisAvailable } from '../utils/redisClient.js';
import { createRequestLogger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/diagnostics/redis
 * Comprehensive Redis diagnostics (requires auth)
 */
router.get('/redis', authenticateToken, async (req: Request, res: Response) => {
  const logger = createRequestLogger((req as any).id || 'unknown', (req as any).user?.userId, req.path);
  
  try {
    const diagnostics = await diagnoseRedisTokenStorage();
    res.json({
      timestamp: new Date().toISOString(),
      diagnostics,
    });
  } catch (error: any) {
    logger.error({ msg: 'Diagnostics failed', err: { message: error.message } });
    res.status(500).json({ error: 'Diagnostics failed', message: error.message });
  }
});

/**
 * POST /api/diagnostics/verify-refresh-token
 * Verify if a refresh token exists in Redis (requires auth)
 */
router.post('/verify-refresh-token', authenticateToken, async (req: Request, res: Response) => {
  const logger = createRequestLogger((req as any).id || 'unknown', (req as any).user?.userId, req.path);
  const userId = (req as any).user?.userId;
  
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
  } catch (error: any) {
    logger.error({ msg: 'Token verification failed', err: { message: error.message } });
    res.status(500).json({ error: 'Verification failed', message: error.message });
  }
});

/**
 * GET /api/diagnostics/my-sessions
 * List all refresh tokens for current user (requires auth)
 */
router.get('/my-sessions', authenticateToken, async (req: Request, res: Response) => {
  const logger = createRequestLogger((req as any).id || 'unknown', (req as any).user?.userId, req.path);
  const userId = (req as any).user?.userId;
  
  try {
    if (!isRedisAvailable()) {
      return res.json({ sessions: [], message: 'Redis not available' });
    }

    const client = getRedisClientOrFallback();
    
    // Check if real Redis client (has sMembers method)
    if (!isRedisAvailable() || typeof (client as any).sMembers !== 'function') {
      return res.json({ 
        userId, 
        sessionCount: 0, 
        sessions: [],
        message: 'Real Redis client not available - sessions require actual Redis connection'
      });
    }
    
    const sessionKey = `sess:${userId}`;
    const tokenHashes = await (client as any).sMembers(sessionKey);
    
    const sessions = [];
    for (const hash of tokenHashes) {
      const key = `rt:${userId}:${hash}`;
      const dataStr = await (client as any).get(key);
      const ttl = await (client as any).ttl(key);
      
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
  } catch (error: any) {
    logger.error({ msg: 'Failed to get sessions', err: { message: error.message } });
    res.status(500).json({ error: 'Failed to get sessions', message: error.message });
  }
});

export default router;
