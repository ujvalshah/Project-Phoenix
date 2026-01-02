import { Router } from 'express';
import express from 'express';
import { publishBatch } from '../controllers/batchController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = Router();

// Audit Phase-2 Fix: Add smaller JSON limit for batch routes (5mb instead of global 10mb)
router.use(express.json({ limit: '5mb' }));

/**
 * POST /api/batch/publish
 * 
 * Publish multiple draft nuggets by setting their visibility to 'public'
 * 
 * Requires authentication
 */
router.post('/publish', authenticateToken, publishBatch);

export default router;






