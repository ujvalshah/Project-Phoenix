/**
 * Token Service - Redis-based token management
 *
 * Handles:
 * - Token blacklisting (logout)
 * - Refresh token storage
 * - Account lockout tracking
 * - Session management
 */

import crypto from 'crypto';
import { getLogger } from '../utils/logger.js';
import {
  getRedisClientOrFallback,
  isRedisAvailable,
  initRedisClient,
  ensureRedisConnection,
} from '../utils/redisClient.js';

/**
 * Error thrown when Redis is unavailable for a critical operation.
 * Callers should catch this and return 503 (Service Unavailable), NOT 401 (Unauthorized).
 * This prevents the frontend from misinterpreting a Redis outage as an invalid token.
 */
export class RedisUnavailableError extends Error {
  constructor(message = 'Redis service unavailable') {
    super(message);
    this.name = 'RedisUnavailableError';
  }
}

// Redis key prefixes
const PREFIX = {
  BLACKLIST: 'bl:',           // Blacklisted access tokens
  REFRESH: 'rt:',             // Refresh tokens by userId
  LOCKOUT: 'lock:',           // Account lockout counters
  LOCKOUT_TIME: 'locktime:',  // Lockout timestamp
  SESSION: 'sess:',           // Active sessions per user
} as const;

// Configuration
const CONFIG = {
  // Access token blacklist TTL (should match access token expiry)
  ACCESS_TOKEN_TTL: 15 * 60, // 15 minutes

  // Refresh token TTL
  REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60, // 7 days

  // Account lockout settings
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60, // 15 minutes
  FAILED_ATTEMPT_WINDOW: 15 * 60, // 15 minutes

  // Max concurrent sessions per user
  MAX_SESSIONS_PER_USER: 5,
} as const;

/**
 * Get Redis client (shared or in-memory fallback)
 */
function getClient() {
  return getRedisClientOrFallback();
}

/**
 * Initialize Token Service (uses shared Redis client)
 * Note: Redis client is initialized in server/src/index.ts
 * This function just verifies the service is ready
 */
export async function initTokenService(): Promise<void> {
  const logger = getLogger();
  // Redis client is already initialized in index.ts, no need to call initRedisClient() again
  // This prevents double initialization and multiple connection attempts
  logger.info({ msg: '[TokenService] Initialized (using shared Redis client)' });
}

/**
 * Check if Redis is available
 */
export function isTokenServiceAvailable(): boolean {
  return isRedisAvailable();
}

// ============================================================================
// TOKEN BLACKLISTING (for logout)
// ============================================================================

/**
 * Hash a token for storage (don't store raw JWTs in Redis)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Blacklist an access token (called on logout)
 * Token will be rejected until it naturally expires
 */
export async function blacklistToken(token: string, expiresInSeconds: number): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const client = getClient();
    const tokenHash = hashToken(token);
    // Store with TTL matching the token's remaining lifetime
    await client.setEx(
      `${PREFIX.BLACKLIST}${tokenHash}`,
      Math.max(1, expiresInSeconds),
      '1'
    );
    return true;
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to blacklist token', err: { message: error.message } });
    return false;
  }
}

/**
 * Check if a token is blacklisted
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false; // If Redis unavailable, allow token (fail open for availability)
  }

  try {
    const client = getClient();
    const tokenHash = hashToken(token);
    const result = await client.get(`${PREFIX.BLACKLIST}${tokenHash}`);
    return result !== null;
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to check blacklist', err: { message: error.message } });
    return false; // Fail open
  }
}

// ============================================================================
// REFRESH TOKEN MANAGEMENT
// ============================================================================

export interface RefreshTokenData {
  tokenHash: string;
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Generate a cryptographically secure refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('base64url');
}

/**
 * Store a refresh token for a user
 * OPTIMIZED: Uses Redis pipeline to reduce round trips from 4+ to 1
 */
/**
 * Store a refresh token for a user
 * OPTIMIZED: Uses Redis pipeline to reduce round trips from 4+ to 1
 * CRITICAL: Verifies TTL is set correctly after storage
 */
