import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Article } from '@/types';
import { NewsCard } from './NewsCard';
import { MasonryGrid } from './MasonryGrid';
import { EmptyState } from './UI/EmptyState';
import { SearchX, Loader2 } from 'lucide-react';
import { useRowExpansion } from '@/hooks/useRowExpansion';
import { ErrorBoundary } from './UI/ErrorBoundary';
import { prepareArticleForNewsCard } from '@/utils/errorHandler';
import { CardSkeleton } from './card/CardSkeleton';
import { CardError } from './card/CardError';
import { ArticleDrawer, prefetchArticleDrawer } from './ArticleDrawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ArticleGridProps {
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
  // Selection Props
  selectionMode?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onTagClick?: (tag: string) => void;
  // Infinite Scroll Props
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  // Error Handling Props
  error?: Error | null;
  onRetry?: () => void;
  /** When set, highlights query tokens in card titles for committed search */
  searchHighlightQuery?: string;
}

// Infinite Scroll Trigger Component (reused from Feed.tsx pattern)
const InfiniteScrollTrigger: React.FC<{
  onIntersect: () => void;
  isLoading: boolean;
  hasMore: boolean;
}> = ({ onIntersect, isLoading, hasMore }) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onIntersect);
  
  // Keep callback ref updated without triggering effect
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
        rootMargin: '300px', // Prefetch distance
        threshold: 0,
      }
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

