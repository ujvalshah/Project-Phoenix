/**
 * AI Routes - YouTube Video Intelligence Extraction
 * 
 * Dedicated routes for AI-powered content analysis.
 * Separated from batch processing for clean architecture.
 * 
 * Endpoints:
 * - POST /api/ai/process-youtube - Process YouTube video (cache-first)
 * - POST /api/ai/extract-intelligence - Extract NuggetIntelligence
 * - POST /api/ai/summarize - Text summarization (legacy)
 * - POST /api/ai/takeaways - Generate takeaways (legacy)
 * - GET /api/ai/admin/key-status - API key status
 * - POST /api/ai/admin/reset-keys - Reset exhausted keys
 */

import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ============================================================================
// MAIN AI ENDPOINTS
// ============================================================================

/**
 * POST /api/ai/process-youtube
 * 
 * Process a YouTube video with CACHE-FIRST logic:
 * 1. Check MongoDB for existing processed video
 * 2. If found, return cached nugget (cacheHit: true)
 * 3. If not found, call Gemini and save as 'ai-draft'
 * 
 * Requires authentication.
 * 
 * Audit Phase-1 Fix: Rate limited to prevent API quota exhaustion
 */
router.post('/process-youtube', authenticateToken, aiLimiter, aiController.processYouTube);

/**
 * POST /api/ai/extract-intelligence
 * 
 * Extracts NuggetIntelligence using native multimodal (Gemini watches video)
 * CACHE-FIRST: Checks database before calling Gemini API.
 * 
 * Audit Phase-1 Fix: Rate limited to prevent API quota exhaustion
 */
router.post('/extract-intelligence', aiLimiter, aiController.extractIntelligence);

// ============================================================================
// LEGACY ENDPOINTS (Backward Compatibility)
// ============================================================================

/**
 * POST /api/ai/analyze-youtube
 * @deprecated Use /process-youtube or /extract-intelligence instead
 */
router.post('/analyze-youtube', aiController.analyzeYouTubeVideo);

/**
 * POST /api/ai/summarize
 * Summarize text into a Nugget format
 */
router.post('/summarize', aiController.summarizeText);

/**
 * POST /api/ai/takeaways
 * Generate takeaways from text
 */
router.post('/takeaways', aiController.generateTakeaways);

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * GET /api/ai/admin/key-status
 * Returns Gemini API key pool status for dashboard widget
 */
router.get('/admin/key-status', aiController.getKeyStatusController);

/**
 * POST /api/ai/admin/reset-keys
 * Manually reset all exhausted API keys
 */
router.post('/admin/reset-keys', aiController.resetKeysController);

export default router;







