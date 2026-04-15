import { Router, Request, Response } from 'express';
import * as articlesController from '../controllers/articlesController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

// GET /api/articles - Get all articles (optionally filtered by authorId via query param)
router.get('/', articlesController.getArticles);

// GET /api/articles/my/counts - Get counts for current user's articles (requires authentication)
// NOTE: This route must come BEFORE /:id route to ensure proper matching
router.get('/my/counts', authenticateToken, articlesController.getMyArticleCounts);

// GET /api/articles/pulse/unseen-count - Count of Pulse nuggets the user hasn't seen yet
// POST /api/articles/pulse/mark-seen - Reset that counter by bumping lastSeenPulseAt
// NOTE: These routes must come BEFORE /:id route to ensure proper matching
router.get('/pulse/unseen-count', authenticateToken, articlesController.getPulseUnseenCount);
router.post('/pulse/mark-seen', authenticateToken, articlesController.markPulseSeen);
router.get('/standard/unseen-count', authenticateToken, articlesController.getStandardUnseenCount);
router.post('/standard/mark-seen', authenticateToken, articlesController.markStandardSeen);

// GET /api/articles/:id - Get specific article
router.get('/:id', articlesController.getArticleById);

// POST /api/articles - Create new article
router.post('/', authenticateToken, articlesController.createArticle);

// PUT /api/articles/:id - Update article
router.put('/:id', authenticateToken, articlesController.updateArticle);

// PATCH /api/articles/:id - Partial update article
router.patch('/:id', authenticateToken, articlesController.updateArticle);

// OPTIONS handler for DELETE /api/articles/:id/images (CORS preflight)
router.options('/:id/images', (req: Request, res: Response) => {
  res.status(204).send();
});

// DELETE /api/articles/:id/images - Delete a specific image from article
// NOTE: This route must come BEFORE /:id route to ensure proper matching
router.delete('/:id/images', authenticateToken, articlesController.deleteArticleImage);

// DELETE /api/articles/:id - Delete article
router.delete('/:id', authenticateToken, articlesController.deleteArticle);

export default router;