export async function storeRefreshToken(
  userId: string,
  refreshToken: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<boolean> {
  const connected = await ensureRedisConnection();
  if (!connected) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Redis unavailable - cannot store refresh token', userId });
    return false;
  }

  const logger = getLogger();
  try {
    const client = getClient();
    const tokenHash = hashToken(refreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONFIG.REFRESH_TOKEN_TTL * 1000);

    const data: RefreshTokenData = {
      tokenHash,
      userId,
      deviceInfo,
      ipAddress,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const refreshKey = `${PREFIX.REFRESH}${userId}:${tokenHash}`;
    const sessionKey = `${PREFIX.SESSION}${userId}`;

    // OPTIMIZATION: Use pipeline to batch operations (reduces from 4+ calls to 1)
    if (client.pipeline) {
      const pipeline = client.pipeline();
      pipeline.setEx(refreshKey, CONFIG.REFRESH_TOKEN_TTL, JSON.stringify(data));
      pipeline.sAdd(sessionKey, tokenHash);
      pipeline.expire(sessionKey, CONFIG.REFRESH_TOKEN_TTL);
      pipeline.sMembers(sessionKey); // Get sessions to check limit
      
      const results = await pipeline.exec();
      
      // CRITICAL FIX: Validate pipeline results - pipelines are NOT atomic
      // If any command fails, we need to know about it
      if (!results || results.length !== 4) {
        logger.error({ 
          msg: '[TokenService] CRITICAL: Pipeline execution incomplete', 
          userId,
          expectedCommands: 4,
          actualResults: results?.length || 0
        });
        return false;
      }
      
      // Check each result for errors
      for (let i = 0; i < results.length; i++) {
        if (results[i] instanceof Error) {
          logger.error({ 
            msg: '[TokenService] CRITICAL: Pipeline command failed', 
            userId,
            commandIndex: i,
            error: results[i].message
          });
          return false;
        }
      }
      
      const sessions = results[3] as string[] || [];
      
      // Enforce max sessions (remove oldest if exceeded)
      if (sessions.length > CONFIG.MAX_SESSIONS_PER_USER) {
        const sessionsToRemove = sessions.slice(0, sessions.length - CONFIG.MAX_SESSIONS_PER_USER);
        const cleanupPipeline = client.pipeline();
        for (const oldHash of sessionsToRemove) {
          cleanupPipeline.del(`${PREFIX.REFRESH}${userId}:${oldHash}`);
          cleanupPipeline.sRem(sessionKey, oldHash);
        }
        await cleanupPipeline.exec();
      }
    } else {
      // Fallback for in-memory client
      await client.setEx(refreshKey, CONFIG.REFRESH_TOKEN_TTL, JSON.stringify(data));
      await client.sAdd(sessionKey, tokenHash);
      await client.expire(sessionKey, CONFIG.REFRESH_TOKEN_TTL);
      
      const sessions = await client.sMembers(sessionKey);
      if (sessions.length > CONFIG.MAX_SESSIONS_PER_USER) {
        const sessionsToRemove = sessions.slice(0, sessions.length - CONFIG.MAX_SESSIONS_PER_USER);
        for (const oldHash of sessionsToRemove) {
          await client.del(`${PREFIX.REFRESH}${userId}:${oldHash}`);
          await client.sRem(sessionKey, oldHash);
        }
      }
    }

    // CRITICAL: Verify TTL was actually set
    const actualTtl = await client.ttl(refreshKey);
    if (actualTtl === -1) {
      logger.error({ 
        msg: '[TokenService] CRITICAL: TTL not set on refresh token - fixing immediately', 
        userId, 
        key: refreshKey 
      });
      // Fix it immediately
      await client.expire(refreshKey, CONFIG.REFRESH_TOKEN_TTL);
      const fixedTtl = await client.ttl(refreshKey);
      if (fixedTtl === -1) {
        logger.error({ msg: '[TokenService] Failed to set TTL even after retry', userId });
        return false;
      }
    } else if (actualTtl === -2) {
      logger.error({ msg: '[TokenService] CRITICAL: Refresh token not found after storage', userId });
      return false;
    }

    logger.debug({ 
      msg: '[TokenService] Refresh token stored successfully', 
      userId, 
      ttl: actualTtl,
      expectedTtl: CONFIG.REFRESH_TOKEN_TTL
    });

    return true;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({
      msg: '[TokenService] Failed to store refresh token',
      err: { message: errMsg },
      userId
    });
    return false;
  }
}

/**
 * Validate and retrieve refresh token data
 */
export async function validateRefreshToken(
  userId: string,
  refreshToken: string
): Promise<RefreshTokenData | null> {
  const logger = getLogger();

  // Try to ensure Redis connection, throw if unavailable
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.error({
      msg: '[TokenService] Redis unavailable for token validation',
      userId
    });
    throw new RedisUnavailableError('Redis unavailable for token validation');
  }

  try {
    const client = getClient();

    // Verify connection with ping before critical validation operation
    if (typeof (client as any).ping === 'function') {
      try {
        await (client as any).ping();
      } catch (pingError: unknown) {
        const pingMsg = pingError instanceof Error ? pingError.message : String(pingError);
        logger.error({
          msg: '[TokenService] Redis connection lost during validation ping',
          err: { message: pingMsg },
          userId
        });
        throw new RedisUnavailableError('Redis connection lost during validation');
      }
    }

    const tokenHash = hashToken(refreshToken);
    const key = `${PREFIX.REFRESH}${userId}:${tokenHash}`;
    const dataStr = await client.get(key);

    if (!dataStr) {
      logger.debug({ msg: '[TokenService] Refresh token not found in Redis', userId });
      return null; // Token not found (legitimate - distinct from error)
    }

    const data: RefreshTokenData = JSON.parse(dataStr);

    // Verify expiration
    if (new Date(data.expiresAt) < new Date()) {
      await client.del(key);
      logger.debug({ msg: '[TokenService] Refresh token expired in Redis', userId });
      return null; // Token expired
    }

    return data;
  } catch (error: unknown) {
    // Re-throw RedisUnavailableError as-is (already a typed error for callers)
    if (error instanceof RedisUnavailableError) {
      throw error;
    }

    const errMsg = error instanceof Error ? error.message : String(error);

    // Check for connection-related errors and wrap them
    const isConnectionError =
      errMsg.includes('Connection') ||
      errMsg.includes('ECONNREFUSED') ||
      errMsg.includes('ECONNRESET') ||
      errMsg.includes('Socket closed') ||
      errMsg.includes('network');

    if (isConnectionError) {
      logger.error({
        msg: '[TokenService] Redis connection error during validation - retryable',
        err: { message: errMsg },
        userId
      });
      throw new RedisUnavailableError(`Redis connection error: ${errMsg}`);
    }

    logger.error({
      msg: '[TokenService] Failed to validate refresh token',
      err: { message: errMsg },
      userId
    });
    return null; // Non-connection errors (parse error, etc.) - return null
  }
}

