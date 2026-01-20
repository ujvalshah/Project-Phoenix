/**
 * Middleware to enforce email verification for specific actions
 *
 * Soft Enforcement Strategy:
 * - Users can browse, read, and view content without verification
 * - Actions that create/modify content require verification:
 *   - Creating articles/nuggets
 *   - Commenting
 *   - Following users
 *   - Updating profile (except avatar)
 *
 * Usage:
 *   router.post('/articles', authenticateToken, requireEmailVerified, createArticle);
 */

import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.js';
import { sendForbiddenError } from '../utils/errorResponse.js';
import { createRequestLogger } from '../utils/logger.js';

/**
 * Middleware that requires email verification for the current user
 * Must be used AFTER authenticateToken middleware
 */
export async function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).user?.userId;

  if (!userId) {
    sendForbiddenError(res, 'Authentication required');
    return;
  }

  try {
    // Fetch user to check emailVerified status
    const user = await User.findById(userId).select('auth.emailVerified auth.provider').lean();

    if (!user) {
      sendForbiddenError(res, 'User not found');
      return;
    }

    // Social auth users (Google, LinkedIn) are considered verified
    if (user.auth.provider !== 'email') {
      next();
      return;
    }

    // Check if email is verified
    if (!user.auth.emailVerified) {
      const requestLogger = createRequestLogger(req.id || 'unknown', userId, req.path);
      requestLogger.info({
        msg: 'Blocked unverified user action',
        action: `${req.method} ${req.path}`,
      });

      res.status(403).json({
        error: true,
        message: 'Please verify your email to perform this action',
        code: 'EMAIL_NOT_VERIFIED',
        action: 'verify_email',
      });
      return;
    }

    next();
  } catch (error: any) {
    const requestLogger = createRequestLogger(req.id || 'unknown', userId, req.path);
    requestLogger.error({
      msg: 'Email verification check failed',
      err: { message: error.message },
    });
    sendForbiddenError(res, 'Unable to verify email status');
  }
}

/**
 * Optional middleware that adds emailVerified status to request
 * Does NOT block the request, just enriches it
 * Useful for conditional logic in controllers
 */
export async function enrichEmailStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).user?.userId;

  if (!userId) {
    (req as any).emailVerified = false;
    next();
    return;
  }

  try {
    const user = await User.findById(userId).select('auth.emailVerified auth.provider').lean();

    if (!user) {
      (req as any).emailVerified = false;
    } else if (user.auth.provider !== 'email') {
      // Social auth users are considered verified
      (req as any).emailVerified = true;
    } else {
      (req as any).emailVerified = user.auth.emailVerified;
    }

    next();
  } catch (error) {
    (req as any).emailVerified = false;
    next();
  }
}
