import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdminRole } from '../middleware/requireAdminRole.js';
import {
  getAdminStats,
  verifyUserEmail,
  getMediaLimits,
  updateMediaLimits,
  getDisclaimerSettings,
  updateDisclaimerSettings
} from '../controllers/adminController.js';
import { exportTagMapping, importTagMapping } from '../controllers/adminTaggingController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/admin/stats
router.get('/stats', authenticateToken, requireAdminRole, getAdminStats);

// PATCH /api/admin/users/:userId/verify-email - Manually verify a user's email
router.patch('/users/:userId/verify-email', authenticateToken, requireAdminRole, verifyUserEmail);

// GET /api/admin/settings/media-limits - Get current media quota limits (admin only)
router.get('/settings/media-limits', authenticateToken, requireAdminRole, getMediaLimits);

// PATCH /api/admin/settings/media-limits - Update media quota limits (admin only)
router.patch('/settings/media-limits', authenticateToken, requireAdminRole, updateMediaLimits);

// GET /api/admin/settings/disclaimer - Get current disclaimer config (admin only)
router.get('/settings/disclaimer', authenticateToken, requireAdminRole, getDisclaimerSettings);

// PATCH /api/admin/settings/disclaimer - Update disclaimer config (admin only)
router.patch('/settings/disclaimer', authenticateToken, requireAdminRole, updateDisclaimerSettings);

// ── Bulk tag export/import (two-axis taxonomy) ─────────────────────────────
// GET  /api/admin/tagging/export  - Download XLSX with current + suggested tags
// POST /api/admin/tagging/import  - Upload reviewed XLSX to bulk-update tagIds
router.get('/tagging/export', authenticateToken, requireAdminRole, exportTagMapping);
router.post('/tagging/import', authenticateToken, requireAdminRole, upload.single('file'), importTagMapping);

export default router;













