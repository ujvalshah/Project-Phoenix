import { Router } from 'express';
import * as bookmarkCollectionsController from '../controllers/bookmarkCollectionsController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

/**
 * Bookmark Collection Routes
 *
 * All routes require authentication.
 * Manages user's bookmark collections/folders.
 */

const router = Router();

// All collection routes require authentication
router.use(authenticateToken);
router.use(requireEmailVerified);

// PUT /api/bookmark-collections/reorder - Reorder collections (drag and drop)
// NOTE: This route must come BEFORE /:id to ensure proper matching
router.put('/reorder', bookmarkCollectionsController.reorderCollections);

// GET /api/bookmark-collections - Get all user's collections
router.get('/', bookmarkCollectionsController.getCollections);

// POST /api/bookmark-collections - Create a new collection
router.post('/', bookmarkCollectionsController.createCollection);

// GET /api/bookmark-collections/:id - Get a specific collection
router.get('/:id', bookmarkCollectionsController.getCollectionById);

// PUT /api/bookmark-collections/:id - Update a collection
router.put('/:id', bookmarkCollectionsController.updateCollection);

// DELETE /api/bookmark-collections/:id - Delete a collection
router.delete('/:id', bookmarkCollectionsController.deleteCollection);

// DELETE /api/bookmark-collections/:collectionId/bookmarks/:bookmarkId - Remove bookmark from collection
router.delete('/:collectionId/bookmarks/:bookmarkId', bookmarkCollectionsController.removeBookmark);

// POST /api/bookmark-collections/:id/recalculate - Recalculate bookmark count (maintenance)
router.post('/:id/recalculate', bookmarkCollectionsController.recalculateCount);

export default router;
