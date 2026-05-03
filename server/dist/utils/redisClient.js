/**
 * Shared Redis Client Singleton
 *
 * Optimizations:
 * - Single connection shared across all services
 * - Local Redis support for development
 * - In-memory fallback when Redis unavailable
 * - Connection pooling and reuse
 */
import { createClient } from 'redis';
import { getLogger } from './logger.js';
let redisClient = null;
let isConnected = false;
let isLimitExceeded = false;
let connectionAttempts = 0;
let isInitializing = false;
// Environment-aware connection configuration
const isDev = process.env.NODE_ENV !== 'production';
const MAX_CONNECTION_ATTEMPTS = isDev ? 5 : 3;
// Reconnection: how many times the redis client internally retries before emitting 'end'
const MAX_RECONNECT_RETRIES = isDev ? 50 : 10;
const MAX_RECONNECT_DELAY_MS = isDev ? 30_000 : 10_000;
// In-memory fallback store for development
const inMemoryStore = new Map();
/**
 * Check if error is a Redis limit exceeded error
 */
function isRedisLimitError(error) {
    if (!error || typeof error.message !== 'string') {
        return false;
    }
    return error.message.includes('max requests limit exceeded') ||
        error.message.includes('ERR max requests limit exceeded');
}
/**
 * Get Redis URL - supports local Redis for development
 * Priority: USE_LOCAL_REDIS > REDIS_LOCAL_URL > REDIS_URL (in dev) > REDIS_URL (in prod)
 */
function getRedisUrl() {
    const logger = getLogger();
    // Priority 1: If USE_LOCAL_REDIS is explicitly set to 'true', ALWAYS use local Redis
    // This takes absolute precedence over REDIS_URL to prevent accidentally using cloud Redis in dev
    if (process.env.USE_LOCAL_REDIS === 'true') {
        const localUrl = process.env.REDIS_LOCAL_URL || 'redis://localhost:6379';
        // Log warning if REDIS_URL is also set (indicates potential misconfiguration)
        if (process.env.REDIS_URL) {
            logger.warn({
                msg: '[Redis] USE_LOCAL_REDIS=true detected - ignoring REDIS_URL',
                ignoredUrl: process.env.REDIS_URL.replace(/\/\/.*@/, '//***@'),
                usingUrl: localUrl
            });
        }
        return localUrl;
    }
    // Priority 2: In development, prefer local Redis if REDIS_LOCAL_URL is set
    if (process.env.NODE_ENV === 'development') {
        // Check for explicit local Redis URL
        if (process.env.REDIS_LOCAL_URL) {
            return process.env.REDIS_LOCAL_URL;
        }
        // If REDIS_URL is not set in development, default to localhost
        if (!process.env.REDIS_URL) {
            return 'redis://localhost:6379';
        }
        // If REDIS_URL is set and USE_LOCAL_REDIS is false, use REDIS_URL
    }
    // Production: use configured Redis URL
    return process.env.REDIS_URL || null;
}
/**
 * Initialize shared Redis client
 * Idempotent: safe to call multiple times - will reuse existing connection if already initialized
 */
