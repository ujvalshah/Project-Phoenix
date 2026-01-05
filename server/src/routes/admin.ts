import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { getAdminStats } from '../controllers/adminController.js';

const router = Router();

// GET /api/admin/stats
router.get('/stats', authenticateToken, getAdminStats);

// AI key-status endpoint removed - AI creation system has been fully removed

export default router;













