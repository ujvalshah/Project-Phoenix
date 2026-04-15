import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  CheckCheck,
  Newspaper,
  Package,
  Settings,
  CheckCircle2,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';
import { getOverlayHost } from '@/utils/overlayHosts';
import { articleService } from '@/services/articleService';
import { ArticleModal } from './ArticleModal';
import { NotificationBadge } from './NotificationBadge';
import type { Article } from '@/types';
import type { InAppNotification } from '@/services/notificationService';

// ── Helpers ──

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getTypeLabel(type: InAppNotification['type']): string {
  switch (type) {
    case 'new_nugget':
      return 'New content';
    case 'digest':
      return 'Digest';
    case 'system':
      return 'System';
    default:
      return '';
  }
}

// ── Type icon component ──

const TypeIcon: React.FC<{ type: InAppNotification['type']; unread: boolean }> = ({
  type,
  unread,
}) => {
  const baseClasses = 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0';

  switch (type) {
    case 'new_nugget':
      return (
        <div
          className={`${baseClasses} ${
            unread
              ? 'bg-blue-100 dark:bg-blue-900/30'
              : 'bg-slate-100 dark:bg-slate-700/50'
          }`}
        >
          <Newspaper
            size={16}
            className={
              unread
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-400 dark:text-slate-500'
            }
          />
        </div>
      );
    case 'digest':
      return (
        <div
          className={`${baseClasses} ${
            unread
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : 'bg-slate-100 dark:bg-slate-700/50'
          }`}
        >
          <Package
            size={16}
            className={
              unread
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-400 dark:text-slate-500'
            }
          />
        </div>
      );
    case 'system':
      return (
        <div
          className={`${baseClasses} ${
            unread
              ? 'bg-slate-200 dark:bg-slate-600/30'
              : 'bg-slate-100 dark:bg-slate-700/50'
          }`}
        >
          <Settings
            size={16}
            className={
              unread
                ? 'text-slate-600 dark:text-slate-300'
                : 'text-slate-400 dark:text-slate-500'
            }
          />
        </div>
      );
  }
};

// ── Grouping logic ──

