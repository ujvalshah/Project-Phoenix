
import { Router } from 'express';
import * as legalController from '../controllers/legalController';

const router = Router();

router.get('/', legalController.getLegalPages);
router.get('/:slug', legalController.getLegalPageBySlug);

export default router;
