import { apiClient } from './apiClient';
import { getServiceWorkerRegistration, resolveServiceWorkerRegistration } from '@/utils/serviceWorkerRegistration';
import type { NotificationFrequency } from '@/types/user';

// ── Types ──

export interface NotificationPreferences {
  pushEnabled: boolean;
  frequency: NotificationFrequency;
  categoryFilter: string[];
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string;
}

export function detectTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export interface InAppNotification {
  _id: string;
  userId: string;
  type: 'new_nugget' | 'digest' | 'system';
  title: string;
  body: string;
  data: { articleId?: string; batchIds?: string[]; url: string };
  read: boolean;
  // Channels attempted — not a guarantee of device-side receipt.
  attemptedVia: string[];
  createdAt: string;
}

interface PaginatedNotifications {
  data: InAppNotification[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ── Helpers ──

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ── VAPID Key ──

let cachedVapidKey: string | null = null;

export async function getVapidKey(): Promise<string | null> {
  if (cachedVapidKey) return cachedVapidKey;

  try {
    const response = await apiClient.get<{ configured: boolean; publicKey: string | null }>(
      '/notifications/vapid-key'
    );
    cachedVapidKey = response.publicKey;
    return cachedVapidKey;
  } catch {
    return null;
  }
}

// ── Push Subscription ──

export async function subscribeToPush(): Promise<boolean> {
  const vapidKey = await getVapidKey();
  if (!vapidKey) return false;

  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  await apiClient.post('/notifications/subscribe', {
    platform: 'web',
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64(subscription.getKey('auth')),
    },
  });

  // Capture the device's IANA zone so server-side quiet hours can be evaluated
  // against the user's wall clock rather than UTC. Best-effort — a failure here
  // must not break the subscribe flow.
  const tz = detectTimezone();
  if (tz) {
    try {
      await updatePreferences({ timezone: tz });
    } catch {
      // ignore
    }
  }

  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = getServiceWorkerRegistration() || await resolveServiceWorkerRegistration() || await navigator.serviceWorker.ready;
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await apiClient.post('/notifications/unsubscribe', { endpoint });
}

export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function isPushSubscribed(): Promise<boolean> {
  const registration = getServiceWorkerRegistration() || await resolveServiceWorkerRegistration() || await navigator.serviceWorker.ready;
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}

export async function getServerSubscriptionStatus(): Promise<{ hasSubscription: boolean; activeSubscriptions: number }> {
  return apiClient.get<{ hasSubscription: boolean; activeSubscriptions: number }>('/notifications/subscription-status');
}

// ── Preferences ──

export async function getPreferences(): Promise<NotificationPreferences> {
  return apiClient.get<NotificationPreferences>('/notifications/preferences');
}

export async function updatePreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  return apiClient.put<NotificationPreferences>('/notifications/preferences', prefs);
}

// ── In-App Notifications ──

export async function getNotifications(
  page = 1,
  limit = 20
): Promise<PaginatedNotifications> {
  return apiClient.get<PaginatedNotifications>(
    `/notifications?page=${page}&limit=${limit}`
  );
}

export async function getUnreadCount(): Promise<number> {
  const result = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return result.count;
}

export async function markAsRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`, {});
}

export async function markAllAsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all', {});
}

// ── Admin ──

export async function getNotificationSystemStatus(): Promise<boolean> {
  const result = await apiClient.get<{ enabled: boolean }>('/notifications/admin/status');
  return result.enabled;
}

export async function toggleNotificationSystem(enabled: boolean): Promise<void> {
  await apiClient.put('/notifications/admin/toggle', { enabled });
}

export interface NotificationDiagnostics {
  enabled: boolean;
  runtime: { queueInitialized: boolean; vapidConfigured: boolean };
  fleet: {
    totalActiveSubscriptions: number;
    totalUsersSubscribed: number;
    subscriptionsByPlatform: Record<string, number>;
  };
  delivery24h: {
    sentToProvider: number;
    shownInApp: number;
    providerFailures: number;
    subscriptionsRemoved: number;
  };
  delivery1h: {
    providerFailures: number;
  };
  recentFailures: Array<{
    _id: string;
    userId: string;
    endpoint?: string;
    providerStatusCode?: number;
    error?: string;
    createdAt: string;
    jobName: string;
  }>;
}

export async function getNotificationDiagnostics(): Promise<NotificationDiagnostics> {
  return apiClient.get<NotificationDiagnostics>('/notifications/admin/diagnostics');
}
