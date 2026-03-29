import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getVapidKey,
  subscribe,
  unsubscribe,
  getPreferences,
  updatePreferences,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  toggleNotifications,
  getNotificationStatus,
} from '../controllers/notificationsController.js';

const router = Router();

// Public — no auth needed (frontend needs this to subscribe)
router.get('/vapid-key', getVapidKey);

// Subscription management — requires auth
router.post('/subscribe', authenticateToken, subscribe);
router.post('/unsubscribe', authenticateToken, unsubscribe);

// Notification preferences — requires auth
router.get('/preferences', authenticateToken, getPreferences);
router.put('/preferences', authenticateToken, updatePreferences);

// In-app notification list — requires auth
router.get('/', authenticateToken, listNotifications);
router.get('/unread-count', authenticateToken, getUnreadCount);
router.patch('/:id/read', authenticateToken, markAsRead);
router.post('/read-all', authenticateToken, markAllAsRead);

// Admin kill switch — requires admin role
router.get('/admin/status', requireAdmin, getNotificationStatus);
router.put('/admin/toggle', requireAdmin, toggleNotifications);

export default router;
