import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClientOrFallback, isRedisAvailable } from '../utils/redisClient.js';

/**
 * Helper function to create a RedisStore instance with a unique prefix
 * Each rate limiter must have its own RedisStore instance to avoid conflicts
 * Uses shared Redis client from redisClient.ts
 */
function createRedisStore(prefix: string): RedisStore | undefined {
  if (!isRedisAvailable()) {
    return undefined;
  }

  const client = getRedisClientOrFallback();

  return new RedisStore({
    prefix: prefix, // Unique prefix for each rate limiter
    sendCommand: async (...args: string[]) => {
      // Redis v5 sendCommand expects an array: [command, ...args]
      // rate-limit-redis passes arguments as individual parameters via rest syntax
      // So args is already an array containing [command, arg1, arg2, ...]
      return await client.sendCommand(args);
    },
  });
}

// Create separate RedisStore instances for each rate limiter with unique prefixes
const loginRedisStore = createRedisStore('rl:login');
const signupRedisStore = createRedisStore('rl:signup');
const passwordResetRedisStore = createRedisStore('rl:password-reset');
const resendVerificationRedisStore = createRedisStore('rl:resend-verification');
const unfurlRedisStore = createRedisStore('rl:unfurl');
const aiRedisStore = createRedisStore('rl:ai');

/**
 * Rate limiter for login endpoint
 * Stricter limits to prevent brute force attacks
 * 5 requests per 15 minutes per IP
 * Uses Redis store if available for distributed rate limiting
 */
export const loginLimiter = rateLimit({
  store: loginRedisStore, // Use Redis if available, otherwise in-memory
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many attempts. Please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many attempts. Please try again later.'
    });
  }
});

/**
 * Rate limiter for signup endpoint
 * Moderate limits to prevent abuse while allowing legitimate signups
 * 10 requests per hour per IP
 * Uses Redis store if available for distributed rate limiting
 */
export const signupLimiter = rateLimit({
  store: signupRedisStore, // Use Redis if available, otherwise in-memory
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many attempts. Please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many attempts. Please try again later.'
    });
  }
});

/**
 * Rate limiter for password-reset endpoints (apply when POST /auth/forgot-password, etc. exist)
 * Also used for GET /auth/verify-email (clicking verification links)
 * 5 requests per 15 minutes per IP
 */
export const passwordResetLimiter = rateLimit({
  store: passwordResetRedisStore,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ message: 'Too many attempts. Please try again later.' });
  },
});

/**
 * Rate limiter for POST /auth/resend-verification
 * 3 requests per 15 minutes per IP
 */
export const resendVerificationLimiter = rateLimit({
  store: resendVerificationRedisStore,
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ message: 'Too many requests. Please try again later.' });
  },
});

/**
 * Rate limiter for unfurl endpoint
 * Prevents DoS attacks and resource exhaustion
 * Tiered limits:
 * - Unauthenticated: 10 requests per minute
 * - Authenticated: 30 requests per minute
 * - Admin: 100 requests per minute (for Microlink testing)
 * Uses Redis store if available for distributed rate limiting
 */
export const unfurlLimiter = rateLimit({
  store: unfurlRedisStore, // Use Redis if available, otherwise in-memory
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Default: 10 requests per minute (will be adjusted by skip handler)
  message: 'Too many unfurl requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Check if user is authenticated/admin and adjust limit dynamically
    // Note: express-rate-limit doesn't support dynamic max, so we use skip
    // For now, we'll use a conservative limit for all users
    // Can be enhanced later with custom store for per-user limits
    return false; // Don't skip - apply limit to all
  },
  handler: (req, res) => {
    const resetTime = (req as any).rateLimit?.resetTime || Date.now() + 60000;
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many unfurl requests. Please try again later.',
      retryAfter: Math.max(1, retryAfter),
    });
  }
});

/**
 * Rate limiter for AI endpoints
 * Prevents Gemini API quota exhaustion and DoS attacks
 * 10 requests per minute per IP
 * 
 * Audit Phase-1 Fix: Added to protect expensive AI operations
 * Uses Redis store if available for distributed rate limiting
 */
export const aiLimiter = rateLimit({
  store: aiRedisStore, // Use Redis if available, otherwise in-memory
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  message: 'Too many AI requests. Please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    const resetTime = (req as any).rateLimit?.resetTime || Date.now() + 60000;
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many AI requests. Please try again later.',
      retryAfter: Math.max(1, retryAfter),
    });
  }
});

/**
 * Gracefully close Redis connection on shutdown
 * Note: Uses shared Redis client, so this is handled by redisClient.ts
 * Kept for backward compatibility
 */
export async function closeRedisConnection(): Promise<void> {
  // Rate limiter uses shared Redis client, closing is handled by redisClient.ts
  // This function kept for backward compatibility
}