import { Router } from 'express';
import * as bookmarkFoldersController from '../controllers/bookmarkFoldersController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

// All routes require authentication
router.get('/', authenticateToken, bookmarkFoldersController.getBookmarkFolders);
router.post('/', authenticateToken, bookmarkFoldersController.createBookmarkFolder);
router.patch('/:id', authenticateToken, bookmarkFoldersController.updateBookmarkFolder);
router.delete('/:id', authenticateToken, bookmarkFoldersController.deleteBookmarkFolder);

// Bookmark-folder links
router.post('/links', authenticateToken, bookmarkFoldersController.addBookmarkToFolders);
router.delete('/links', authenticateToken, bookmarkFoldersController.removeBookmarkFromFolder);

// Bookmarks by folder
router.get('/bookmarks', authenticateToken, bookmarkFoldersController.getBookmarksByFolder);
router.post('/bookmarks', authenticateToken, bookmarkFoldersController.createBookmark);
router.delete('/bookmarks/:nuggetId', authenticateToken, bookmarkFoldersController.deleteBookmark);
router.get('/bookmarks/:nuggetId/folders', authenticateToken, bookmarkFoldersController.getBookmarkFoldersForNugget);

export default router;

