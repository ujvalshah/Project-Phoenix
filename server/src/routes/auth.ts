import { Router } from 'express';
import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { loginLimiter, signupLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Audit Phase-3 Fix: Request size limits - Add route-specific limit for auth (1mb for login/signup)
router.use(express.json({ limit: '1mb' }));

// Public routes with rate limiting
router.post('/login', loginLimiter, authController.login);
router.post('/signup', signupLimiter, authController.signup);

// Protected route (requires authentication middleware)
router.get('/me', authenticateToken, authController.getMe);

export default router;












