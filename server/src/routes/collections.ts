import { Router } from 'express';
import * as collectionsController from '../controllers/collectionsController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

const router = Router();

// Public routes
router.get('/', collectionsController.getCollections);
router.get('/:id', collectionsController.getCollectionById);

// Collection CRUD (requires auth + email verification)
router.post('/', authenticateToken, requireEmailVerified, collectionsController.createCollection);
router.put('/:id', authenticateToken, requireEmailVerified, collectionsController.updateCollection);
router.delete('/:id', authenticateToken, requireEmailVerified, collectionsController.deleteCollection);

// Entries (requires auth + email verification)
router.post('/:id/entries', authenticateToken, requireEmailVerified, collectionsController.addEntry);
router.delete('/:id/entries/:articleId', authenticateToken, requireEmailVerified, collectionsController.removeEntry);
router.post('/:id/entries/:articleId/flag', authenticateToken, requireEmailVerified, collectionsController.flagEntry);

// Follow/Unfollow (auth only - allow unverified users to follow)
router.post('/:id/follow', authenticateToken, collectionsController.followCollection);
router.post('/:id/unfollow', authenticateToken, collectionsController.unfollowCollection);

export default router;
