import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthSelector } from '@/context/AuthContext';
import {
  NOTIFICATION_PROMPT_COPY,
  NOTIFICATION_PROMPT_DISMISSED_KEY,
} from '@/constants/onboardingCopy';

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const VIEW_COUNT_KEY = 'nuggets_article_view_count';
const VIEW_THRESHOLD = 3;

export const NotificationPrompt: React.FC = () => {
  const currentUserId = useAuthSelector((a) => a.user?.id || '');
  const { subscribe, permissionStatus, isSubscribed, isPushSupported, isSubscriptionDesynced } = useNotifications();
  const [visible, setVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const shouldSuppress = !currentUserId || !isPushSupported || isSubscribed ||
    (permissionStatus === 'granted' && !isSubscriptionDesynced) || permissionStatus === 'denied';

  const isDismissed = useCallback((): boolean => {
    const dismissed = localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY);
    if (!dismissed) return false;
    const dismissedAt = parseInt(dismissed, 10);
    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  }, []);

  // Listen for contextual triggers instead of a blind timer
  useEffect(() => {
    if (shouldSuppress || isDismissed()) return;

    // Trigger 1: Check if article view threshold already met
    const currentCount = parseInt(sessionStorage.getItem(VIEW_COUNT_KEY) || '0', 10);
    if (currentCount >= VIEW_THRESHOLD) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }

    // Trigger 2: Listen for article views via custom event
    const handleArticleView = () => {
      const count = parseInt(sessionStorage.getItem(VIEW_COUNT_KEY) || '0', 10) + 1;
      sessionStorage.setItem(VIEW_COUNT_KEY, count.toString());
      if (count >= VIEW_THRESHOLD) {
        setTimeout(() => setVisible(true), 1000);
      }
    };

    // Trigger 3: Listen for collection follow event
    const handleCollectionFollow = () => {
      setTimeout(() => setVisible(true), 1500);
    };

    window.addEventListener('nugget:article-view', handleArticleView);
    window.addEventListener('nugget:collection-follow', handleCollectionFollow);

    return () => {
      window.removeEventListener('nugget:article-view', handleArticleView);
      window.removeEventListener('nugget:collection-follow', handleCollectionFollow);
    };
  }, [shouldSuppress, isDismissed]);

  if (!visible) return null;

  const handleEnable = async () => {
    setIsSubscribing(true);
    try {
      await subscribe();
    } finally {
      setIsSubscribing(false);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-4 flex items-start gap-3">
        <div className="shrink-0 p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
          <Bell size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {isSubscriptionDesynced ? 'Reconnect notifications' : NOTIFICATION_PROMPT_COPY.title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isSubscriptionDesynced
              ? 'Your browser permission is enabled, but push delivery is disconnected. Re-enable to restore phone alerts.'
              : NOTIFICATION_PROMPT_COPY.body}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleEnable}
              disabled={isSubscribing}
              className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubscribing
                ? NOTIFICATION_PROMPT_COPY.enableButtonLoading
                : NOTIFICATION_PROMPT_COPY.enableButton}
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              {NOTIFICATION_PROMPT_COPY.dismissButton}
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
