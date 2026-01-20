import express from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import { uploadMedia, linkMedia, deleteMedia, getMedia, upload } from '../controllers/mediaController.js';

const router = express.Router();

/**
 * Media Routes
 * All write routes require authentication + email verification
 */

// Upload media (requires auth + email verification)
router.post(
  '/upload/cloudinary',
  authenticateToken,
  requireEmailVerified,
  upload.single('file'),
  uploadMedia
);

// Get media by ID (auth only)
router.get('/:mediaId', authenticateToken, getMedia);

// Link media to entity (requires auth + email verification)
router.post('/:mediaId/link', authenticateToken, requireEmailVerified, linkMedia);

// Delete media (requires auth + email verification)
router.delete('/:mediaId', authenticateToken, requireEmailVerified, deleteMedia);

export default router;








