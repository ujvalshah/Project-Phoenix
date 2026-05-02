import React, { useRef, useEffect, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Article } from '@/types';
import { NewsCard } from './NewsCard';
import { MasonryGrid } from './MasonryGrid';
import { HomeGridVirtualized } from '@/components/feed/HomeGridVirtualized';
import type { HomeGridVirtualizedApi } from '@/components/feed/HomeGridVirtualized';
import { EmptyState } from './UI/EmptyState';
import { SearchX, Loader2 } from 'lucide-react';
import { useRowExpansion } from '@/hooks/useRowExpansion';
import { ErrorBoundary } from './UI/ErrorBoundary';
import { prepareArticleForNewsCard } from '@/utils/errorHandler';
import { CardSkeleton } from './card/CardSkeleton';
import { CardError } from './card/CardError';
import { ArticleDrawer } from './ArticleDrawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { isFeatureEnabled } from '@/constants/featureFlags';
import { useHomeGridColumnCount } from '@/hooks/useHomeGridColumnCount';
import { getPriorityThumbnailCount } from '@/constants/aboveFoldPriority';

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

const LOCAL_RENDER_INITIAL = 80;
const LOCAL_RENDER_BATCH = 40;

const LocalRenderBatchTrigger: React.FC<{
  hasHiddenItems: boolean;
  onRevealMore: () => void;
}> = ({ hasHiddenItems, onRevealMore }) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onRevealMore);

  useEffect(() => {
    callbackRef.current = onRevealMore;
  }, [onRevealMore]);

  useEffect(() => {
    if (!hasHiddenItems) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          callbackRef.current();
        }
      },
      {
        rootMargin: '200px',
        threshold: 0,
      }
    );
    const currentTrigger = triggerRef.current;
    if (currentTrigger) {
      observer.observe(currentTrigger);
    }
    return () => observer.disconnect();
  }, [hasHiddenItems]);

  if (!hasHiddenItems) return null;
  return <div ref={triggerRef} className="h-6 w-full col-span-full" aria-hidden="true" />;
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
  /** Stagger fade-in only for the first rows so very long feeds do not schedule hundreds of delayed animations. */
  const staggerCapIndex = 20;

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
  const isUpdatingFromUrlRef = useRef(false); // Prevent double updates
  
  // Detect if we're in desktop multi-column grid mode
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMultiColumnGrid = viewMode === 'grid' && isDesktop;

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

  const gridColumnCount = useHomeGridColumnCount();
  const priorityThumbnailCount = useMemo(
    () => getPriorityThumbnailCount(gridColumnCount),
    [gridColumnCount],
  );
  // Phase A safety rail: virtualize only in single-column layout.
  // Multi-column desktop keeps the proven non-virtualized grid because row-banding
  // introduces visible dead-space artifacts with mixed-height cards.
  const virtualizeHomeGrid =
    isFeatureEnabled('HOME_FEED_VIRTUALIZATION') &&
    viewMode === 'grid' &&
    gridColumnCount === 1;
  const homeGridVirtualApiRef = useRef<HomeGridVirtualizedApi | null>(null);
  const virtualListAnchorRef = useRef<HTMLDivElement>(null);
  const [virtualListScrollMargin, setVirtualListScrollMargin] = useState(0);
  const [localRenderCount, setLocalRenderCount] = useState(LOCAL_RENDER_INITIAL);
  const virtualizeHomeGridRef = useRef(virtualizeHomeGrid);
  virtualizeHomeGridRef.current = virtualizeHomeGrid;

  useLayoutEffect(() => {
    if (!virtualizeHomeGrid) return;
    const el = virtualListAnchorRef.current;
    if (!el) return;
    const compute = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setVirtualListScrollMargin(Math.max(0, Math.round(top)));
    };
    compute();
    window.addEventListener('resize', compute);
    // Catch late layout shifts from fonts/images/async chrome above the list.
    window.addEventListener('load', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('load', compute);
    };
  }, [virtualizeHomeGrid, displayArticles.length, gridColumnCount]);

  useEffect(() => {
    if (virtualizeHomeGrid) return;
    setLocalRenderCount((prev) => {
      const next = Math.max(prev, LOCAL_RENDER_INITIAL);
      return Math.min(next, Math.max(LOCAL_RENDER_INITIAL, displayArticles.length));
    });
  }, [displayArticles.length, virtualizeHomeGrid]);

  useEffect(() => {
    if (!virtualizeHomeGrid || !isMultiColumnGrid) return;
    if (!drawerOpen || !expandedArticleId) return;
    const idx = displayArticles.findIndex((a) => a.id === expandedArticleId);
    if (idx < 0) return;
    const id = requestAnimationFrame(() => {
      homeGridVirtualApiRef.current?.scrollToFlatArticleIndex(idx);
    });
    return () => cancelAnimationFrame(id);
  }, [
    virtualizeHomeGrid,
    isMultiColumnGrid,
    drawerOpen,
    expandedArticleId,
    displayArticles,
  ]);

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

  // Warm the drawer detail chunk in desktop grid mode so first open avoids suspense spinner jank.
  useEffect(() => {
    if (!isMultiColumnGrid || displayArticles.length === 0) return;
    void import('./ArticleDetail');
  }, [isMultiColumnGrid, displayArticles.length]);

  // Infinite Scroll Handler
  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [isFetchingNextPage, hasNextPage, onLoadMore]);

  const revealMoreLocalCards = useCallback(() => {
    setLocalRenderCount((prev) => Math.min(displayArticles.length, prev + LOCAL_RENDER_BATCH));
  }, [displayArticles.length]);
  
  // Drawer handlers
  const handleCardClick = useCallback((article: Article) => {
    if (isMultiColumnGrid) {
      // Desktop multi-column grid: Open drawer
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

    // Clear selected article immediately on close; ArticleDrawer already handles exit animation
    // and scroll-lock restoration, so delaying this introduces noticeable close/open lag.
    setExpandedArticleId(null);
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
      
      if (virtualizeHomeGridRef.current) {
        homeGridVirtualApiRef.current?.scrollToFlatArticleIndex(newIndex);
      }
      // Scroll to new card in grid (optional enhancement; may no-op if row not mounted yet)
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
  const gridArticles = virtualizeHomeGrid
    ? displayArticles
    : displayArticles.slice(0, localRenderCount);
  const hasHiddenGridArticles =
    !virtualizeHomeGrid && gridArticles.length < displayArticles.length;

  return (
    <div className="relative">
      {/* Feed refetch overlay (filters, search commit, stream, manual refresh, …) */}
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
      {virtualizeHomeGrid ? (
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
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-auto items-stretch mx-auto w-full">
          {gridArticles.map((article, index) => {
            const isPriorityTile = index < priorityThumbnailCount;
            const useEntranceAnimation =
              shouldAnimate && !isPriorityTile && index <= staggerCapIndex;
            const delay =
              useEntranceAnimation ? Math.min(index * 50, 750) : 0;
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
                  ${useEntranceAnimation ? 'animate-fade-in-up' : ''}
                  motion-reduce:animate-none motion-reduce:opacity-100
                `}
                  style={{
                    animationDelay: useEntranceAnimation ? `${delay}ms` : '0ms',
                  }}
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
                    priorityThumbnail={isPriorityTile}
                  />
                </div>
              </ErrorBoundary>
            );
          })}
          <LocalRenderBatchTrigger
            hasHiddenItems={hasHiddenGridArticles}
            onRevealMore={revealMoreLocalCards}
          />
        </div>
      )}

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


