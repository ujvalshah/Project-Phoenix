import { Router } from 'express';
import { unfurlUrl } from '../controllers/unfurlController.js';
import { unfurlLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * POST /api/unfurl
 * 
 * Unfurl a URL and return normalized metadata.
 * 
 * Authentication: Optional (admin users get Microlink access)
 * Rate Limit: 10 requests per minute per IP
 * 
 * Body: {
 *   url: string
 * }
 * 
 * Returns: Nugget (normalized metadata schema)
 */
// Rate limiting applied to prevent DoS attacks
router.post('/', unfurlLimiter, unfurlUrl);

export default router;