export async function initRedisClient() {
    const logger = getLogger();
    // If already connected, don't reinitialize
    if (isConnected && redisClient !== null) {
        logger.debug({ msg: '[Redis] Already initialized, skipping' });
        return;
    }
    // If limit exceeded, don't retry
    if (isLimitExceeded) {
        logger.warn({
            msg: '[Redis] Limit exceeded - using in-memory fallback',
            attempts: connectionAttempts
        });
        return;
    }
    const redisUrl = getRedisUrl();
    if (!redisUrl) {
        logger.warn({
            msg: '[Redis] No Redis URL configured - using in-memory fallback',
            environment: process.env.NODE_ENV
        });
        return;
    }
    // Don't retry if limit exceeded and max attempts reached
    if (isLimitExceeded && connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
        logger.warn({
            msg: '[Redis] Limit exceeded - using in-memory fallback',
            attempts: connectionAttempts
        });
        return;
    }
    isInitializing = true;
    try {
        // Create client with optimized settings
        redisClient = createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries >= MAX_RECONNECT_RETRIES) {
                        logger.warn({
                            msg: '[Redis] Max reconnection attempts reached - giving up',
                            retries,
                            maxRetries: MAX_RECONNECT_RETRIES
                        });
                        return false; // Stop reconnecting
                    }
                    // Exponential backoff with jitter, capped at MAX_RECONNECT_DELAY_MS
                    const baseDelay = Math.min(retries * 500, MAX_RECONNECT_DELAY_MS);
                    const jitter = Math.floor(Math.random() * 500);
                    const delay = baseDelay + jitter;
                    if (retries > 0 && retries % 5 === 0) {
                        logger.info({
                            msg: '[Redis] Reconnection in progress...',
                            attempt: retries,
                            maxRetries: MAX_RECONNECT_RETRIES,
                            nextDelayMs: delay
                        });
                    }
                    return delay;
                },
                connectTimeout: 10_000,
            },
        });
        redisClient.on('error', (err) => {
            logger.error({
                msg: '[Redis] Connection error',
                err: { message: err.message }
            });
            // CRITICAL FIX: Always update connection state on error
            isConnected = false;
            if (isRedisLimitError(err)) {
                isLimitExceeded = true;
                // Disable reconnection when limit exceeded
                if (redisClient) {
                    redisClient.removeAllListeners('error');
                    redisClient.removeAllListeners('reconnecting');
                }
                logger.warn({
                    msg: '[Redis] Limit exceeded - switching to in-memory fallback. Reconnection disabled.'
                });
            }
        });
        // CRITICAL FIX: Handle connection end event (connection closed)
        redisClient.on('end', () => {
            logger.warn({ msg: '[Redis] Connection ended - will re-create client on next ensureRedisConnection() call' });
            isConnected = false;
            redisClient = null;
        });
        redisClient.on('connect', () => {
            logger.info({ msg: '[Redis] Connected', url: redisUrl.replace(/\/\/.*@/, '//***@') });
            isConnected = true;
            isLimitExceeded = false;
            connectionAttempts = 0; // Reset on successful connection
        });
        redisClient.on('reconnecting', () => {
            connectionAttempts++;
            logger.info({
                msg: '[Redis] Reconnecting',
                attempt: connectionAttempts
            });
        });
        await redisClient.connect();
        isConnected = true;
        isLimitExceeded = false;
        logger.info({ msg: '[Redis] Initialized successfully' });
    }
    catch (error) {
        connectionAttempts++;
        if (isRedisLimitError(error)) {
            isLimitExceeded = true;
            logger.warn({
                msg: '[Redis] Limit exceeded during initialization - using in-memory fallback',
                err: { message: error.message }
            });
        }
        else {
            logger.error({
                msg: '[Redis] Failed to initialize',
                err: { message: error.message },
                attempt: connectionAttempts,
                willRetry: connectionAttempts < MAX_CONNECTION_ATTEMPTS
            });
        }
        redisClient = null;
        isConnected = false;
    }
    finally {
        isInitializing = false;
    }
}
/**
 * Get the shared Redis client
 */
export function getRedisClient() {
    return redisClient;
}
/**
 * Check if Redis is available
 */
export function isRedisAvailable() {
    return isConnected && redisClient !== null && !isLimitExceeded;
}
/**
 * Ensure Redis connection is available, re-initializing if needed.
 * Use this before critical operations (token validation/storage) instead of just checking isRedisAvailable().
 * Returns true if Redis is connected, false if it could not be restored.
 */
export async function ensureRedisConnection() {
    // Fast path: already connected
    if (isConnected && redisClient !== null && !isLimitExceeded) {
        return true;
    }
    // Rate-limit exceeded (cloud Redis) - don't retry
    if (isLimitExceeded) {
        return false;
    }
    const logger = getLogger();
    logger.info({ msg: '[Redis] Connection unavailable - attempting re-initialization' });
    // If another init is in progress, wait for it
    if (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return isConnected && redisClient !== null;
    }
    // Reset connection attempts for fresh re-initialization
    connectionAttempts = 0;
    try {
        await initRedisClient();
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error({
            msg: '[Redis] Re-initialization failed',
            err: { message: errMsg }
        });
    }
    const result = isConnected && redisClient !== null;
    logger.info({
        msg: result ? '[Redis] Re-initialization successful' : '[Redis] Re-initialization failed - using in-memory fallback',
        isConnected: result
    });
    return result;
}
/**
 * In-memory fallback operations
 */
