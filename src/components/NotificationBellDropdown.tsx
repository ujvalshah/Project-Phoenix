import React, { useLayoutEffect, useState } from 'react';
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
import { useNavigate } from 'react-router-dom';
import { getOverlayHost } from '@/utils/overlayHosts';
import type { InAppNotification } from '@/services/notificationService';
import type { NotificationGroup } from './notificationBellGrouping';
import {
  HEADER_PERF_SURFACES,
  headerPerfSurfaceReady,
} from '@/dev/perfMarks';

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

const GroupedNotificationRow: React.FC<{
  group: NotificationGroup;
  onClick: (n: InAppNotification) => void;
}> = ({ group, onClick }) => {
  const [expanded, setExpanded] = useState(false);
  const hasUnread = group.notifications.some((n) => !n.read);
  const unreadInGroup = group.notifications.filter((n) => !n.read).length;

  return (
    <div className="border-b border-slate-100 dark:border-slate-700/30 last:border-b-0">
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

export interface NotificationBellDropdownProps {
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  position: { top: number; right: number };
  unreadCount: number;
  notifications: InAppNotification[];
  totalNotifications: number;
  groups: NotificationGroup[];
  allRead: boolean;
  permissionStatus: NotificationPermission | 'unsupported';
  isSubscriptionDesynced: boolean;
  onMarkAllRead: () => void;
  onNotificationClick: (notification: InAppNotification) => void;
  onNavigateCollections: () => void;
  onViewAllNotifications: () => void;
}

const NotificationBellDropdown: React.FC<NotificationBellDropdownProps> = ({
  dropdownRef,
  position,
  unreadCount,
  notifications,
  totalNotifications,
  groups,
  allRead,
  permissionStatus,
  isSubscriptionDesynced,
  onMarkAllRead,
  onNotificationClick,
  onNavigateCollections,
  onViewAllNotifications,
}) => {
  const navigate = useNavigate();

  useLayoutEffect(() => {
    headerPerfSurfaceReady(HEADER_PERF_SURFACES.BELL_DROPDOWN, {
      phase: 'lazy-dropdown-mounted',
    });
  }, []);

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed pointer-events-auto w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden"
      style={{
        top: position.top,
        right: position.right,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => onMarkAllRead()}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {allRead && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50/60 dark:bg-green-900/10 border-b border-green-100/60 dark:border-green-800/20">
          <CheckCircle2 size={14} className="text-green-500 dark:text-green-400 shrink-0" />
          <p className="text-xs font-medium text-green-700 dark:text-green-400">All caught up</p>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {permissionStatus === 'granted' && isSubscriptionDesynced && (
          <div className="px-4 py-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30">
            Push delivery is disconnected on this device. Re-enable notifications in Settings.
          </div>
        )}
        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mx-auto mb-3">
              <Bell size={24} className="text-slate-300 dark:text-slate-500" />
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
                  type="button"
                  onClick={() => {
                    onNavigateCollections();
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
                onClick={onNotificationClick}
              />
            ) : (
              <NotificationRow
                key={group.id}
                notification={group.primary}
                onClick={onNotificationClick}
              />
            ),
          )
        )}
      </div>

      {notifications.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              navigate('/notifications');
              onViewAllNotifications();
            }}
            className="w-full px-4 py-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-center"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>,
    getOverlayHost('dropdown'),
  );
};

export default NotificationBellDropdown;
