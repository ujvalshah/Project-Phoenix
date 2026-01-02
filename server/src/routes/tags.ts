import { Router } from 'express';
import * as tagsController from '../controllers/tagsController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

// GET /api/categories - Get all categories (public)
router.get('/', tagsController.getTags);

// POST /api/categories - Add a new category (requires authentication)
router.post('/', authenticateToken, tagsController.createTag);

// PUT /api/categories/:id - Update a tag (requires authentication)
router.put('/:id', authenticateToken, tagsController.updateTag);

// DELETE /api/categories/:name - Delete a category (requires authentication)
router.delete('/:name', authenticateToken, tagsController.deleteTag);

export default router;


