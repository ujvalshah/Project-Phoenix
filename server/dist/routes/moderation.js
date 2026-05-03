import { Router } from 'express';
import * as moderationController from '../controllers/moderationController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdminRole } from '../middleware/requireAdminRole.js';
const router = Router();
// Public route - anyone can create a report
router.post('/reports', moderationController.createReport);
// Protected routes - require authentication
router.get('/reports', authenticateToken, moderationController.getReports);
// Admin-only routes - require admin role (authenticateToken first for blacklist check)
router.post('/reports/:id/resolve', authenticateToken, requireAdminRole, moderationController.resolveReport);
router.post('/reports/:id/dismiss', authenticateToken, requireAdminRole, moderationController.dismissReport);
router.get('/content/:targetType/:targetId', authenticateToken, requireAdminRole, moderationController.getReportedContent);
export default router;
//# sourceMappingURL=moderation.js.map