/**
 * Token Service - Redis-based token management
 *
 * Handles:
 * - Token blacklisting (logout)
 * - Refresh token storage
 * - Account lockout tracking
 * - Session management
 */

import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';
import { getLogger } from '../utils/logger.js';

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

let redisClient: RedisClientType | null = null;
let isConnected = false;

/**
 * Initialize Redis connection for token service
 */
export async function initTokenService(): Promise<void> {
  const logger = getLogger();

  if (!process.env.REDIS_URL) {
    logger.warn({ msg: '[TokenService] REDIS_URL not set - token blacklisting disabled' });
    return;
  }

  try {
    redisClient = createClient({ url: process.env.REDIS_URL });

    redisClient.on('error', (err) => {
      logger.error({ msg: '[TokenService] Redis error', err: { message: err.message } });
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info({ msg: '[TokenService] Redis connected' });
      isConnected = true;
    });

    redisClient.on('reconnecting', () => {
      logger.info({ msg: '[TokenService] Redis reconnecting' });
    });

    await redisClient.connect();
    isConnected = true;
    logger.info({ msg: '[TokenService] Initialized successfully' });
  } catch (error: any) {
    logger.error({ msg: '[TokenService] Failed to initialize', err: { message: error.message } });
    redisClient = null;
    isConnected = false;
  }
}

/**
 * Check if Redis is available
 */