export const ArticleGrid: React.FC<ArticleGridProps> = ({
  articles,
  viewMode,
  isLoading,
  isFeedRefetching: isFeedRefetchingProp,
  isFilterRefetching: isFilterRefetchingLegacy = false,
  onArticleClick,
  onCategoryClick,
  emptyTitle = "No nuggets found",
  emptyMessage = "Try adjusting your search or filters.",
  currentUserId,
  selectionMode = false,
  selectedIds = [],
  onSelect,
  onTagClick,
  // Infinite Scroll Props
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  // Error Handling Props
  error = null,
  onRetry,
  searchHighlightQuery,
}) => {
  const isFeedRefetching = isFeedRefetchingProp ?? isFilterRefetchingLegacy;
  const { registerCard } = useRowExpansion();
  // Default to animated-visible when we already have data at mount so cards
  // never get stuck at opacity-0 if the loading transition is missed (e.g.
  // cached React Query hydration, back/forward nav, tab restore). The
  // entrance animation is cosmetic — content visibility is the invariant.
  const [shouldAnimate, setShouldAnimate] = useState(() => articles.length > 0 && !isLoading);
  const prevLoadingRef = useRef(isLoading);
  const hasInitializedRef = useRef(articles.length > 0 && !isLoading);
  
  // URL state synchronization
  const [searchParams, setSearchParams] = useSearchParams();
  const expandedIdFromUrl = searchParams.get('expanded');
  
  // Drawer state for desktop multi-column grid
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const previousScrollPositionRef = useRef<number>(0);
  const isUpdatingFromUrlRef = useRef(false); // Prevent double updates
  
  // Detect if we're in desktop multi-column grid mode
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMultiColumnGrid = viewMode === 'grid' && isDesktop;

  // Idle-prefetch the drawer chunk once the grid is mounted in desktop mode.
  // The drawer's ArticleDetail bundle (markdown renderer, embeds, modals) is
  // ~heavy; warming it before the first click eliminates the post-click
  // "Loading article…" spinner.
  useEffect(() => {
    if (!isMultiColumnGrid) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => prefetchArticleDrawer());
      return () => {
        const cancel = (window as Window & { cancelIdleCallback?: (id: number) => void })
          .cancelIdleCallback;
        cancel?.(id);
      };
    }
    const timer = setTimeout(prefetchArticleDrawer, 1500);
    return () => clearTimeout(timer);
  }, [isMultiColumnGrid]);

  /**
   * Per-article cache keyed by source object identity. react-query preserves the
   * underlying `Article` reference for cached pages across `fetchNextPage`, so when
   * the outer `articles` array gets a new identity (page append), already-prepared
   * cards keep stable `prepared` refs. That keeps `useNewsCard`'s memoized derivations
   * (mediaClassification, etc.) from invalidating for every visible card on each append.
   */
  const prepareCacheRef = useRef<Map<string, { source: Article; prepared: Article }>>(new Map());
  const displayArticles = useMemo(() => {
    const prevCache = prepareCacheRef.current;
    const nextCache = new Map<string, { source: Article; prepared: Article }>();
    const out: Article[] = [];
    for (const a of articles) {
      if (!a || typeof a.id !== 'string') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ArticleGrid] Skipping invalid article:', a);
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
          console.warn('[ArticleGrid] Skipping invalid article:', a);
        }
        continue;
      }
      nextCache.set(a.id, { source: a, prepared: p });
      out.push(p);
    }
    prepareCacheRef.current = nextCache;
    return out;
  }, [articles]);
  
  // Initialize drawer state from URL on mount or when URL changes
  // CRITICAL: Only sync URL → state here, not state → URL (prevents bounce)
  useEffect(() => {
    if (!isMultiColumnGrid) {
      // Not in multi-column grid mode - ensure drawer is closed
      if (drawerOpen) {
        setDrawerOpen(false);
        setExpandedArticleId(null);
      }
      return;
    }
    
    // Skip if we're already updating from URL (prevents double updates)
    if (isUpdatingFromUrlRef.current) {
      return;
    }
    
    if (expandedIdFromUrl) {
      const article = displayArticles.find((a) => a.id === expandedIdFromUrl);
      if (article) {
        // Only update if state doesn't match URL (prevents unnecessary updates)
        if (expandedArticleId !== expandedIdFromUrl || !drawerOpen) {
          isUpdatingFromUrlRef.current = true;
          setExpandedArticleId(expandedIdFromUrl);
          setDrawerOpen(true);
          // Reset flag after state update
          setTimeout(() => {
            isUpdatingFromUrlRef.current = false;
          }, 0);
        }
      } else {
        // Invalid article ID in URL - clean it up and close drawer
        if (drawerOpen || expandedArticleId) {
          setDrawerOpen(false);
          setExpandedArticleId(null);
        }
        setSearchParams((prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.delete('expanded');
          return newParams;
        }, { replace: true });
      }
    } else {
      // No expanded param in URL - ensure drawer is closed
      if (drawerOpen || expandedArticleId) {
        setDrawerOpen(false);
        setExpandedArticleId(null);
      }
    }
  }, [expandedIdFromUrl, displayArticles, isMultiColumnGrid, setSearchParams]); // Removed drawerOpen from deps
  
  // Handle browser back/forward navigation
  useEffect(() => {
    if (!isMultiColumnGrid) return;
    
    const handlePopState = () => {
      // Read URL directly from window.location (popstate doesn't update React state immediately)
      const params = new URLSearchParams(window.location.search);
      const expandedId = params.get('expanded');
      
      if (expandedId) {
        const article = displayArticles.find((a) => a.id === expandedId);
        if (article) {
          setExpandedArticleId(expandedId);
          setDrawerOpen(true);
        } else {
          // Invalid article ID - close drawer
          setDrawerOpen(false);
          setExpandedArticleId(null);
        }
      } else {
        // No expanded param - close drawer
        setDrawerOpen(false);
        setExpandedArticleId(null);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [displayArticles, isMultiColumnGrid]);
  
  // Find expanded article (already normalized in displayArticles)
  const expandedArticle = expandedArticleId
    ? displayArticles.find((a) => a.id === expandedArticleId) ?? null
    : null;
  
  // Find current article index for navigation
  const currentIndex = expandedArticleId 
    ? displayArticles.findIndex((a) => a.id === expandedArticleId)
    : -1;
  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex >= 0 && currentIndex < displayArticles.length - 1;

  // Trigger animations when loading completes OR when component mounts with data
  useEffect(() => {
    // Case 1: Transitioning from loading → loaded (initial load)
    if (prevLoadingRef.current && !isLoading && articles.length > 0) {
      const timer = setTimeout(() => setShouldAnimate(true), 50);
      prevLoadingRef.current = isLoading;
      return () => clearTimeout(timer);
    }

    // Case 2: Component mounted with cached data (no loading transition)
    // This handles switching to Grid view when data is already loaded
    if (!hasInitializedRef.current && !isLoading && articles.length > 0) {
      hasInitializedRef.current = true;
      const timer = setTimeout(() => setShouldAnimate(true), 50);
      prevLoadingRef.current = isLoading;
      return () => clearTimeout(timer);
    }

    // Case 3: Fallback - ensure animation triggers when data becomes available
    // This handles edge cases like navigation back with React Query cache
    if (!shouldAnimate && !isLoading && articles.length > 0) {
      const timer = setTimeout(() => setShouldAnimate(true), 50);
      return () => clearTimeout(timer);
    }

    prevLoadingRef.current = isLoading;
  }, [isLoading, articles.length, shouldAnimate]);

  // Infinite Scroll Handler
  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [isFetchingNextPage, hasNextPage, onLoadMore]);
  
  // Drawer handlers
  const handleCardClick = useCallback((article: Article) => {
    if (isMultiColumnGrid) {
      // Desktop multi-column grid: Open drawer
      previousScrollPositionRef.current = window.scrollY;
      
      // Set flag to prevent useEffect from double-updating
      isUpdatingFromUrlRef.current = true;
      
      // Update state first
      setExpandedArticleId(article.id);
      setDrawerOpen(true);
      
      // Update URL without navigation (use replace to avoid adding history entry)
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set('expanded', article.id);
        return newParams;
      }, { replace: true });
      
      // Reset flag after a brief delay to allow URL update to complete
      setTimeout(() => {
        isUpdatingFromUrlRef.current = false;
      }, 100);
    } else {
      // Mobile/Feed: Use existing onClick handler (opens modal or inline expansion)
      onArticleClick(article);
    }
  }, [isMultiColumnGrid, onArticleClick, setSearchParams]);
  
  // YouTube timestamp click handler (for drawer)
  const handleYouTubeTimestampClick = useCallback((_videoId: string, _timestamp: number, _originalUrl: string) => {
    // This will be handled by ArticleDetail component in the drawer
    // The handler is passed through to maintain consistency
  }, []);
  
  const handleDrawerClose = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    // Set flag to prevent useEffect from double-updating
    isUpdatingFromUrlRef.current = true;
    
    setDrawerOpen(false);
    
    // Remove expanded param from URL
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('expanded');
      return newParams;
    }, { replace: true });
    
    // Reset flag after a brief delay
    setTimeout(() => {
      isUpdatingFromUrlRef.current = false;
    }, 100);
    
    // Restore scroll position after animation (matches drawer transform duration)
    setTimeout(() => {
      window.scrollTo({ top: previousScrollPositionRef.current, behavior: 'auto' });
      setExpandedArticleId(null);
    }, 200);
  }, [setSearchParams]);
  
  const handleNavigateToCard = useCallback((direction: 'prev' | 'next') => {
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < displayArticles.length) {
      const newArticle = displayArticles[newIndex];
      
      // Set flag to prevent useEffect from double-updating
      isUpdatingFromUrlRef.current = true;
      
      setExpandedArticleId(newArticle.id);
      
      // Update URL with new article ID
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set('expanded', newArticle.id);
        return newParams;
      }, { replace: true });
      
      // Reset flag after a brief delay
      setTimeout(() => {
        isUpdatingFromUrlRef.current = false;
      }, 100);
      
      // Scroll to new card in grid (optional enhancement)
      const cardElement = document.querySelector(`[data-article-id="${newArticle.id}"]`);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentIndex, displayArticles, setSearchParams]);

  // Error State: Show error UI when query fails
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

  // Show immediate skeleton structure while initial data loads, except in
  // masonry view where MasonryGrid renders its own shape-matched skeleton —
  // a generic grid skeleton there flashes the wrong layout before hydrate.
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

  // Render masonry layout
  if (viewMode === 'masonry') {
    return (
      <MasonryGrid
        articles={articles}
        isLoading={isLoading}
        onArticleClick={onArticleClick}
        onCategoryClick={onCategoryClick}
        currentUserId={currentUserId}
        onTagClick={onTagClick}
        // Infinite Scroll Props
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={onLoadMore}
        // Error Handling Props
        error={error}
        onRetry={onRetry}
      />
    );
  }

  // Render grid (normal-flow CSS grid — variable row heights are reliable).
  return (
    <div className="relative">
      {/* Feed refetch overlay (filters, search commit, stream, manual refresh, …) */}
      {isFeedRefetching && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-24 backdrop-blur-[1px] transition-opacity duration-200 dark:bg-slate-950/60">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-auto items-stretch mx-auto w-full">
        {displayArticles.map((article, index) => {
          const delay = Math.min(index * 50, 750);
          return (
            <ErrorBoundary
              key={article.id}
              fallback={
                <CardError
                  error={new Error('Failed to render card')}
                  variant="grid"
                />
              }
            >
              <div
                className={`
                  h-full
                  ${shouldAnimate ? 'animate-fade-in-up' : ''}
                  motion-reduce:animate-none motion-reduce:opacity-100
                `}
                style={{
                  animationDelay: shouldAnimate ? `${delay}ms` : '0ms',
                }}
                onMouseEnter={isMultiColumnGrid ? prefetchArticleDrawer : undefined}
                onFocus={isMultiColumnGrid ? prefetchArticleDrawer : undefined}
              >
                <NewsCard
                  ref={(el) => registerCard(article.id, el)}
                  article={article}
                  skipArticlePrepare
                  viewMode="grid"
                  onCategoryClick={onCategoryClick}
                  onClick={handleCardClick}
                  currentUserId={currentUserId}
                  onTagClick={onTagClick}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.includes(article.id)}
                  onSelect={onSelect ? () => onSelect(article.id) : undefined}
                  disableInlineExpansion={isMultiColumnGrid}
                  searchHighlightQuery={searchHighlightQuery}
                />
              </div>
            </ErrorBoundary>
          );
        })}
      </div>

      {/* Infinite scroll (masonry uses its own trigger inside MasonryGrid) */}
      <InfiniteScrollTrigger
        onIntersect={handleLoadMore}
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
      />
      
      {/* Article Drawer - Only for desktop multi-column grid */}
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


