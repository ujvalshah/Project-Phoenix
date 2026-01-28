/**
 * Redis Diagnostics Tool
 * Comprehensive checks for token storage issues
 */

import { getRedisClientOrFallback, isRedisAvailable } from './redisClient.js';
import { getLogger } from './logger.js';
import crypto from 'crypto';

const PREFIX = {
  REFRESH: 'rt:',
  SESSION: 'sess:',
  BLACKLIST: 'bl:',
  LOCKOUT: 'lock:',
} as const;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Comprehensive Redis diagnostics
 */
export async function diagnoseRedisTokenStorage(): Promise<{
  redisAvailable: boolean;
  connectionInfo: any;
  keyCounts: Record<string, number>;
  sampleKeys: Record<string, any[]>;
  ttlIssues: string[];
  persistenceCheck: any;
}> {
  const logger = getLogger();
  const results: any = {
    redisAvailable: isRedisAvailable(),
    connectionInfo: {},
    keyCounts: {},
    sampleKeys: {},
    ttlIssues: [],
    persistenceCheck: {},
  };

  if (!isRedisAvailable()) {
    logger.warn({ msg: '[Redis Diagnostics] Redis not available - using in-memory fallback' });
    return results;
  }

  try {
    const client = getRedisClientOrFallback();
    
    // Skip diagnostics for in-memory client (not a real Redis instance)
    if (!isRedisAvailable() || !client || typeof (client as any).keys !== 'function') {
      results.error = 'Real Redis client not available - diagnostics require actual Redis connection';
      return results;
    }
    
    // Check connection info
    if (typeof (client as any).info === 'function') {
      try {
        const info = await (client as any).info('server');
        results.connectionInfo = {
          redis_version: info.match(/redis_version:([^\r\n]+)/)?.[1],
          connected_clients: info.match(/connected_clients:([^\r\n]+)/)?.[1],
        };
      } catch (e) {
        // Info not available
      }
    }

    // Count keys by prefix
    const prefixes = ['rt:', 'sess:', 'bl:', 'lock:'];
    for (const prefix of prefixes) {
      try {
        const keys = await (client as any).keys(`${prefix}*`);
        results.keyCounts[prefix] = keys.length;
        
        // Get sample keys with TTL
        if (keys.length > 0) {
          const samples = [];
          for (const key of keys.slice(0, 3)) {
            const ttl = await (client as any).ttl(key);
            const pttl = typeof (client as any).pttl === 'function' ? await (client as any).pttl(key) : ttl * 1000;
            const value = await (client as any).get(key);
            
            samples.push({
              key,
              ttl: ttl > 0 ? ttl : (ttl === -1 ? 'no-expiry' : 'expired'),
              pttl: pttl > 0 ? pttl : (pttl === -1 ? 'no-expiry' : 'expired'),
              hasValue: !!value,
              valueLength: value?.length || 0,
            });

            // Check for TTL issues
            if (prefix === 'rt:' && ttl === -1) {
              results.ttlIssues.push(`Refresh token ${key} has no TTL set`);
            }
            if (prefix === 'rt:' && ttl === -2) {
              results.ttlIssues.push(`Refresh token ${key} has expired or doesn't exist`);
            }
          }
          results.sampleKeys[prefix] = samples;
        }
      } catch (error: any) {
        logger.error({ msg: `[Redis Diagnostics] Error checking ${prefix}`, err: { message: error.message } });
      }
    }

    // Check persistence configuration (if Redis client supports it)
    if (typeof (client as any).configGet === 'function') {
      try {
        const saveConfig = await (client as any).configGet('save');
        const appendonly = await (client as any).configGet('appendonly');
        results.persistenceCheck = {
          save: saveConfig,
          appendonly: appendonly,
        };
      } catch (e) {
        // Config command not available or not supported
        results.persistenceCheck = { error: 'Config command not available' };
      }
    }

    // Check maxmemory policy
    try {
      if (typeof (client as any).configGet === 'function') {
        const maxmemoryPolicy = await (client as any).configGet('maxmemory-policy');
        results.maxmemoryPolicy = maxmemoryPolicy;
      }
    } catch (e) {
      // Not available
    }

  } catch (error: any) {
    logger.error({ msg: '[Redis Diagnostics] Error', err: { message: error.message } });
    results.error = error.message;
  }

  return results;
}

/**
 * Verify a specific refresh token exists and is valid
 */
export async function verifyRefreshTokenExists(
  userId: string,
  refreshToken: string
): Promise<{
  exists: boolean;
  key: string;
  ttl: number;
  data: any;
  error?: string;
}> {
  const result: any = {
    exists: false,
    key: '',
    ttl: -2,
    data: null,
  };

  if (!isRedisAvailable()) {
    result.error = 'Redis not available';
    return result;
  }

  try {
    const client = getRedisClientOrFallback();
    
    // Check if real Redis client (has exists method)
    if (!isRedisAvailable() || typeof (client as any).exists !== 'function') {
      result.error = 'Real Redis client not available';
      return result;
    }
    
    const tokenHash = hashToken(refreshToken);
    const key = `${PREFIX.REFRESH}${userId}:${tokenHash}`;
    result.key = key;

    const exists = await (client as any).exists(key);
    if (!exists) {
      result.error = 'Refresh token not found in Redis';
      return result;
    }

    result.exists = true;
    result.ttl = await (client as any).ttl(key);
    
    const dataStr = await (client as any).get(key);
    if (dataStr) {
      result.data = JSON.parse(dataStr);
    }

  } catch (error: any) {
    result.error = error.message;
  }

  return result;
}
