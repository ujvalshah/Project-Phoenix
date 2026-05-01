import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdminRole } from '../middleware/requireAdminRole.js';
import { adminMutationLimiter } from '../middleware/rateLimiter.js';
import {
  getAdminStats,
  verifyUserEmail,
  updateUserSearchCohort,
  getMediaLimits,
  updateMediaLimits,
  getDisclaimerSettings,
  updateDisclaimerSettings,
  getHomeMicroHeaderSettings,
  updateHomeMicroHeaderSettings,
  getMarketPulseMicroHeaderSettings,
  updateMarketPulseMicroHeaderSettings,
  suspendUser,
  banUser,
  activateUser,
  revokeUserSessions
} from '../controllers/adminController.js';
import { exportTagMapping, importTagMapping } from '../controllers/adminTaggingController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/admin/stats
router.get('/stats', authenticateToken, requireAdminRole, getAdminStats);

// PATCH /api/admin/users/:userId/verify-email - Manually verify a user's email
router.patch('/users/:userId/verify-email', authenticateToken, requireAdminRole, adminMutationLimiter, verifyUserEmail);
router.patch('/users/:userId/search-cohort', authenticateToken, requireAdminRole, adminMutationLimiter, updateUserSearchCohort);

// Account lifecycle (PR7b). All admin-only; mutate User.status and the
// AdminAuditLog. Suspend/ban additionally bump tokenVersion + revoke refresh
// tokens. Self-action is rejected with 400 CANNOT_MUTATE_SELF. Throttled per
// admin (PR9 / P1.6) so a runaway client cannot sweep the user base.
router.post('/users/:userId/suspend', authenticateToken, requireAdminRole, adminMutationLimiter, suspendUser);
router.post('/users/:userId/ban', authenticateToken, requireAdminRole, adminMutationLimiter, banUser);
router.post('/users/:userId/activate', authenticateToken, requireAdminRole, adminMutationLimiter, activateUser);
router.post('/users/:userId/revoke-sessions', authenticateToken, requireAdminRole, adminMutationLimiter, revokeUserSessions);

// GET /api/admin/settings/media-limits - Get current media quota limits (admin only)
router.get('/settings/media-limits', authenticateToken, requireAdminRole, getMediaLimits);

// PATCH /api/admin/settings/media-limits - Update media quota limits (admin only)
router.patch('/settings/media-limits', authenticateToken, requireAdminRole, adminMutationLimiter, updateMediaLimits);

// GET /api/admin/settings/disclaimer - Get current disclaimer config (admin only)
router.get('/settings/disclaimer', authenticateToken, requireAdminRole, getDisclaimerSettings);

// PATCH /api/admin/settings/disclaimer - Update disclaimer config (admin only)
router.patch('/settings/disclaimer', authenticateToken, requireAdminRole, adminMutationLimiter, updateDisclaimerSettings);

// GET /api/admin/settings/home-micro-header - Get homepage micro-header copy (admin only)
router.get('/settings/home-micro-header', authenticateToken, requireAdminRole, getHomeMicroHeaderSettings);

// PATCH /api/admin/settings/home-micro-header - Update homepage micro-header copy (admin only)
router.patch('/settings/home-micro-header', authenticateToken, requireAdminRole, adminMutationLimiter, updateHomeMicroHeaderSettings);

// GET /api/admin/settings/market-pulse-micro-header - Get Market Pulse micro-header copy (admin only)
router.get('/settings/market-pulse-micro-header', authenticateToken, requireAdminRole, getMarketPulseMicroHeaderSettings);

// PATCH /api/admin/settings/market-pulse-micro-header - Update Market Pulse micro-header copy (admin only)
router.patch('/settings/market-pulse-micro-header', authenticateToken, requireAdminRole, adminMutationLimiter, updateMarketPulseMicroHeaderSettings);

// ── Bulk tag export/import (two-axis taxonomy) ─────────────────────────────
// GET  /api/admin/tagging/export  - Download XLSX with current + suggested tags
// POST /api/admin/tagging/import  - Upload reviewed XLSX to bulk-update tagIds
router.get('/tagging/export', authenticateToken, requireAdminRole, exportTagMapping);
router.post('/tagging/import', authenticateToken, requireAdminRole, adminMutationLimiter, upload.single('file'), importTagMapping);

export default router;













