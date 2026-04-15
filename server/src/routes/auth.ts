import { Router } from 'express';
import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import {
  loginLimiter,
  signupLimiter,
  passwordResetLimiter,
  resendVerificationLimiter,
} from '../middleware/rateLimiter.js';

const router = Router();

// Request size limits - Add route-specific limit for auth (1mb for login/signup)
router.use(express.json({ limit: '1mb' }));

// ============================================================================
// PUBLIC ROUTES (with rate limiting)
// ============================================================================

// Authentication
router.post('/login', loginLimiter, authController.login);
router.post('/signup', signupLimiter, authController.signup);

// Token refresh (public - uses refresh token for auth)
router.post('/refresh', loginLimiter, authController.refreshAccessToken);

// Email verification (rate-limited)
router.get('/verify-email', passwordResetLimiter, authController.verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, authController.resendVerification);

// Password reset (rate-limited)
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

// ============================================================================
// PROTECTED ROUTES (require authentication)
// ============================================================================

// User profile
router.get('/me', authenticateToken, authController.getMe);

// Logout (single device) — intentionally public/idempotent. The controller
// extracts and best-effort invalidates any present token and always clears
// cookies. Requiring authenticateToken here would make expired-session users
// unable to sign out, leaving them "stuck" authenticated.
router.post('/logout', authController.logout);

// Logout all devices
router.post('/logout-all', authenticateToken, authController.logoutAll);

// Active sessions
router.get('/sessions', authenticateToken, authController.getSessions);

export default router;















