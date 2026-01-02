import { Request, Response } from 'express';
import { z } from 'zod';
import { verifyToken } from '../utils/jwt.js';
import { fetchUrlMetadata } from '../services/metadata.js';
import { isUrlSafeForFetch } from '../utils/ssrfProtection.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

// Audit Phase-1 Fix: Zod validation schema for unfurl request body
const unfurlUrlSchema = z.object({
  url: z.string().url('Invalid URL format').refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    'Only http and https URLs are allowed'
  )
});

/**
 * POST /api/unfurl
 * 
 * Unfurl a URL and return normalized metadata.
 * 
 * Body: { url: string }
 * 
 * Returns: Nugget (normalized metadata)
 * 
 * NEVER throws - always returns a valid Nugget, even if it's a fallback.
 * 
 * Authentication: Optional (admin users get Microlink access)
 */
export async function unfurlUrl(req: Request, res: Response) {
  try {
    // Audit Phase-1 Fix: Zod validation for request body
    const validationResult = unfurlUrlSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        message: validationResult.error.errors[0].message,
        errors: validationResult.error.errors
      });
    }

    const { url } = validationResult.data;

    // SECURITY: SSRF Protection - Block internal/private IPs and cloud metadata endpoints
    const ssrfCheck = isUrlSafeForFetch(url);
    if (!ssrfCheck.safe) {
      return res.status(400).json({
        error: 'URL not allowed',
        message: ssrfCheck.reason || 'URL validation failed',
      });
    }

    // Check if user is admin (for Microlink access)
    // Authentication is optional - silently check if token exists
    let isAdmin = false;
    const authHeader = req.headers['authorization'];
    
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (token) {
          const decoded = verifyToken(token);
          isAdmin = decoded.role === 'admin';
        }
      } catch {
        // Invalid token - treat as non-admin, continue silently
      }
    }

    // Fetch metadata with tiered waterfall strategy
    const nugget = await fetchUrlMetadata(url, { isAdmin });

    // Return normalized Nugget
    res.json(nugget);
  } catch (error: any) {
    // This should never happen, but if it does, return a fallback
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.id, req.path);
    requestLogger.error({
      msg: '[Unfurl] Unexpected error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });

    // Create a minimal fallback
    // CRITICAL: Do not generate titles for non-Social/Video content types
    // Articles should have null title (user must provide)
    const fallback = {
      id: `nugget-${Date.now()}`,
      url: req.body?.url || 'unknown',
      domain: 'unknown',
      contentType: 'article' as const,
      title: undefined, // No auto-generated title for articles
      source: {
        name: 'Unknown',
        domain: 'unknown',
      },
      quality: 'fallback' as const,
    };

    res.json(fallback);
  }
}

