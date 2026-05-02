import React, { useRef, useEffect, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Article } from '@/types';
import { MasonryGrid } from '@/components/MasonryGrid';
import { HomeGridVirtualized } from '@/components/feed/HomeGridVirtualized';
import type { HomeGridVirtualizedApi } from '@/components/feed/HomeGridVirtualized';
import { EmptyState } from '@/components/UI/EmptyState';
import { SearchX, Loader2 } from 'lucide-react';
import { useRowExpansion } from '@/hooks/useRowExpansion';
import { prepareArticleForNewsCard } from '@/utils/errorHandler';
import { CardSkeleton } from '@/components/card/CardSkeleton';
import { CardError } from '@/components/card/CardError';
import { ArticleDrawer } from '@/components/ArticleDrawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useHomeGridColumnCount } from '@/hooks/useHomeGridColumnCount';
import {
  HOME_FEED_INFINITE_SCROLL_ROOT_MARGIN_PX,
} from '@/utils/homeGridVirtualization';
import { beginFeedCloseAnalysisWindow } from '@/utils/devFeedCloseAnalysis';

export interface HomeArticleFeedProps {
  articles: Article[];
  viewMode: 'grid' | 'masonry';
  isLoading: boolean;
  /**
   * True while the articles infinite query is refetching (filters, search commit, stream, etc.) —
   * shows a subtle overlay instead of replacing the grid with skeletons.
   */
  isFeedRefetching?: boolean;
  /** @deprecated Use `isFeedRefetching` */
  isFilterRefetching?: boolean;
  onArticleClick: (article: Article) => void;
  onCategoryClick: (category: string) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  currentUserId?: string;
  selectionMode?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onTagClick?: (tag: string) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  error?: Error | null;
  onRetry?: () => void;
  searchHighlightQuery?: string;
  /** TanStack window virtualizer overscan in row units (grid mode only). */
  overscanRows?: number;
}

/** Bring a grid card into view without `virtualizer.scrollToIndex` (avoids TanStack scroll retry loops during layout/close). */
function scrollGridCardIntoView(articleId: string): void {
  const el = document.querySelector(`[data-article-id="${CSS.escape(articleId)}"]`);
  if (el) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

const InfiniteScrollTrigger: React.FC<{
  onIntersect: () => void;
  isLoading: boolean;
  hasMore: boolean;
}> = ({ onIntersect, isLoading, hasMore }) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onIntersect);

  useEffect(() => {
    callbackRef.current = onIntersect;
  }, [onIntersect]);

  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          callbackRef.current();
        }
      },
      {
        rootMargin: `${HOME_FEED_INFINITE_SCROLL_ROOT_MARGIN_PX}px`,
        threshold: 0,
      },
    );

    const currentTrigger = triggerRef.current;
    if (currentTrigger) {
      observer.observe(currentTrigger);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore]);

  if (!hasMore) return null;

  return (
    <div ref={triggerRef} className="flex justify-center py-6 col-span-full">
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-medium">Loading more...</span>
        </div>
      )}
    </div>
  );
};

/**
 * Home-only feed surface: grid path always uses {@link HomeGridVirtualized} (TASK-001).
 * Masonry and desktop drawer behavior match the former `ArticleGrid` home implementation.
 */