interface NotificationGroup {
  id: string;
  type: 'single' | 'grouped';
  notifications: InAppNotification[];
  /** Representative notification for display */
  primary: InAppNotification;
  count: number;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function groupNotifications(notifications: InAppNotification[]): NotificationGroup[] {
  if (notifications.length === 0) return [];

  const groups: NotificationGroup[] = [];
  let i = 0;

  while (i < notifications.length) {
    const current = notifications[i];

    // Only group new_nugget type
    if (current.type !== 'new_nugget') {
      groups.push({
        id: current._id,
        type: 'single',
        notifications: [current],
        primary: current,
        count: 1,
      });
      i++;
      continue;
    }

    // Collect consecutive new_nugget notifications within 2h window
    const batch: InAppNotification[] = [current];
    let j = i + 1;

    while (j < notifications.length) {
      const next = notifications[j];
      if (next.type !== 'new_nugget') break;

      const timeDiff = Math.abs(
        new Date(current.createdAt).getTime() - new Date(next.createdAt).getTime()
      );
      if (timeDiff > TWO_HOURS_MS) break;

      batch.push(next);
      j++;
    }

    if (batch.length >= 8) {
      groups.push({
        id: `group-${current._id}`,
        type: 'grouped',
        notifications: batch,
        primary: batch[0],
        count: batch.length,
      });
    } else {
      // Not enough to group — add individually
      for (const n of batch) {
        groups.push({
          id: n._id,
          type: 'single',
          notifications: [n],
          primary: n,
          count: 1,
        });
      }
    }

    i = j;
  }

  return groups;
}

// ── Single notification row ──

const NotificationRow: React.FC<{
  notification: InAppNotification;
  onClick: (n: InAppNotification) => void;
}> = ({ notification: n, onClick }) => (
  <button
    onClick={() => onClick(n)}
    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700/30 last:border-b-0 ${
      !n.read
        ? 'bg-blue-50/40 dark:bg-blue-900/10 border-l-2 border-l-blue-400 dark:border-l-blue-500'
        : 'border-l-2 border-l-transparent'
    }`}
  >
    <TypeIcon type={n.type} unread={!n.read} />
    <div className="flex-1 min-w-0">
      <p
        className={`text-sm leading-tight truncate ${
          !n.read
            ? 'font-bold text-slate-900 dark:text-white'
            : 'font-medium text-slate-600 dark:text-slate-400'
        }`}
      >
        {n.title}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
        {n.body}
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
        {getTypeLabel(n.type)}
        <span className="mx-1">&middot;</span>
        {timeAgo(n.createdAt)}
      </p>
    </div>
  </button>
);

// ── Grouped notification row (expandable) ──

const GroupedNotificationRow: React.FC<{
  group: NotificationGroup;
  onClick: (n: InAppNotification) => void;
}> = ({ group, onClick }) => {
  const [expanded, setExpanded] = useState(false);
  const hasUnread = group.notifications.some((n) => !n.read);
  const unreadInGroup = group.notifications.filter((n) => !n.read).length;

  return (
    <div className="border-b border-slate-100 dark:border-slate-700/30 last:border-b-0">
      {/* Group header — toggles expansion */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
          hasUnread
            ? 'bg-blue-50/40 dark:bg-blue-900/10 border-l-2 border-l-blue-400 dark:border-l-blue-500'
            : 'border-l-2 border-l-transparent'
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Newspaper size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm leading-tight ${
              hasUnread
                ? 'font-bold text-slate-900 dark:text-white'
                : 'font-medium text-slate-600 dark:text-slate-400'
            }`}
          >
            {group.count} new articles
            {unreadInGroup > 0 && (
              <span className="text-blue-500 dark:text-blue-400 text-xs font-medium ml-1.5">
                ({unreadInGroup} unread)
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
            {expanded ? 'Tap an article to open' : `Latest: ${group.primary.title}`}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            New content
            <span className="mx-1">&middot;</span>
            {timeAgo(group.primary.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-1">
          <span className="min-w-[20px] h-5 px-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full flex items-center justify-center">
            {group.count}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-slate-400" />
          ) : (
            <ChevronDown size={14} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded individual items */}
      {expanded && (
        <div className="bg-slate-50/50 dark:bg-slate-800/30">
          {group.notifications.map((n) => (
            <button
              key={n._id}
              onClick={() => onClick(n)}
              className={`w-full text-left pl-8 pr-4 py-2.5 flex items-start gap-3 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors border-t border-slate-100/80 dark:border-slate-700/20 ${
                !n.read
                  ? 'border-l-2 border-l-blue-400 dark:border-l-blue-500'
                  : 'border-l-2 border-l-transparent'
              }`}
            >
              <TypeIcon type={n.type} unread={!n.read} />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-tight truncate ${
                    !n.read
                      ? 'font-bold text-slate-900 dark:text-white'
                      : 'font-medium text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {n.title}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {timeAgo(n.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export interface NotificationBellProps {
  /** Merged onto the bell trigger for header glass / hover styling */
  buttonClassName?: string;
  /** Lucide icon size on the trigger (match other header toolbar icons) */
  bellIconSize?: number;
}

// ── Main component ──

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
  const { unreadCount, useNotificationList, markAsRead, markAllAsRead } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [modalArticle, setModalArticle] = useState<Article | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const { data: notificationsData } = useNotificationList(1);
  const notifications = notificationsData?.data || [];
  const totalNotifications = notificationsData?.total ?? 0;

  const groups = useMemo(() => groupNotifications(notifications), [notifications]);

  // Dropdown position state (portal is positioned relative to the bell button)
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, []);

  // Recalculate position on open and on scroll/resize
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

  // Close on outside click
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

    // Article notifications → open in modal drawer
    const articleId = notification.data?.articleId;
    if (articleId) {
      const article = await articleService.getArticleById(articleId);
      if (article) {
        setModalArticle(article);
        return;
      }
    }

    // Non-article notifications (digest, system) → navigate
    if (notification.data?.url) {
      navigate(notification.data.url);
    }
  };

  const allRead = notifications.length > 0 && unreadCount === 0;

  return (
    <>
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
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

      {/* Dropdown — portaled to document.body so it escapes header stacking context */}
      {isOpen && position && createPortal(
        <div
          ref={dropdownRef}
          className="fixed pointer-events-auto w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden"
          style={{
            top: position.top,
            right: position.right,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* "All caught up" banner */}
          {allRead && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50/60 dark:bg-green-900/10 border-b border-green-100/60 dark:border-green-800/20">
              <CheckCircle2
                size={14}
                className="text-green-500 dark:text-green-400 shrink-0"
              />
              <p className="text-xs font-medium text-green-700 dark:text-green-400">
                All caught up
              </p>
            </div>
          )}

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mx-auto mb-3">
                  <Bell
                    size={24}
                    className="text-slate-300 dark:text-slate-500"
                  />
                </div>
                {totalNotifications === 0 ? (
                  <>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No notifications yet
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[220px] mx-auto">
                      Follow collections to get notified when new content drops.
                    </p>
                    <button
                      onClick={() => {
                        navigate('/collections');
                        setIsOpen(false);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    >
                      <BookOpen size={12} />
                      Explore Collections
                    </button>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    You&apos;re all caught up
                  </p>
                )}
              </div>
            ) : (
              groups.map((group) =>
                group.type === 'grouped' ? (
                  <GroupedNotificationRow
                    key={group.id}
                    group={group}
                    onClick={handleNotificationClick}
                  />
                ) : (
                  <NotificationRow
                    key={group.id}
                    notification={group.primary}
                    onClick={handleNotificationClick}
                  />
                )
              )
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => {
                  navigate('/notifications');
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-center"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>,
        getOverlayHost('dropdown'),
      )}

      {/* Article detail modal — opened from notification click */}
      {modalArticle && (
        <ArticleModal
          isOpen={!!modalArticle}
          onClose={() => setModalArticle(null)}
          article={modalArticle}
        />
      )}
    </>
  );
};
