import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import * as legalController from '../controllers/legalController.js';

const router = Router();

// Admin-only routes — requires authentication + admin role
router.patch('/:slug', authenticateToken, requireAdmin, legalController.updateLegalPage);

export default router;
