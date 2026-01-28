/**
 * Shared Redis Client Singleton
 * 
 * Optimizations:
 * - Single connection shared across all services
 * - Local Redis support for development
 * - In-memory fallback when Redis unavailable
 * - Connection pooling and reuse
 */

import { createClient, RedisClientType } from 'redis';
import { getLogger } from './logger.js';

let redisClient: RedisClientType | null = null;
let isConnected = false;
let isLimitExceeded = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// In-memory fallback store for development
const inMemoryStore = new Map<string, { value: string; expiresAt?: number }>();

/**
 * Check if error is a Redis limit exceeded error
 */
function isRedisLimitError(error: any): boolean {
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
function getRedisUrl(): string | null {
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
export async function initRedisClient(): Promise<void> {
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

  try {
    // Create client with optimized settings
    redisClient = createClient({ 
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > MAX_CONNECTION_ATTEMPTS) {
            logger.warn({ msg: '[Redis] Max reconnection attempts reached' });
            return false; // Stop reconnecting
          }
          return Math.min(retries * 100, 3000); // Exponential backoff
        },
        connectTimeout: 5000,
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
      logger.warn({ msg: '[Redis] Connection ended' });
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
  } catch (error: any) {
    connectionAttempts++;
    
    if (isRedisLimitError(error)) {
      isLimitExceeded = true;
      logger.warn({ 
        msg: '[Redis] Limit exceeded during initialization - using in-memory fallback',
        err: { message: error.message } 
      });
    } else {
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
}

/**
 * Get the shared Redis client
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return isConnected && redisClient !== null && !isLimitExceeded;
}

/**
 * In-memory fallback operations
 */
class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    // Check expiration
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, { value });
  }

  async setEx(key: string, seconds: number, value: string): Promise<void> {
    const expiresAt = Date.now() + (seconds * 1000);
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const newValue = current ? parseInt(current, 10) + 1 : 1;
    await this.set(key, newValue.toString());
    return newValue;
  }

  async sAdd(key: string, ...members: string[]): Promise<number> {
    const current = await this.get(key);
    const set = current ? new Set(JSON.parse(current)) : new Set<string>();
    members.forEach(m => set.add(m));
    await this.set(key, JSON.stringify(Array.from(set)));
    return set.size;
  }

  async sRem(key: string, ...members: string[]): Promise<number> {
    const current = await this.get(key);
    if (!current) return 0;
    const set = new Set(JSON.parse(current));
    const before = set.size;
    members.forEach(m => set.delete(m));
    if (set.size === 0) {
      await this.del(key);
    } else {
      await this.set(key, JSON.stringify(Array.from(set)));
    }
    return before - set.size;
  }

  async sMembers(key: string): Promise<string[]> {
    const current = await this.get(key);
    if (!current) return [];
    return JSON.parse(current);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const item = this.store.get(key);
    if (!item) return false;
    item.expiresAt = Date.now() + (seconds * 1000);
    return true;
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return -2; // Key doesn't exist
    if (!item.expiresAt) return -1; // No expiry set
    const remaining = Math.floor((item.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2; // Expired
  }

  async pttl(key: string): Promise<number> {
    const ttl = await this.ttl(key);
    return ttl === -2 ? -2 : (ttl === -1 ? -1 : ttl * 1000);
  }

  async keys(pattern: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());
    if (pattern === '*') return allKeys;
    
    // Simple pattern matching (supports prefix:*)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return allKeys.filter(key => key.startsWith(prefix));
    }
    
    return allKeys.filter(key => key === pattern);
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async sendCommand(args: string[]): Promise<any> {
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
    const commands: Array<{ command: string; args: string[]; resolve: (value: any) => void; reject: (error: any) => void }> = [];
    
    return {
      setEx: (key: string, seconds: number, value: string) => {
        return new Promise<void>((resolve, reject) => {
          commands.push({ command: 'SETEX', args: [key, seconds.toString(), value], resolve, reject });
        });
      },
      sAdd: (key: string, ...members: string[]) => {
        return new Promise<void>((resolve, reject) => {
          commands.push({ command: 'SADD', args: [key, ...members], resolve, reject });
        });
      },
      expire: (key: string, seconds: number) => {
        return new Promise<void>((resolve, reject) => {
          commands.push({ command: 'EXPIRE', args: [key, seconds.toString()], resolve, reject });
        });
      },
      sMembers: (key: string) => {
        return new Promise<void>((resolve, reject) => {
          commands.push({ command: 'SMEMBERS', args: [key], resolve, reject });
        });
      },
      get: (key: string) => {
        return new Promise<void>((resolve, reject) => {
          commands.push({ command: 'GET', args: [key], resolve, reject });
        });
      },
      del: (key: string) => {
        return new Promise<void>((resolve, reject) => {
          commands.push({ command: 'DEL', args: [key], resolve, reject });
        });
      },
      sRem: (key: string, ...members: string[]) => {
        return new Promise<void>((resolve, reject) => {
          commands.push({ command: 'SREM', args: [key, ...members], resolve, reject });
        });
      },
      exec: async () => {
        const results: any[] = [];
        for (const cmd of commands) {
          try {
            const result = await inMemoryRedis.sendCommand([cmd.command, ...cmd.args]);
            results.push(result);
            cmd.resolve(result);
          } catch (error) {
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
export function getRedisClientOrFallback(): RedisClientType | InMemoryRedis {
  if (isRedisAvailable() && redisClient) {
    return redisClient;
  }
  return inMemoryRedis;
}

/**
 * Close Redis connection
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      isConnected = false;
      const logger = getLogger();
      logger.info({ msg: '[Redis] Connection closed' });
    } catch (error: any) {
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
export function resetLimitExceeded(): void {
  isLimitExceeded = false;
  connectionAttempts = 0;
}
