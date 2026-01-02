import { Router } from 'express';
import * as usersController from '../controllers/usersController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

router.get('/', usersController.getUsers);
router.get('/:id', usersController.getUserById);
router.put('/:id', authenticateToken, usersController.updateUser);
router.delete('/:id', authenticateToken, usersController.deleteUser);
router.get('/:id/feed', authenticateToken, usersController.getPersonalizedFeed);

export default router;
