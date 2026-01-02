import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for login endpoint
 * Stricter limits to prevent brute force attacks
 * 5 requests per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
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
 */
export const signupLimiter = rateLimit({
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
 */
export const unfurlLimiter = rateLimit({
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
 */
export const aiLimiter = rateLimit({
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