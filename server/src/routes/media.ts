import express from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { uploadMedia, linkMedia, deleteMedia, getMedia, upload } from '../controllers/mediaController.js';

const router = express.Router();

/**
 * Media Routes
 * All routes require authentication
 */

// Upload media
router.post(
  '/upload/cloudinary',
  authenticateToken,
  upload.single('file'),
  uploadMedia
);

// Get media by ID
router.get('/:mediaId', authenticateToken, getMedia);

// Link media to entity
router.post('/:mediaId/link', authenticateToken, linkMedia);

// Delete media
router.delete('/:mediaId', authenticateToken, deleteMedia);

export default router;





