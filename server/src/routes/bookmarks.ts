import { Router } from 'express';
import * as bookmarksController from '../controllers/bookmarksController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

/**
 * Bookmark Routes
 *
 * All routes require authentication.
 * Core bookmark CRUD operations.
 */

const router = Router();

// All bookmark routes require authentication
router.use(authenticateToken);
router.use(requireEmailVerified);

// POST /api/bookmarks/toggle - Toggle bookmark (create/delete in one endpoint)
router.post('/toggle', bookmarksController.toggleBookmark);

// POST /api/bookmarks/batch-toggle - Batch toggle multiple bookmarks
router.post('/batch-toggle', bookmarksController.batchToggle);

// POST /api/bookmarks/assign - Assign bookmark to collections
router.post('/assign', bookmarksController.assignToCollections);

// POST /api/bookmarks/status/batch - Get batch bookmark status
router.post('/status/batch', bookmarksController.getBatchStatus);

// GET /api/bookmarks/status/:itemId - Get bookmark status for specific item
router.get('/status/:itemId', bookmarksController.getStatus);

// GET /api/bookmarks - Get user's bookmarks (with optional filters)
router.get('/', bookmarksController.getBookmarks);

// DELETE /api/bookmarks/:bookmarkId - Delete a specific bookmark
router.delete('/:bookmarkId', bookmarksController.deleteBookmark);

export default router;
