import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getAdminStats, verifyUserEmail } from '../controllers/adminController.js';

const router = Router();

// GET /api/admin/stats
router.get('/stats', authenticateToken, getAdminStats);

// PATCH /api/admin/users/:userId/verify-email - Manually verify a user's email
router.patch('/users/:userId/verify-email', requireAdmin, verifyUserEmail);

// AI key-status endpoint removed - AI creation system has been fully removed

export default router;