class InMemoryRedis {
    store = new Map();
    async get(key) {
        const item = this.store.get(key);
        if (!item)
            return null;
        // Check expiration
        if (item.expiresAt && item.expiresAt < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }
    async set(key, value) {
        this.store.set(key, { value });
    }
    async setEx(key, seconds, value) {
        const expiresAt = Date.now() + (seconds * 1000);
        this.store.set(key, { value, expiresAt });
    }
    async del(key) {
        this.store.delete(key);
    }
    async incr(key) {
        const current = await this.get(key);
        const newValue = current ? parseInt(current, 10) + 1 : 1;
        await this.set(key, newValue.toString());
        return newValue;
    }
    async sAdd(key, ...members) {
        const current = await this.get(key);
        const set = current ? new Set(JSON.parse(current)) : new Set();
        members.forEach(m => set.add(m));
        await this.set(key, JSON.stringify(Array.from(set)));
        return set.size;
    }
    async sRem(key, ...members) {
        const current = await this.get(key);
        if (!current)
            return 0;
        const set = new Set(JSON.parse(current));
        const before = set.size;
        members.forEach(m => set.delete(m));
        if (set.size === 0) {
            await this.del(key);
        }
        else {
            await this.set(key, JSON.stringify(Array.from(set)));
        }
        return before - set.size;
    }
    async sMembers(key) {
        const current = await this.get(key);
        if (!current)
            return [];
        return JSON.parse(current);
    }
    async expire(key, seconds) {
        const item = this.store.get(key);
        if (!item)
            return false;
        item.expiresAt = Date.now() + (seconds * 1000);
        return true;
    }
    async ttl(key) {
        const item = this.store.get(key);
        if (!item)
            return -2; // Key doesn't exist
        if (!item.expiresAt)
            return -1; // No expiry set
        const remaining = Math.floor((item.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2; // Expired
    }
    async pttl(key) {
        const ttl = await this.ttl(key);
        return ttl === -2 ? -2 : (ttl === -1 ? -1 : ttl * 1000);
    }
    async keys(pattern) {
        const allKeys = Array.from(this.store.keys());
        if (pattern === '*')
            return allKeys;
        // Simple pattern matching (supports prefix:*)
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return allKeys.filter(key => key.startsWith(prefix));
        }
        return allKeys.filter(key => key === pattern);
    }
    async exists(key) {
        return this.store.has(key) ? 1 : 0;
    }
    async sendCommand(args) {
        const [command, ...cmdArgs] = args;
        const key = cmdArgs[0];
        switch (command.toUpperCase()) {
            case 'GET':
                return await this.get(key);
            case 'SET':
                await this.set(key, cmdArgs[1]);
                return 'OK';
            case 'SETEX':
                await this.setEx(key, parseInt(cmdArgs[1], 10), cmdArgs[2]);
                return 'OK';
            case 'DEL':
                await this.del(key);
                return 1;
            case 'INCR':
                return await this.incr(key);
            case 'SADD':
                return await this.sAdd(key, ...cmdArgs.slice(1));
            case 'SREM':
                return await this.sRem(key, ...cmdArgs.slice(1));
            case 'SMEMBERS':
                return await this.sMembers(key);
            case 'EXPIRE':
                return await this.expire(key, parseInt(cmdArgs[1], 10));
            default:
                return null;
        }
    }
    // Add pipeline support for in-memory client
    pipeline() {
        const commands = [];
        return {
            setEx: (key, seconds, value) => {
                return new Promise((resolve, reject) => {
                    commands.push({ command: 'SETEX', args: [key, seconds.toString(), value], resolve, reject });
                });
            },
            sAdd: (key, ...members) => {
                return new Promise((resolve, reject) => {
                    commands.push({ command: 'SADD', args: [key, ...members], resolve, reject });
                });
            },
            expire: (key, seconds) => {
                return new Promise((resolve, reject) => {
                    commands.push({ command: 'EXPIRE', args: [key, seconds.toString()], resolve, reject });
                });
            },
            sMembers: (key) => {
                return new Promise((resolve, reject) => {
                    commands.push({ command: 'SMEMBERS', args: [key], resolve, reject });
                });
            },
            get: (key) => {
                return new Promise((resolve, reject) => {
                    commands.push({ command: 'GET', args: [key], resolve, reject });
                });
            },
            del: (key) => {
                return new Promise((resolve, reject) => {
                    commands.push({ command: 'DEL', args: [key], resolve, reject });
                });
            },
            sRem: (key, ...members) => {
                return new Promise((resolve, reject) => {
                    commands.push({ command: 'SREM', args: [key, ...members], resolve, reject });
                });
            },
            exec: async () => {
                const results = [];
                for (const cmd of commands) {
                    try {
                        const result = await inMemoryRedis.sendCommand([cmd.command, ...cmd.args]);
                        results.push(result);
                        cmd.resolve(result);
                    }
                    catch (error) {
                        results.push(error);
                        cmd.reject(error);
                    }
                }
                return results;
            }
        };
    }
}
// Singleton in-memory instance
const inMemoryRedis = new InMemoryRedis();
/**
 * Get Redis client or in-memory fallback
 */
export function getRedisClientOrFallback() {
    if (isRedisAvailable() && redisClient) {
        return redisClient;
    }
    return inMemoryRedis;
}
/**
 * Close Redis connection
 */
export async function closeRedisClient() {
    if (redisClient) {
        try {
            await redisClient.quit();
            redisClient = null;
            isConnected = false;
            const logger = getLogger();
            logger.info({ msg: '[Redis] Connection closed' });
        }
        catch (error) {
            const logger = getLogger();
            logger.error({
                msg: '[Redis] Error closing connection',
                err: { message: error.message }
            });
        }
    }
}
/**
 * Reset limit exceeded flag (for testing/recovery)
 */
export function resetLimitExceeded() {
    isLimitExceeded = false;
    connectionAttempts = 0;
}
//# sourceMappingURL=redisClient.js.map