/**
 * Rotate refresh token (invalidate old, issue new)
 * This is a security best practice - each refresh token is single-use
 */
/**
 * Rotate refresh token (invalidate old, issue new)
 * CRITICAL FIX: Atomic operation - store new token BEFORE deleting old token
 * This prevents permanent token loss if storage fails
 */
export async function rotateRefreshToken(
  userId: string,
  oldRefreshToken: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<string | null> {
  const logger = getLogger();

  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.error({ msg: '[TokenService] Redis unavailable - cannot rotate refresh token', userId });
    return null;
  }

  try {
    const client = getClient();
    
    // Validate old token first
    const oldData = await validateRefreshToken(userId, oldRefreshToken);
    if (!oldData) {
      logger.warn({ msg: '[TokenService] Cannot rotate - old refresh token invalid', userId });
      return null;
    }

    const oldHash = hashToken(oldRefreshToken);
    const refreshKey = `${PREFIX.REFRESH}${userId}:${oldHash}`;
    const sessionKey = `${PREFIX.SESSION}${userId}`;

    // CRITICAL FIX: Store new token FIRST, then delete old token
    // This ensures we never lose the refresh token if storage fails
    const newToken = generateRefreshToken();
    const newHash = hashToken(newToken);
    const newRefreshKey = `${PREFIX.REFRESH}${userId}:${newHash}`;
    
    // Prepare new token data
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONFIG.REFRESH_TOKEN_TTL * 1000);
    const newData: RefreshTokenData = {
      tokenHash: newHash,
      userId,
      deviceInfo,
      ipAddress,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // OPTIMIZATION: Use pipeline for atomic operations
    if (client.pipeline) {
      // Store new token, add to session set, then delete old token
      const pipeline = client.pipeline();
      pipeline.setEx(newRefreshKey, CONFIG.REFRESH_TOKEN_TTL, JSON.stringify(newData));
      pipeline.sAdd(sessionKey, newHash);
      pipeline.expire(sessionKey, CONFIG.REFRESH_TOKEN_TTL);
      pipeline.del(refreshKey);  // Delete old token AFTER new one is stored
      pipeline.sRem(sessionKey, oldHash);
      
      const results = await pipeline.exec();
      
      // CRITICAL FIX: Validate pipeline results - pipelines are NOT atomic
      if (!results || results.length !== 5) {
        logger.error({ 
          msg: '[TokenService] CRITICAL: Token rotation pipeline incomplete', 
          userId,
          expectedCommands: 5,
          actualResults: results?.length || 0
        });
        // Try to clean up - verify old token still exists (rotation failed)
        const oldTokenStillExists = await client.exists(refreshKey);
        if (oldTokenStillExists) {
          logger.warn({ msg: '[TokenService] Old token still exists after failed rotation', userId });
        }
        return null;
      }
      
      // Check each result for errors
      for (let i = 0; i < results.length; i++) {
        if (results[i] instanceof Error) {
          logger.error({ 
            msg: '[TokenService] CRITICAL: Token rotation pipeline command failed', 
            userId,
            commandIndex: i,
            command: i === 0 ? 'setEx' : i === 1 ? 'sAdd' : i === 2 ? 'expire' : i === 3 ? 'del' : 'sRem',
            error: results[i].message
          });
          // If new token storage failed (index 0), old token is still valid - return null
          // If delete failed (index 3), security issue - log but continue
          if (i === 0) {
            return null; // New token not stored, keep old token
          }
          if (i === 3) {
            logger.error({ msg: '[TokenService] SECURITY: Failed to delete old token', userId, key: refreshKey });
            // Continue - new token is stored, old token deletion failed (security issue but not fatal)
          }
        }
      }
      
      // Verify new token was stored successfully
      const newTokenStored = results[0] !== null && results[0] !== undefined && !(results[0] instanceof Error);
      if (!newTokenStored) {
        logger.error({ msg: '[TokenService] Failed to store new refresh token during rotation', userId });
        return null;
      }
      
      // CRITICAL FIX: Verify old token was deleted (security check)
      const oldTokenDeleted = results[3] === 1 || results[3] === '1';
      if (!oldTokenDeleted) {
        logger.error({ 
          msg: '[TokenService] SECURITY: Old refresh token not deleted during rotation', 
          userId,
          deleteResult: results[3]
        });
        // Security issue but not fatal - new token is stored
      }

      // Verify TTL was set
      const actualTtl = await client.ttl(newRefreshKey);
      if (actualTtl === -1) {
        logger.error({ msg: '[TokenService] CRITICAL: TTL not set on new refresh token', userId, key: newRefreshKey });
        // Fix it immediately
        await client.expire(newRefreshKey, CONFIG.REFRESH_TOKEN_TTL);
      } else if (actualTtl === -2) {
        logger.error({ msg: '[TokenService] CRITICAL: New refresh token not found after storage', userId });
        return null;
      }

      logger.info({ 
        msg: '[TokenService] Refresh token rotated successfully', 
        userId,
        oldTtl: await client.ttl(refreshKey),  // Should be -2 (deleted)
        newTtl: actualTtl
      });
    } else {
      // Fallback for in-memory client - store new first, then delete old
      await client.setEx(newRefreshKey, CONFIG.REFRESH_TOKEN_TTL, JSON.stringify(newData));
      await client.sAdd(sessionKey, newHash);
      await client.expire(sessionKey, CONFIG.REFRESH_TOKEN_TTL);
      
      // Verify new token stored before deleting old
      const verifyNew = await client.get(newRefreshKey);
      if (!verifyNew) {
        logger.error({ msg: '[TokenService] Failed to store new refresh token', userId });
        return null;
      }
      
      // Now safe to delete old token
      await client.del(refreshKey);
      await client.sRem(sessionKey, oldHash);
      
      // CRITICAL FIX: Verify old token was deleted (security check)
      const oldTokenStillExists = await client.exists(refreshKey);
      if (oldTokenStillExists) {
        logger.error({ 
          msg: '[TokenService] SECURITY: Old refresh token still exists after deletion attempt', 
          userId,
          key: refreshKey
        });
        // Try again
        await client.del(refreshKey);
      }
    }

    return newToken;
  } catch (error: any) {
    logger.error({ 
      msg: '[TokenService] Failed to rotate refresh token', 
      err: { message: error.message },
      userId 
    });
    return null;
  }
}

