import { Router, Request, Response, NextFunction } from 'express';
import * as usersController from '../controllers/usersController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdminRole } from '../middleware/requireAdminRole.js';
import { adminMutationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

function adminMutationLimiterIfAdmin(req: Request, res: Response, next: NextFunction) {
  const role = (req as { user?: { role?: string } }).user?.role;
  if (role !== 'admin') return next();
  return adminMutationLimiter(req, res, next);
}

// Admin-only: full user listing and full user record by id
router.get('/', authenticateToken, requireAdminRole, usersController.getUsers);
// Public profile (no email) — must be registered before /:id
router.get('/public/:id', usersController.getPublicUserProfile);
router.get('/:id', authenticateToken, requireAdminRole, usersController.getUserById);
router.put('/:id', authenticateToken, adminMutationLimiterIfAdmin, usersController.updateUser);
router.delete('/:id', authenticateToken, adminMutationLimiterIfAdmin, usersController.deleteUser);
router.get('/:id/feed', authenticateToken, usersController.getPersonalizedFeed);

export default router;
