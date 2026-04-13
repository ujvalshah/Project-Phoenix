import { Router } from 'express';
import * as usersController from '../controllers/usersController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdminRole } from '../middleware/requireAdminRole.js';

const router = Router();

// Admin-only: full user listing and full user record by id
router.get('/', authenticateToken, requireAdminRole, usersController.getUsers);
// Public profile (no email) — must be registered before /:id
router.get('/public/:id', usersController.getPublicUserProfile);
router.get('/:id', authenticateToken, requireAdminRole, usersController.getUserById);
router.put('/:id', authenticateToken, usersController.updateUser);
router.delete('/:id', authenticateToken, usersController.deleteUser);
router.get('/:id/feed', authenticateToken, usersController.getPersonalizedFeed);

export default router;