export const HomeArticleFeed: React.FC<HomeArticleFeedProps> = ({
  articles,
  viewMode,
  isLoading,
  isFeedRefetching: isFeedRefetchingProp,
  isFilterRefetching: isFilterRefetchingLegacy = false,
  onArticleClick,
  onCategoryClick,
  emptyTitle = 'No nuggets found',
  emptyMessage = 'Try adjusting your search or filters.',
  currentUserId,
  selectionMode = false,
  selectedIds = [],
  onSelect,
  onTagClick,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  error = null,
  onRetry,
  searchHighlightQuery,
  overscanRows,
}) => {
  const isFeedRefetching = isFeedRefetchingProp ?? isFilterRefetchingLegacy;
  const { registerCard } = useRowExpansion();
  const staggerCapIndex = 20;

  const [shouldAnimate, setShouldAnimate] = useState(() => articles.length > 0 && !isLoading);
  const prevLoadingRef = useRef(isLoading);
  const hasInitializedRef = useRef(articles.length > 0 && !isLoading);

  const [searchParams, setSearchParams] = useSearchParams();
  const setSearchParamsRef = useRef(setSearchParams);
  const expandedIdFromUrl = searchParams.get('expanded');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const isUpdatingFromUrlRef = useRef(false);

  const drawerOpenRef = useRef(drawerOpen);
  const expandedArticleIdRef = useRef(expandedArticleId);
  /** Last drawer/expanded snapshot used to skip redundant virtualizer scrolls (same id + still open). */
  const prevExpandedScrollTargetRef = useRef<{ drawer: boolean; id: string | null }>({
    drawer: false,
    id: null,
  });

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMultiColumnGrid = viewMode === 'grid' && isDesktop;
  const isMultiColumnGridRef = useRef(isMultiColumnGrid);
  const onArticleClickRef = useRef(onArticleClick);

  const prepareCacheRef = useRef<Map<string, { source: Article; prepared: Article }>>(new Map());
  const displayArticles = useMemo(() => {
    const prevCache = prepareCacheRef.current;
    const nextCache = new Map<string, { source: Article; prepared: Article }>();
    const out: Article[] = [];
    for (const a of articles) {
      if (!a || typeof a.id !== 'string') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[HomeArticleFeed] Skipping invalid article:', a);
        }
        continue;
      }
      const cached = prevCache.get(a.id);
      if (cached && cached.source === a) {
        nextCache.set(a.id, cached);
        out.push(cached.prepared);
        continue;
      }
      const p = prepareArticleForNewsCard(a);
      if (!p) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[HomeArticleFeed] Skipping invalid article:', a);
        }
        continue;
      }
      nextCache.set(a.id, { source: a, prepared: p });
      out.push(p);
    }
    prepareCacheRef.current = nextCache;
    return out;
  }, [articles]);

  const displayArticlesRef = useRef<Article[]>(displayArticles);
  drawerOpenRef.current = drawerOpen;
  expandedArticleIdRef.current = expandedArticleId;
  displayArticlesRef.current = displayArticles;
  isMultiColumnGridRef.current = isMultiColumnGrid;
  onArticleClickRef.current = onArticleClick;
  setSearchParamsRef.current = setSearchParams;

  const gridColumnCount = useHomeGridColumnCount();
  const homeGridVirtualApiRef = useRef<HomeGridVirtualizedApi | null>(null);
  const virtualListAnchorRef = useRef<HTMLDivElement>(null);
  const [virtualListScrollMargin, setVirtualListScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const el = virtualListAnchorRef.current;
    if (!el) return;
    const compute = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setVirtualListScrollMargin(Math.max(0, Math.round(top)));
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('load', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('load', compute);
    };
  }, [displayArticles.length, gridColumnCount]);

  useEffect(() => {
    if (!isMultiColumnGrid) {
      prevExpandedScrollTargetRef.current = { drawer: false, id: null };
      return;
    }
    if (!drawerOpen || !expandedArticleId) {
      prevExpandedScrollTargetRef.current = { drawer: drawerOpen, id: expandedArticleId };
      return;
    }

    const prev = prevExpandedScrollTargetRef.current;
    const shouldScroll =
      (!prev.drawer && drawerOpen) ||
      (Boolean(prev.id) && prev.id !== expandedArticleId);

    prevExpandedScrollTargetRef.current = { drawer: drawerOpen, id: expandedArticleId };

    if (!shouldScroll) return;

    const targetId = expandedArticleId;
    const rafId = requestAnimationFrame(() => {
      if (!drawerOpenRef.current || expandedArticleIdRef.current !== targetId) return;
      if (displayArticlesRef.current.findIndex((a) => a.id === targetId) < 0) return;
      scrollGridCardIntoView(targetId);
    });
    return () => cancelAnimationFrame(rafId);
  }, [isMultiColumnGrid, drawerOpen, expandedArticleId]);

  useEffect(() => {
    if (!isMultiColumnGrid) {
      if (drawerOpen) {
        setDrawerOpen(false);
        setExpandedArticleId(null);
      }
      return;
    }

    if (isUpdatingFromUrlRef.current) {
      return;
    }

    if (expandedIdFromUrl) {
      const article = displayArticles.find((a) => a.id === expandedIdFromUrl);
      if (article) {
        if (expandedArticleId !== expandedIdFromUrl || !drawerOpen) {
          isUpdatingFromUrlRef.current = true;
          setExpandedArticleId(expandedIdFromUrl);
          setDrawerOpen(true);
          setTimeout(() => {
            isUpdatingFromUrlRef.current = false;
          }, 0);
        }
      } else {
        if (drawerOpen || expandedArticleId) {
          setDrawerOpen(false);
          setExpandedArticleId(null);
        }
        setSearchParamsRef.current((prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.delete('expanded');
          return newParams;
        }, { replace: true });
      }
    } else {
      if (drawerOpen || expandedArticleId) {
        setDrawerOpen(false);
        setExpandedArticleId(null);
      }
    }
  }, [expandedIdFromUrl, displayArticles, isMultiColumnGrid]);

  useEffect(() => {
    if (!isMultiColumnGrid) return;

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const expandedId = params.get('expanded');

      if (expandedId) {
        const article = displayArticles.find((a) => a.id === expandedId);
        if (article) {
          setExpandedArticleId(expandedId);
          setDrawerOpen(true);
        } else {
          setDrawerOpen(false);
          setExpandedArticleId(null);
        }
      } else {
        setDrawerOpen(false);
        setExpandedArticleId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [displayArticles, isMultiColumnGrid]);

  const expandedArticle = expandedArticleId
    ? (displayArticles.find((a) => a.id === expandedArticleId) ?? null)
    : null;

  const currentIndex = expandedArticleId
    ? displayArticles.findIndex((a) => a.id === expandedArticleId)
    : -1;
  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex >= 0 && currentIndex < displayArticles.length - 1;

  useEffect(() => {
    if (prevLoadingRef.current && !isLoading && articles.length > 0) {
      const timer = setTimeout(() => setShouldAnimate(true), 50);
      prevLoadingRef.current = isLoading;
      return () => clearTimeout(timer);
    }

    if (!hasInitializedRef.current && !isLoading && articles.length > 0) {
      hasInitializedRef.current = true;
      const timer = setTimeout(() => setShouldAnimate(true), 50);
      prevLoadingRef.current = isLoading;
      return () => clearTimeout(timer);
    }

    if (!shouldAnimate && !isLoading && articles.length > 0) {
      const timer = setTimeout(() => setShouldAnimate(true), 50);
      return () => clearTimeout(timer);
    }

    prevLoadingRef.current = isLoading;
  }, [isLoading, articles.length, shouldAnimate]);

  useEffect(() => {
    if (!isMultiColumnGrid || displayArticles.length === 0) return;
    void import('@/components/ArticleDetail');
  }, [isMultiColumnGrid, displayArticles.length]);

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [isFetchingNextPage, hasNextPage, onLoadMore]);

  const handleCardClick = useCallback(
    (article: Article) => {
      if (isMultiColumnGridRef.current) {
        isUpdatingFromUrlRef.current = true;

        setExpandedArticleId(article.id);
        setDrawerOpen(true);

        setSearchParamsRef.current((prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.set('expanded', article.id);
          return newParams;
        }, { replace: true });

        setTimeout(() => {
          isUpdatingFromUrlRef.current = false;
        }, 100);
      } else {
        onArticleClickRef.current(article);
      }
    },
    [],
  );

  const handleYouTubeTimestampClick = useCallback(
    (_videoId: string, _timestamp: number, _originalUrl: string) => {},
    [],
  );

  const handleDrawerClose = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();

      if (import.meta.env.DEV) {
        beginFeedCloseAnalysisWindow();
      }

      isUpdatingFromUrlRef.current = true;

      setDrawerOpen(false);

      setSearchParamsRef.current((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('expanded');
        return newParams;
      }, { replace: true });

      setTimeout(() => {
        isUpdatingFromUrlRef.current = false;
      }, 100);

      setExpandedArticleId(null);
    },
    [],
  );

  const handleNavigateToCard = useCallback(
    (direction: 'prev' | 'next') => {
      if (currentIndex === -1) return;

      const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < displayArticles.length) {
        const newArticle = displayArticles[newIndex];

        isUpdatingFromUrlRef.current = true;

        setExpandedArticleId(newArticle.id);

        setSearchParamsRef.current((prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.set('expanded', newArticle.id);
          return newParams;
        }, { replace: true });

        setTimeout(() => {
          isUpdatingFromUrlRef.current = false;
        }, 100);

        requestAnimationFrame(() => {
          scrollGridCardIntoView(newArticle.id);
        });
      }
    },
    [currentIndex, displayArticles],
  );

  if (error && !isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-auto items-stretch mx-auto w-full">
        <CardError
          error={error}
          onRetry={onRetry}
          variant="grid"
          className="col-span-full"
        />
      </div>
    );
  }

  if (isLoading && viewMode !== 'masonry') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-auto items-stretch mx-auto w-full">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <CardSkeleton key={i} variant="grid" />
        ))}
      </div>
    );
  }

  if (articles.length === 0 && !isFeedRefetching) {
    return (
      <EmptyState
        icon={<SearchX />}
        title={emptyTitle}
        description={emptyMessage}
      />
    );
  }

  if (articles.length === 0 && isFeedRefetching) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 size={16} className="animate-spin text-primary-500" />
          Refreshing feed...
        </div>
      </div>
    );
  }

  if (viewMode === 'masonry') {
    return (
      <MasonryGrid
        articles={articles}
        isLoading={isLoading}
        onArticleClick={onArticleClick}
        onCategoryClick={onCategoryClick}
        currentUserId={currentUserId}
        onTagClick={onTagClick}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={onLoadMore}
        error={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="relative">
      {isFeedRefetching && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-white/70 pt-24 transition-opacity duration-200 dark:bg-slate-950/70">
          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
            <Loader2 size={16} className="animate-spin text-primary-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Refreshing feed…</span>
          </div>
        </div>
      )}
      <div
        className={`
        transition-opacity duration-300 motion-reduce:transition-none
        ${isFeedRefetching ? 'opacity-40 pointer-events-none' : 'opacity-100'}
        mx-auto w-full
      `}
      >
        <div ref={virtualListAnchorRef}>
          <HomeGridVirtualized
            displayArticles={displayArticles}
            columnCount={gridColumnCount}
            shouldAnimate={shouldAnimate}
            staggerCapIndex={staggerCapIndex}
            onCategoryClick={onCategoryClick}
            onCardClick={handleCardClick}
            currentUserId={currentUserId}
            onTagClick={onTagClick}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onSelect={onSelect}
            disableInlineExpansion={isMultiColumnGrid}
            searchHighlightQuery={searchHighlightQuery}
            registerCard={registerCard}
            scrollMarginTop={virtualListScrollMargin}
            apiRef={homeGridVirtualApiRef}
            overscanRows={overscanRows}
          />
        </div>

        <InfiniteScrollTrigger
          onIntersect={handleLoadMore}
          isLoading={isFetchingNextPage}
          hasMore={hasNextPage}
        />

        {isMultiColumnGrid && expandedArticle && (
          <ArticleDrawer
            isOpen={drawerOpen}
            onClose={handleDrawerClose}
            article={expandedArticle}
            onNavigateToCard={handleNavigateToCard}
            canNavigatePrev={canNavigatePrev}
            canNavigateNext={canNavigateNext}
            onYouTubeTimestampClick={handleYouTubeTimestampClick}
          />
        )}
      </div>
    </div>
  );
};

HomeArticleFeed.displayName = 'HomeArticleFeed';
