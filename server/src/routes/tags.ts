import { Router } from 'express';
import * as tagsController from '../controllers/tagsController.js';
import * as categoriesController from '../controllers/categoriesController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

// GET /api/categories - Returns tag frequency counts (legacy endpoint name, uses tags)
router.get('/', categoriesController.getCategories);

// POST /api/categories - Create a tag (legacy endpoint name, uses tags)
router.post('/', authenticateToken, tagsController.createTag);

// PUT /api/categories/:id - Update a tag (legacy endpoint name, uses tags)
router.put('/:id', authenticateToken, tagsController.updateTag);

// DELETE /api/categories/:name - Delete a tag (legacy endpoint name, uses tags)
router.delete('/:name', authenticateToken, tagsController.deleteTag);

// POST /api/categories/sync - Sync article tags to Tags collection (admin only)
router.post('/sync', authenticateToken, tagsController.syncArticleTags);

// POST /api/categories/resolve - Resolve tagIds to tag names (Phase 2+)
router.post('/resolve', tagsController.resolveTags);

export default router;


