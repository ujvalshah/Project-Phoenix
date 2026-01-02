import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { getAdminStats } from '../controllers/adminController.js';
import { getKeyStatusController } from '../controllers/aiController.js';

const router = Router();

// GET /api/admin/stats
router.get('/stats', authenticateToken, getAdminStats);

// GET /api/admin/key-status
// Returns Gemini API key status for dashboard widget
router.get('/key-status', getKeyStatusController);

export default router;












