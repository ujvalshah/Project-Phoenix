import { Router } from 'express';
import * as collectionsController from '../controllers/collectionsController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

router.get('/', collectionsController.getCollections);
router.get('/:id', collectionsController.getCollectionById);
router.post('/', authenticateToken, collectionsController.createCollection);
router.put('/:id', authenticateToken, collectionsController.updateCollection);
router.delete('/:id', authenticateToken, collectionsController.deleteCollection);

// Entries (all require authentication)
router.post('/:id/entries', authenticateToken, collectionsController.addEntry);
router.delete('/:id/entries/:articleId', authenticateToken, collectionsController.removeEntry);
router.post('/:id/entries/:articleId/flag', authenticateToken, collectionsController.flagEntry);

// Follow/Unfollow (require authentication)
router.post('/:id/follow', authenticateToken, collectionsController.followCollection);
router.post('/:id/unfollow', authenticateToken, collectionsController.unfollowCollection);

export default router;
