import { Router } from 'express';
import * as moderationController from '../controllers/moderationController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

// Public route - anyone can create a report
router.post('/reports', moderationController.createReport);

// Protected routes - require authentication
router.get('/reports', authenticateToken, moderationController.getReports);

// Admin-only routes - require admin role
router.post('/reports/:id/resolve', requireAdmin, moderationController.resolveReport);
router.post('/reports/:id/dismiss', requireAdmin, moderationController.dismissReport);
router.get('/content/:targetType/:targetId', requireAdmin, moderationController.getReportedContent);

export default router;










