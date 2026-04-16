import { Router } from 'express';
import * as searchController from '../controllers/searchController.js';

const router = Router();

// GET /api/search/suggest?q=...
router.get('/suggest', searchController.getSuggestions);

export default router;

