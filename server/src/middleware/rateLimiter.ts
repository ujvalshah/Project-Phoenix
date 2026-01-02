import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

/**
 * Redis client for distributed rate limiting
 * Only initialized if REDIS_URL is configured
 */
let redisClient: ReturnType<typeof createClient> | null = null;
let redisStore: RedisStore | undefined = undefined;

// Initialize Redis client if REDIS_URL is provided
if (process.env.REDIS_URL) {
  try {
    redisClient = createClient({ url: process.env.REDIS_URL });
    
    // Handle connection errors
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    // Connect to Redis (non-blocking)
    redisClient.connect().catch((err) => {
      console.error('Failed to connect to Redis:', err);
      redisClient = null;
    });
    
    // Create Redis store for rate limiting
    // RedisStore expects a function that sends commands to Redis
    // Using sendCommand method compatible with Redis v5 client API
    redisStore = new RedisStore({
      sendCommand: (...args: string[]) => {
        if (!redisClient) {
          throw new Error('Redis client not available');
        }
        return redisClient.sendCommand(args);
      },
    });
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    redisClient = null;
    redisStore = undefined;
  }
}

/**
 * Rate limiter for login endpoint
 * Stricter limits to prevent brute force attacks
 * 5 requests per 15 minutes per IP
 * Uses Redis store if available for distributed rate limiting
 */
export const loginLimiter = rateLimit({
  store: redisStore, // Use Redis if available, otherwise in-memory
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
  store: redisStore, // Use Redis if available, otherwise in-memory
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
 * Rate limiter for unfurl endpoint
 * Prevents DoS attacks and resource exhaustion
 * Tiered limits:
 * - Unauthenticated: 10 requests per minute
 * - Authenticated: 30 requests per minute
 * - Admin: 100 requests per minute (for Microlink testing)
 * Uses Redis store if available for distributed rate limiting
 */
export const unfurlLimiter = rateLimit({
  store: redisStore, // Use Redis if available, otherwise in-memory
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
  store: redisStore, // Use Redis if available, otherwise in-memory
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
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      redisStore = undefined;
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
}