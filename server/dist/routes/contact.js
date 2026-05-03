import { Router } from 'express';
import * as contactController from '../controllers/contactController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
const router = Router();
// Public route - anyone can submit a contact message
router.post('/', contactController.createContactMessage);
// Protected routes - require authentication (admin access)
router.get('/', authenticateToken, contactController.getContactMessages);
router.patch('/:id/status', authenticateToken, contactController.updateContactStatus);
router.delete('/:id', authenticateToken, contactController.deleteContactMessage);
export default router;
//# sourceMappingURL=contact.js.map