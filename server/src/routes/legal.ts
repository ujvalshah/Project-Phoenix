import { Router } from 'express';
import * as legalController from '../controllers/legalController.js';

const router = Router();

// Public routes — no authentication required
router.get('/', legalController.getLegalPages);
router.get('/:slug', legalController.getLegalPageBySlug);

export default router;
