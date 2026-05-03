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
};
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
/**
 * Comprehensive Redis diagnostics
 */
export async function diagnoseRedisTokenStorage() {
    const logger = getLogger();
    const results = {
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
        if (!isRedisAvailable() || !client || typeof client.keys !== 'function') {
            results.error = 'Real Redis client not available - diagnostics require actual Redis connection';
            return results;
        }
        // Check connection info
        if (typeof client.info === 'function') {
            try {
                const info = await client.info('server');
                results.connectionInfo = {
                    redis_version: info.match(/redis_version:([^\r\n]+)/)?.[1],
                    connected_clients: info.match(/connected_clients:([^\r\n]+)/)?.[1],
                };
            }
            catch (e) {
                // Info not available
            }
        }
        // Count keys by prefix
        const prefixes = ['rt:', 'sess:', 'bl:', 'lock:'];
        for (const prefix of prefixes) {
            try {
                const keys = await client.keys(`${prefix}*`);
                results.keyCounts[prefix] = keys.length;
                // Get sample keys with TTL
                if (keys.length > 0) {
                    const samples = [];
                    for (const key of keys.slice(0, 3)) {
                        const ttl = await client.ttl(key);
                        const pttl = typeof client.pttl === 'function' ? await client.pttl(key) : ttl * 1000;
                        const value = await client.get(key);
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
            }
            catch (error) {
                logger.error({ msg: `[Redis Diagnostics] Error checking ${prefix}`, err: { message: error.message } });
            }
        }
        // Check persistence configuration (if Redis client supports it)
        if (typeof client.configGet === 'function') {
            try {
                const saveConfig = await client.configGet('save');
                const appendonly = await client.configGet('appendonly');
                results.persistenceCheck = {
                    save: saveConfig,
                    appendonly: appendonly,
                };
            }
            catch (e) {
                // Config command not available or not supported
                results.persistenceCheck = { error: 'Config command not available' };
            }
        }
        // Check maxmemory policy
        try {
            if (typeof client.configGet === 'function') {
                const maxmemoryPolicy = await client.configGet('maxmemory-policy');
                results.maxmemoryPolicy = maxmemoryPolicy;
            }
        }
        catch (e) {
            // Not available
        }
    }
    catch (error) {
        logger.error({ msg: '[Redis Diagnostics] Error', err: { message: error.message } });
        results.error = error.message;
    }
    return results;
}
/**
 * Verify a specific refresh token exists and is valid
 */
export async function verifyRefreshTokenExists(userId, refreshToken) {
    const result = {
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
        if (!isRedisAvailable() || typeof client.exists !== 'function') {
            result.error = 'Real Redis client not available';
            return result;
        }
        const tokenHash = hashToken(refreshToken);
        const key = `${PREFIX.REFRESH}${userId}:${tokenHash}`;
        result.key = key;
        const exists = await client.exists(key);
        if (!exists) {
            result.error = 'Refresh token not found in Redis';
            return result;
        }
        result.exists = true;
        result.ttl = await client.ttl(key);
        const dataStr = await client.get(key);
        if (dataStr) {
            result.data = JSON.parse(dataStr);
        }
    }
    catch (error) {
        result.error = error.message;
    }
    return result;
}
//# sourceMappingURL=redisDiagnostics.js.map