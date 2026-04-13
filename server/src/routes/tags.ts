import { Router } from 'express';
import * as tagsController from '../controllers/tagsController.js';
import * as categoriesController from '../controllers/categoriesController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

// GET /api/categories/taxonomy - Returns two-axis tag taxonomy (format + domain tree)
// Must be registered BEFORE the /:id route to avoid being treated as an ID
router.get('/taxonomy', tagsController.getTagTaxonomy);

// GET /api/categories/taxonomy/coverage - Dimension coverage stats across all articles
router.get('/taxonomy/coverage', tagsController.getTaxonomyCoverage);

// POST /api/categories/taxonomy/reorder - Bulk-update sortOrder for dimension tags
router.post('/taxonomy/reorder', authenticateToken, tagsController.reorderTaxonomy);

// GET /api/categories - Returns tag frequency counts (legacy endpoint name, uses tags)
router.get('/', categoriesController.getCategories);

// POST /api/categories - Create a tag (legacy endpoint name, uses tags)
router.post('/', authenticateToken, tagsController.createTag);

// PUT /api/categories/:id - Update a tag (legacy endpoint name, uses tags)
router.put('/:id', authenticateToken, tagsController.updateTag);

// DELETE /api/categories/by-id/:id - Soft-delete a tag by ID (sets status='deprecated')
// Used by the AdminTaggingPage inline editor — safe for dimension tags because
// it preserves the Tag doc so existing Article.tagIds references still resolve.
// Must be registered BEFORE the /:name route so "by-id" is not interpreted as a name.
router.delete('/by-id/:id', authenticateToken, tagsController.softDeleteTagById);

// DELETE /api/categories/:name - Hard delete a tag by name (legacy)
router.delete('/:name', authenticateToken, tagsController.deleteTag);

// POST /api/categories/sync - Sync article tags to Tags collection (admin only)
router.post('/sync', authenticateToken, tagsController.syncArticleTags);

// POST /api/categories/resolve - Resolve tagIds to tag names (Phase 2+)
router.post('/resolve', tagsController.resolveTags);

export default router;


