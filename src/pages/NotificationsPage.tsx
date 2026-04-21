import React, { useState, useMemo, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  Newspaper,
  Package,
  Settings,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { ArticleModal } from '@/components/ArticleModal';
import { articleService } from '@/services/articleService';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';
import type { Article } from '@/types';
import type { InAppNotification } from '@/services/notificationService';
import { getNotificationDiagnostics } from '@/services/notificationService';
import { useQuery } from '@tanstack/react-query';

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
    case 'new_nugget': return 'New content';
    case 'digest': return 'Digest';
    case 'system': return 'System';
    default: return '';
  }
}

// ── Type icon ──

const TypeIcon: React.FC<{ type: InAppNotification['type']; unread: boolean }> = ({ type, unread }) => {
  const base = 'w-10 h-10 rounded-xl flex items-center justify-center shrink-0';

  const config = {
    new_nugget: {
      bg: unread ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-700/50',
      icon: <Newspaper size={18} className={unread ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} />,
    },
    digest: {
      bg: unread ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-slate-100 dark:bg-slate-700/50',
      icon: <Package size={18} className={unread ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'} />,
    },
    system: {
      bg: unread ? 'bg-slate-200 dark:bg-slate-600/30' : 'bg-slate-100 dark:bg-slate-700/50',
      icon: <Settings size={18} className={unread ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'} />,
    },
  };

  const c = config[type];
  return <div className={`${base} ${c.bg}`}>{c.icon}</div>;
};

// ── Filter tabs ──

type FilterTab = 'all' | 'new_nugget' | 'digest' | 'system';

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new_nugget', label: 'Content' },
  { value: 'digest', label: 'Digests' },
  { value: 'system', label: 'System' },
];

// ── Main component ──

export const NotificationsPage: React.FC = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const { unreadCount, useNotificationList, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [modalArticle, setModalArticle] = useState<Article | null>(null);

  const { data: notificationsData, isLoading } = useNotificationList(page);
  const { data: diagnostics } = useQuery({
    queryKey: ['notifications', 'diagnostics'],
    queryFn: getNotificationDiagnostics,
    enabled: !!isAdmin,
    staleTime: 30_000,
  });
  const notifications = notificationsData?.data || [];
  const hasMore = notificationsData?.hasMore ?? false;
  const total = notificationsData?.total ?? 0;

  const filtered = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  const handleClick = useCallback(async (n: InAppNotification) => {
    if (!n.read) markAsRead(n._id);

    // Article notifications → open in modal drawer
    const articleId = n.data?.articleId;
    if (articleId) {
      const article = await articleService.getArticleById(articleId);
      if (article) {
        setModalArticle(article);
        return;
      }
    }

    // Non-article notifications → navigate
    if (n.data?.url) navigate(n.data.url);
  }, [markAsRead, navigate]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Please sign in to view notifications.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <HeaderSpacer />

      {/* Page header */}
      <div
        className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR} pt-8 pb-4`}
        style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Notifications
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {total > 0 ? `${total} notification${total !== 1 ? 's' : ''}` : 'No notifications'}
                {unreadCount > 0 && ` · ${unreadCount} unread`}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-4">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setActiveTab(tab.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === tab.value
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notification list */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-4">
        {isAdmin && diagnostics && (
          <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-3 text-xs">
            <div className="font-bold text-slate-700 dark:text-slate-200 mb-1">Notification diagnostics</div>
            <div className="text-slate-500 dark:text-slate-400">
              enabled: {String(diagnostics.enabled)} · queue: {String(diagnostics.runtime.queueInitialized)} · vapid: {String(diagnostics.runtime.vapidConfigured)} · activeSubscriptions: {diagnostics.user.activeSubscriptions}
            </div>
          </div>
        )}
        {/* "All caught up" banner */}
        {notifications.length > 0 && unreadCount === 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 mb-3 bg-green-50/60 dark:bg-green-900/10 border border-green-100/60 dark:border-green-800/20 rounded-xl">
            <CheckCircle2 size={14} className="text-green-500 dark:text-green-400 shrink-0" />
            <p className="text-xs font-medium text-green-700 dark:text-green-400">
              All caught up
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-12 text-center">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 mt-3">Loading notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mx-auto mb-3">
                <Bell size={24} className="text-slate-300 dark:text-slate-500" />
              </div>
              {total === 0 ? (
                <>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No notifications yet
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[220px] mx-auto">
                    Follow collections to get notified when new content drops.
                  </p>
                  <button
                    onClick={() => navigate('/collections')}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <BookOpen size={12} />
                    Explore Collections
                  </button>
                </>
              ) : (
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No {activeTab !== 'all' ? `${TABS.find(t => t.value === activeTab)?.label.toLowerCase()} ` : ''}notifications
                </p>
              )}
            </div>
          ) : (
            filtered.map((n) => (
              <button
                key={n._id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-100 dark:border-slate-700/30 last:border-b-0 ${
                  !n.read
                    ? 'bg-blue-50/30 dark:bg-blue-900/5 border-l-2 border-l-blue-400 dark:border-l-blue-500'
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                <TypeIcon type={n.type} unread={!n.read} />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-tight ${
                      !n.read
                        ? 'font-bold text-slate-900 dark:text-white'
                        : 'font-medium text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {n.body}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                    {getTypeLabel(n.type)}
                    <span className="mx-1">&middot;</span>
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        {(hasMore || page > 1) && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400 font-medium">
              Page {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Article detail modal — opened from notification click */}
      {modalArticle && (
        <ArticleModal
          isOpen={!!modalArticle}
          onClose={() => setModalArticle(null)}
          article={modalArticle}
        />
      )}
    </div>
  );
};
