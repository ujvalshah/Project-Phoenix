import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdminRole } from '../middleware/requireAdminRole.js';
import * as legalController from '../controllers/legalController.js';
const router = Router();
// Admin-only routes — requires authentication + admin role
router.patch('/:slug', authenticateToken, requireAdminRole, legalController.updateLegalPage);
export default router;
//# sourceMappingURL=adminLegal.js.map