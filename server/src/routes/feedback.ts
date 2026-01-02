import { Router } from 'express';
import * as feedbackController from '../controllers/feedbackController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

// Public route - anyone can submit feedback
router.post('/', feedbackController.createFeedback);

// Protected routes - require authentication (admin access)
router.get('/', authenticateToken, feedbackController.getFeedback);
router.patch('/:id/status', authenticateToken, feedbackController.updateFeedbackStatus);
router.delete('/:id', authenticateToken, feedbackController.deleteFeedback);

export default router;











