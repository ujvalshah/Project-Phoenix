import { Router } from 'express';
import * as collectionsController from '../controllers/collectionsController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

// Public routes
router.get('/featured', collectionsController.getFeaturedCollections);
router.get('/', collectionsController.getCollections);
router.get('/:id', collectionsController.getCollectionById);
router.get('/:id/articles', collectionsController.getCollectionArticles);

// Collection CRUD
router.post('/', authenticateToken, collectionsController.createCollection);
router.put('/:id', authenticateToken, collectionsController.updateCollection);
router.delete('/:id', authenticateToken, collectionsController.deleteCollection);
router.patch('/featured/reorder', authenticateToken, collectionsController.reorderFeatured);
router.patch('/:id/featured', authenticateToken, collectionsController.setFeatured);

// Entries
router.post('/:id/entries', authenticateToken, collectionsController.addEntry);
router.post('/:id/entries/batch', authenticateToken, collectionsController.addBatchEntries);
router.post('/:id/entries/batch/remove', authenticateToken, collectionsController.removeBatchEntries);
router.delete('/:id/entries/:articleId', authenticateToken, collectionsController.removeEntry);
router.post('/:id/entries/:articleId/flag', authenticateToken, collectionsController.flagEntry);

// Follow/Unfollow
router.post('/:id/follow', authenticateToken, collectionsController.followCollection);
router.post('/:id/unfollow', authenticateToken, collectionsController.unfollowCollection);

export default router;