export function isTokenServiceAvailable(): boolean {
  return isConnected && redisClient !== null;
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
  if (!redisClient || !isConnected) {
    return false;
  }

  try {
    const tokenHash = hashToken(token);
    // Store with TTL matching the token's remaining lifetime
    await redisClient.setEx(
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
  if (!redisClient || !isConnected) {
    return false; // If Redis unavailable, allow token (fail open for availability)
  }

  try {
    const tokenHash = hashToken(token);
    const result = await redisClient.get(`${PREFIX.BLACKLIST}${tokenHash}`);
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
 */
export async function storeRefreshToken(
  userId: string,
  refreshToken: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<boolean> {
  if (!redisClient || !isConnected) {
    return false;
  }

  try {
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

    // Store refresh token data
    const key = `${PREFIX.REFRESH}${userId}:${tokenHash}`;
    await redisClient.setEx(key, CONFIG.REFRESH_TOKEN_TTL, JSON.stringify(data));

    // Track in user's session set (for listing active sessions)
    await redisClient.sAdd(`${PREFIX.SESSION}${userId}`, tokenHash);
    await redisClient.expire(`${PREFIX.SESSION}${userId}`, CONFIG.REFRESH_TOKEN_TTL);

    // Enforce max sessions (remove oldest if exceeded)
    const sessions = await redisClient.sMembers(`${PREFIX.SESSION}${userId}`);
    if (sessions.length > CONFIG.MAX_SESSIONS_PER_USER) {
      // Remove oldest sessions
      const sessionsToRemove = sessions.slice(0, sessions.length - CONFIG.MAX_SESSIONS_PER_USER);
      for (const oldHash of sessionsToRemove) {
        await redisClient.del(`${PREFIX.REFRESH}${userId}:${oldHash}`);
        await redisClient.sRem(`${PREFIX.SESSION}${userId}`, oldHash);
      }
    }

    return true;
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to store refresh token', err: { message: error.message } });
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
  if (!redisClient || !isConnected) {
    return null;
  }

  try {
    const tokenHash = hashToken(refreshToken);
    const key = `${PREFIX.REFRESH}${userId}:${tokenHash}`;
    const dataStr = await redisClient.get(key);

    if (!dataStr) {
      return null;
    }

    const data: RefreshTokenData = JSON.parse(dataStr);

    // Verify expiration
    if (new Date(data.expiresAt) < new Date()) {
      await redisClient.del(key);
      return null;
    }

    return data;
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to validate refresh token', err: { message: error.message } });
    return null;
  }
}

/**
 * Rotate refresh token (invalidate old, issue new)
 * This is a security best practice - each refresh token is single-use
 */
export async function rotateRefreshToken(
  userId: string,
  oldRefreshToken: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<string | null> {
  if (!redisClient || !isConnected) {
    return null;
  }

  try {
    // Validate old token first
    const oldData = await validateRefreshToken(userId, oldRefreshToken);
    if (!oldData) {
      return null;
    }

    // Delete old token
    const oldHash = hashToken(oldRefreshToken);
    await redisClient.del(`${PREFIX.REFRESH}${userId}:${oldHash}`);
    await redisClient.sRem(`${PREFIX.SESSION}${userId}`, oldHash);

    // Generate and store new token
    const newToken = generateRefreshToken();
    const stored = await storeRefreshToken(userId, newToken, deviceInfo, ipAddress);

    if (!stored) {
      return null;
    }

    return newToken;
  } catch (error: any) {
    const logger = getLogger();
    logger.error({ msg: '[TokenService] Failed to rotate refresh token', err: { message: error.message } });
    return null;
  }
}

/**
 * Revoke a specific refresh token (single device logout)
 */
export async function revokeRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
  if (!redisClient || !isConnected) {
    return false;
  }

  try {
    const tokenHash = hashToken(refreshToken);
    const key = `${PREFIX.REFRESH}${userId}:${tokenHash}`;

    await redisClient.del(key);
    await redisClient.sRem(`${PREFIX.SESSION}${userId}`, tokenHash);

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
  if (!redisClient || !isConnected) {
    return false;
  }

  try {
    const sessions = await redisClient.sMembers(`${PREFIX.SESSION}${userId}`);

    // Delete all refresh tokens
    for (const tokenHash of sessions) {
      await redisClient.del(`${PREFIX.REFRESH}${userId}:${tokenHash}`);
    }

    // Clear session set
    await redisClient.del(`${PREFIX.SESSION}${userId}`);

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
  if (!redisClient || !isConnected) {
    return [];
  }

  try {
    const sessionHashes = await redisClient.sMembers(`${PREFIX.SESSION}${userId}`);
    const sessions: Omit<RefreshTokenData, 'tokenHash'>[] = [];

    for (const hash of sessionHashes) {
      const dataStr = await redisClient.get(`${PREFIX.REFRESH}${userId}:${hash}`);
      if (dataStr) {
        const data: RefreshTokenData = JSON.parse(dataStr);
        // Don't expose token hash
        const { tokenHash, ...safeData } = data;
        sessions.push(safeData);
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

  if (!redisClient || !isConnected) {
    return defaultStatus;
  }

  try {
    const lockKey = `${PREFIX.LOCKOUT}${email.toLowerCase()}`;
    const lockTimeKey = `${PREFIX.LOCKOUT_TIME}${email.toLowerCase()}`;

    // Check if already locked
    const lockTime = await redisClient.get(lockTimeKey);
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
      // Lock expired, clear it
      await redisClient.del(lockTimeKey);
      await redisClient.del(lockKey);
    }

    // Increment failed attempts
    const attempts = await redisClient.incr(lockKey);

    // Set expiry on first attempt
    if (attempts === 1) {
      await redisClient.expire(lockKey, CONFIG.FAILED_ATTEMPT_WINDOW);
    }

    // Check if should lock
    if (attempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
      const lockEnds = new Date(Date.now() + CONFIG.LOCKOUT_DURATION * 1000);
      await redisClient.setEx(lockTimeKey, CONFIG.LOCKOUT_DURATION, lockEnds.toISOString());

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
  if (!redisClient || !isConnected) {
    return;
  }

  try {
    const lockKey = `${PREFIX.LOCKOUT}${email.toLowerCase()}`;
    const lockTimeKey = `${PREFIX.LOCKOUT_TIME}${email.toLowerCase()}`;

    await redisClient.del(lockKey);
    await redisClient.del(lockTimeKey);
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

  if (!redisClient || !isConnected) {
    return defaultStatus;
  }

  try {
    const lockKey = `${PREFIX.LOCKOUT}${email.toLowerCase()}`;
    const lockTimeKey = `${PREFIX.LOCKOUT_TIME}${email.toLowerCase()}`;

    // Check lockout status
    const lockTime = await redisClient.get(lockTimeKey);
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
      // Lock expired
      await redisClient.del(lockTimeKey);
      await redisClient.del(lockKey);
    }

    // Get current attempt count
    const attemptsStr = await redisClient.get(lockKey);
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
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      isConnected = false;
    } catch (error: any) {
      const logger = getLogger();
      logger.error({ msg: '[TokenService] Error closing connection', err: { message: error.message } });
    }
  }
}
