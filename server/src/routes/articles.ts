import { Router, Request, Response } from 'express';
import * as articlesController from '../controllers/articlesController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

const router = Router();

// GET /api/articles - Get all articles (optionally filtered by authorId via query param)
router.get('/', articlesController.getArticles);

// GET /api/articles/my/counts - Get counts for current user's articles (requires authentication)
// NOTE: This route must come BEFORE /:id route to ensure proper matching
router.get('/my/counts', authenticateToken, articlesController.getMyArticleCounts);

// GET /api/articles/:id - Get specific article
router.get('/:id', articlesController.getArticleById);

// POST /api/articles - Create new article (requires auth + email verification)
router.post('/', authenticateToken, requireEmailVerified, articlesController.createArticle);

// PUT /api/articles/:id - Update article (requires auth + email verification)
router.put('/:id', authenticateToken, requireEmailVerified, articlesController.updateArticle);

// PATCH /api/articles/:id - Partial update article (requires auth + email verification)
router.patch('/:id', authenticateToken, requireEmailVerified, articlesController.updateArticle);

// OPTIONS handler for DELETE /api/articles/:id/images (CORS preflight)
// This must come BEFORE the DELETE route to handle preflight requests
router.options('/:id/images', (req: Request, res: Response) => {
  // CORS middleware will add headers, but we explicitly set them here for clarity
  // The cors middleware in index.ts should handle this, but explicit is better
  res.status(204).send();
});

// DELETE /api/articles/:id/images - Delete a specific image from article (requires auth + email verification)
// NOTE: This route must come BEFORE /:id route to ensure proper matching
router.delete('/:id/images', authenticateToken, requireEmailVerified, articlesController.deleteArticleImage);

// DELETE /api/articles/:id - Delete article (requires auth + email verification)
router.delete('/:id', authenticateToken, requireEmailVerified, articlesController.deleteArticle);

export default router;