/**
 * Revoke a specific refresh token (single device logout)
 */
export async function revokeRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const client = getClient();
    const tokenHash = hashToken(refreshToken);
    const key = `${PREFIX.REFRESH}${userId}:${tokenHash}`;
    const sessionKey = `${PREFIX.SESSION}${userId}`;

    // OPTIMIZATION: Batch operations
    if (client.pipeline) {
      const pipeline = client.pipeline();
      pipeline.del(key);
      pipeline.sRem(sessionKey, tokenHash);
      await pipeline.exec();
    } else {
      await client.del(key);
      await client.sRem(sessionKey, tokenHash);
    }

    return true;
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to revoke refresh token', err: { message: error.message } });
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllRefreshTokens(userId: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const client = getClient();
    const sessionKey = `${PREFIX.SESSION}${userId}`;
    const sessions = await client.sMembers(sessionKey);

    // OPTIMIZATION: Batch delete all tokens
    if (client.pipeline && sessions.length > 0) {
      const pipeline = client.pipeline();
      for (const tokenHash of sessions) {
        pipeline.del(`${PREFIX.REFRESH}${userId}:${tokenHash}`);
      }
      pipeline.del(sessionKey);
      await pipeline.exec();
    } else {
      for (const tokenHash of sessions) {
        await client.del(`${PREFIX.REFRESH}${userId}:${tokenHash}`);
      }
      await client.del(sessionKey);
    }

    return true;
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to revoke all tokens', err: { message: error.message } });
    return false;
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<Omit<RefreshTokenData, 'tokenHash'>[]> {
  if (!isRedisAvailable()) {
    return [];
  }

  try {
    const client = getClient();
    const sessionHashes = await client.sMembers(`${PREFIX.SESSION}${userId}`);
    const sessions: Omit<RefreshTokenData, 'tokenHash'>[] = [];

    // OPTIMIZATION: Batch get operations if pipeline available
    if (client.pipeline && sessionHashes.length > 0) {
      const pipeline = client.pipeline();
      for (const hash of sessionHashes) {
        pipeline.get(`${PREFIX.REFRESH}${userId}:${hash}`);
      }
      const results = await pipeline.exec();
      
      for (let i = 0; i < results.length; i++) {
        const dataStr = results[i] as string | null;
        if (dataStr) {
          const data: RefreshTokenData = JSON.parse(dataStr);
          const { tokenHash, ...safeData } = data;
          sessions.push(safeData);
        }
      }
    } else {
      for (const hash of sessionHashes) {
        const dataStr = await client.get(`${PREFIX.REFRESH}${userId}:${hash}`);
        if (dataStr) {
          const data: RefreshTokenData = JSON.parse(dataStr);
          const { tokenHash, ...safeData } = data;
          sessions.push(safeData);
        }
      }
    }

    return sessions;
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to get user sessions', err: { message: error.message } });
    return [];
  }
}

// ============================================================================
// ACCOUNT LOCKOUT
// ============================================================================

export interface LockoutStatus {
  isLocked: boolean;
  failedAttempts: number;
  lockoutEndsAt?: string;
  remainingAttempts: number;
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(email: string): Promise<LockoutStatus> {
  const defaultStatus: LockoutStatus = {
    isLocked: false,
    failedAttempts: 0,
    remainingAttempts: CONFIG.MAX_FAILED_ATTEMPTS,
  };

  if (!isRedisAvailable()) {
    return defaultStatus;
  }

  try {
    const client = getClient();
    const lockKey = `${PREFIX.LOCKOUT}${email.toLowerCase()}`;
    const lockTimeKey = `${PREFIX.LOCKOUT_TIME}${email.toLowerCase()}`;

    // Check if already locked
    const lockTime = await client.get(lockTimeKey);
    if (lockTime) {
      const lockEnds = new Date(lockTime);
      if (lockEnds > new Date()) {
        return {
          isLocked: true,
          failedAttempts: CONFIG.MAX_FAILED_ATTEMPTS,
          lockoutEndsAt: lockTime,
          remainingAttempts: 0,
        };
      }
      // Lock expired, clear it (batch operation)
      if (client.pipeline) {
        const pipeline = client.pipeline();
        pipeline.del(lockTimeKey);
        pipeline.del(lockKey);
        await pipeline.exec();
      } else {
        await client.del(lockTimeKey);
        await client.del(lockKey);
      }
    }

    // Increment failed attempts
    const attempts = await client.incr(lockKey);

    // Set expiry on first attempt
    if (attempts === 1) {
      await client.expire(lockKey, CONFIG.FAILED_ATTEMPT_WINDOW);
    }

    // Check if should lock
    if (attempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
      const lockEnds = new Date(Date.now() + CONFIG.LOCKOUT_DURATION * 1000);
      await client.setEx(lockTimeKey, CONFIG.LOCKOUT_DURATION, lockEnds.toISOString());

      return {
        isLocked: true,
        failedAttempts: attempts,
        lockoutEndsAt: lockEnds.toISOString(),
        remainingAttempts: 0,
      };
    }

    return {
      isLocked: false,
      failedAttempts: attempts,
      remainingAttempts: CONFIG.MAX_FAILED_ATTEMPTS - attempts,
    };
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to record failed login', err: { message: error.message } });
    return defaultStatus;
  }
}

/**
 * Clear failed login attempts (on successful login)
 */
export async function clearFailedLogins(email: string): Promise<void> {
  if (!isRedisAvailable()) {
    return;
  }

  try {
    const client = getClient();
    const lockKey = `${PREFIX.LOCKOUT}${email.toLowerCase()}`;
    const lockTimeKey = `${PREFIX.LOCKOUT_TIME}${email.toLowerCase()}`;

    // OPTIMIZATION: Batch delete
    if (client.pipeline) {
      const pipeline = client.pipeline();
      pipeline.del(lockKey);
      pipeline.del(lockTimeKey);
      await pipeline.exec();
    } else {
      await client.del(lockKey);
      await client.del(lockTimeKey);
    }
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to clear failed logins', err: { message: error.message } });
  }
}

/**
 * Check if account is locked
 */
export async function isAccountLocked(email: string): Promise<LockoutStatus> {
  const defaultStatus: LockoutStatus = {
    isLocked: false,
    failedAttempts: 0,
    remainingAttempts: CONFIG.MAX_FAILED_ATTEMPTS,
  };

  if (!isRedisAvailable()) {
    return defaultStatus;
  }

  try {
    const client = getClient();
    const lockKey = `${PREFIX.LOCKOUT}${email.toLowerCase()}`;
    const lockTimeKey = `${PREFIX.LOCKOUT_TIME}${email.toLowerCase()}`;

    // OPTIMIZATION: Batch get operations
    let lockTime: string | null;
    let attemptsStr: string | null;
    
    if (client.pipeline) {
      const pipeline = client.pipeline();
      pipeline.get(lockTimeKey);
      pipeline.get(lockKey);
      const results = await pipeline.exec();
      lockTime = results[0] as string | null;
      attemptsStr = results[1] as string | null;
    } else {
      lockTime = await client.get(lockTimeKey);
      attemptsStr = await client.get(lockKey);
    }

    if (lockTime) {
      const lockEnds = new Date(lockTime);
      if (lockEnds > new Date()) {
        return {
          isLocked: true,
          failedAttempts: CONFIG.MAX_FAILED_ATTEMPTS,
          lockoutEndsAt: lockTime,
          remainingAttempts: 0,
        };
      }
      // Lock expired, clear it (batch)
      if (client.pipeline) {
        const pipeline = client.pipeline();
        pipeline.del(lockTimeKey);
        pipeline.del(lockKey);
        await pipeline.exec();
      } else {
        await client.del(lockTimeKey);
        await client.del(lockKey);
      }
    }

    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

    return {
      isLocked: false,
      failedAttempts: attempts,
      remainingAttempts: CONFIG.MAX_FAILED_ATTEMPTS - attempts,
    };
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to check lockout', err: { message: error.message } });
    return defaultStatus;
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Close Redis connection gracefully
 */
export async function closeTokenService(): Promise<void> {
  // Token service uses shared Redis client, so closing is handled by redisClient.ts
  // This function kept for backward compatibility
  const logger = getLogger();
  logger.info({ msg: '[TokenService] Close requested (using shared client)' });
}
