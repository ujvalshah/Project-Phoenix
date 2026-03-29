import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  getUnreadCount,
  getNotifications,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
  subscribeToPush,
  unsubscribeFromPush,
  getPermissionStatus,
  isPushSubscribed,
  getPreferences,
  updatePreferences,
  type NotificationPreferences,
} from '@/services/notificationService';
import { useCallback, useEffect, useState } from 'react';

const NOTIFICATION_KEYS = {
  unreadCount: ['notifications', 'unread-count'] as const,
  list: (page: number) => ['notifications', 'list', page] as const,
  preferences: ['notifications', 'preferences'] as const,
};

export function useNotifications() {
  const { currentUserId } = useAuth();
  const queryClient = useQueryClient();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(
    getPermissionStatus()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check subscription status on mount
  useEffect(() => {
    if (currentUserId) {
      isPushSubscribed().then(setIsSubscribed).catch(() => setIsSubscribed(false));
    }
  }, [currentUserId]);

  // Unread count — polls every 60s
  const { data: unreadCount = 0 } = useQuery({
    queryKey: NOTIFICATION_KEYS.unreadCount,
    queryFn: getUnreadCount,
    enabled: !!currentUserId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Notification list — fetched on demand
  const useNotificationList = (page = 1) =>
    useQuery({
      queryKey: NOTIFICATION_KEYS.list(page),
      queryFn: () => getNotifications(page),
      enabled: !!currentUserId,
      staleTime: 30_000,
    });

  // Preferences
  const { data: preferences } = useQuery({
    queryKey: NOTIFICATION_KEYS.preferences,
    queryFn: getPreferences,
    enabled: !!currentUserId,
    staleTime: 5 * 60_000,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (prefs: Partial<NotificationPreferences>) => updatePreferences(prefs),
    onSuccess: (data) => {
      queryClient.setQueryData(NOTIFICATION_KEYS.preferences, data);
    },
  });

  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => markAsReadApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.unreadCount });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.unreadCount });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });

  // Subscribe / unsubscribe
  const subscribe = useCallback(async () => {
    if (!('Notification' in window)) return false;

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);

    if (permission !== 'granted') return false;

    try {
      const success = await subscribeToPush();
      if (success) {
        setIsSubscribed(true);
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.preferences });
      }
      return success;
    } catch {
      return false;
    }
  }, [queryClient]);

  const unsubscribe = useCallback(async () => {
    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.preferences });
    } catch {
      // Silently fail
    }
  }, [queryClient]);

  return {
    unreadCount,
    useNotificationList,
    preferences,
    updatePreferences: updatePreferencesMutation.mutate,
    isUpdatingPreferences: updatePreferencesMutation.isPending,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    subscribe,
    unsubscribe,
    isSubscribed,
    permissionStatus,
    isPushSupported: 'serviceWorker' in navigator && 'PushManager' in window,
  };
}
