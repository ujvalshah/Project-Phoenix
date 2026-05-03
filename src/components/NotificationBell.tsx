import React, { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';
import { articleService } from '@/services/articleService';
import { NotificationBadge } from './NotificationBadge';
import type { Article } from '@/types';
import type { InAppNotification } from '@/services/notificationService';
import { groupNotifications } from './notificationBellGrouping';
import { HEADER_PERF_SURFACES, headerPerfSurfaceTrigger } from '@/dev/perfMarks';
import { prefetchNotificationBellDropdownChunk } from '@/utils/headerChunkPrefetch';

const EMPTY_NOTIFICATIONS: InAppNotification[] = [];

const NotificationBellDropdownLazy = lazy(() => import('./NotificationBellDropdown'));
const ArticleModalLazy = lazy(() =>
  import('./ArticleModal').then((m) => ({ default: m.ArticleModal })),
);

export interface NotificationBellProps {
  /** Merged onto the bell trigger for header glass / hover styling */
  buttonClassName?: string;
  /** Lucide icon size on the trigger (match other header toolbar icons) */
  bellIconSize?: number;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  buttonClassName,
  bellIconSize = 18,
}) => {
  const { isAuthenticated, openAuthModal } = useAuthSelector(
    (a) => ({
      isAuthenticated: a.isAuthenticated,
      openAuthModal: a.openAuthModal,
    }),
    shallowEqualAuth,
  );
  const {
    unreadCount,
    useNotificationList,
    markAsRead,
    markAllAsRead,
    isSubscriptionDesynced,
    permissionStatus,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [modalArticle, setModalArticle] = useState<Article | null>(null);
  /** After first bell interaction, keep lazy dropdown module resolved (matches prior eager behavior). */
  const [lazyDropdownRequested, setLazyDropdownRequested] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const { data: notificationsData } = useNotificationList(1);
  const notifications = notificationsData?.data ?? EMPTY_NOTIFICATIONS;
  const totalNotifications = notificationsData?.total ?? 0;

  const groups = useMemo(() => groupNotifications(notifications), [notifications]);

  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  const showDropdown = lazyDropdownRequested && isOpen && position;

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();

    let rafId: number | null = null;
    const handleUpdate = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        updatePosition();
        rafId = null;
      });
    };

    window.addEventListener('scroll', handleUpdate, { passive: true, capture: true });
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal('login')}
        className={twMerge(
          'relative flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200',
          buttonClassName,
        )}
        title="Sign in to view notifications"
        aria-label="Sign in to view notifications"
      >
        <Bell size={bellIconSize} aria-hidden />
      </button>
    );
  }

  const handleNotificationClick = async (notification: InAppNotification) => {
    if (!notification.read) {
      markAsRead(notification._id);
    }
    setIsOpen(false);

    const articleId = notification.data?.articleId;
    if (articleId) {
      const article = await articleService.getArticleById(articleId);
      if (article) {
        setModalArticle(article);
        return;
      }
    }

    if (notification.data?.url) {
      navigate(notification.data.url);
    }
  };

  const allRead = notifications.length > 0 && unreadCount === 0;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onPointerEnter={prefetchNotificationBellDropdownChunk}
        onPointerDown={prefetchNotificationBellDropdownChunk}
        onFocus={prefetchNotificationBellDropdownChunk}
        onClick={() => {
          setLazyDropdownRequested(true);
          setIsOpen((v) => {
            const next = !v;
            if (next) {
              headerPerfSurfaceTrigger(HEADER_PERF_SURFACES.BELL_DROPDOWN);
            }
            return next;
          });
        }}
        className={twMerge(
          'relative flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200',
          buttonClassName,
        )}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={bellIconSize} aria-hidden />
        <NotificationBadge visible={unreadCount > 0} />
      </button>

      {showDropdown && (
        <Suspense fallback={null}>
          <NotificationBellDropdownLazy
            dropdownRef={dropdownRef}
            position={position}
            unreadCount={unreadCount}
            notifications={notifications}
            totalNotifications={totalNotifications}
            groups={groups}
            allRead={allRead}
            permissionStatus={permissionStatus}
            isSubscriptionDesynced={isSubscriptionDesynced}
            onMarkAllRead={markAllAsRead}
            onNotificationClick={handleNotificationClick}
            onNavigateCollections={() => {
              navigate('/collections');
              setIsOpen(false);
            }}
            onViewAllNotifications={() => setIsOpen(false)}
          />
        </Suspense>
      )}

      {modalArticle && (
        <Suspense fallback={null}>
          <ArticleModalLazy
            isOpen={!!modalArticle}
            onClose={() => setModalArticle(null)}
            article={modalArticle}
          />
        </Suspense>
      )}
    </>
  );
};
