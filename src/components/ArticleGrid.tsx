import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Article } from '@/types';
import { NewsCard } from './NewsCard';
import { MasonryGrid } from './MasonryGrid';
import { EmptyState } from './UI/EmptyState';
import { SearchX, Loader2 } from 'lucide-react';
import { useRowExpansion } from '@/hooks/useRowExpansion';
import { ErrorBoundary } from './UI/ErrorBoundary';
import { sanitizeArticle } from '@/utils/errorHandler';
import { CardSkeleton } from './card/CardSkeleton';
import { CardError } from './card/CardError';
import { ArticleDrawer } from './ArticleDrawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ArticleGridProps {
  articles: Article[];
  viewMode: 'grid' | 'feed' | 'masonry' | 'utility';
  isLoading: boolean;
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
}) => {
  const { expandedId, toggleExpansion, registerCard } = useRowExpansion();
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const prevLoadingRef = useRef(isLoading);
  const hasInitializedRef = useRef(false);
  
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
      const article = articles.find(a => a.id === expandedIdFromUrl);
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
  }, [expandedIdFromUrl, articles, isMultiColumnGrid, setSearchParams]); // Removed drawerOpen from deps
  
  // Handle browser back/forward navigation
  useEffect(() => {
    if (!isMultiColumnGrid) return;
    
    const handlePopState = () => {
      // Read URL directly from window.location (popstate doesn't update React state immediately)
      const params = new URLSearchParams(window.location.search);
      const expandedId = params.get('expanded');
      
      if (expandedId) {
        const article = articles.find(a => a.id === expandedId);
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
  }, [articles, isMultiColumnGrid]);
  
  // Find expanded article and sanitize it to ensure author data exists
  const expandedArticle = expandedArticleId 
    ? (() => {
        const found = articles.find(a => a.id === expandedArticleId);
        return found ? sanitizeArticle(found) : null;
      })()
    : null;
  
  // Find current article index for navigation
  const currentIndex = expandedArticleId 
    ? articles.findIndex(a => a.id === expandedArticleId)
    : -1;
  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex >= 0 && currentIndex < articles.length - 1;

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
  const handleYouTubeTimestampClick = useCallback((videoId: string, timestamp: number, originalUrl: string) => {
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
    
    // Restore scroll position after animation
    setTimeout(() => {
      window.scrollTo({ top: previousScrollPositionRef.current, behavior: 'auto' });
      setExpandedArticleId(null);
    }, 300);
  }, [setSearchParams]);
  
  const handleNavigateToCard = useCallback((direction: 'prev' | 'next') => {
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < articles.length) {
      const newArticle = articles[newIndex];
      
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
  }, [currentIndex, articles, setSearchParams]);

  // Error State: Show error UI when query fails
  if (error && !isLoading) {
    return (
      <div
        className={
          viewMode === 'feed'
            ? "max-w-2xl mx-auto"
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-auto items-stretch mx-auto w-full"
        }
      >
        <CardError
          error={error}
          onRetry={onRetry}
          variant={viewMode === 'feed' ? 'feed' : 'grid'}
          className="col-span-full"
        />
      </div>
    );
  }

  // FIX #2: Remove duplicate masonry loading logic
  // MasonryGrid handles its own loading state with correct column count
  // This prevents visual mismatch between loading and loaded states
  if (isLoading && viewMode !== 'masonry') {
    return (
      <div
        className={
          viewMode === 'feed'
            ? "max-w-2xl mx-auto flex flex-col gap-8"
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-auto items-stretch mx-auto w-full"
        }
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <CardSkeleton
            key={i}
            variant={viewMode === 'feed' ? 'feed' : 'grid'}
          />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<SearchX />}
        title={emptyTitle}
        description={emptyMessage}
      />
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

  // Render feed, grid, or utility layout
  // RESPONSIVE CARD HEIGHTS:
  // - Mobile (1 col): auto-rows-auto - cards size to their content naturally
  // - Tablet+ (2+ cols): auto-rows-fr - equal height rows for visual consistency
  return (
    <div
      className={`
        transition-opacity duration-300 motion-reduce:transition-none
        ${shouldAnimate ? 'opacity-100' : 'opacity-100'}
        ${viewMode === 'feed'
          ? "max-w-2xl mx-auto flex flex-col gap-8"
          : viewMode === 'utility'
            ? "grid grid-cols-1 auto-rows-auto md:grid-cols-2 md:auto-rows-fr lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto w-full"
            : "grid grid-cols-1 auto-rows-auto md:grid-cols-2 md:auto-rows-fr lg:grid-cols-3 xl:grid-cols-4 gap-6 mx-auto w-full"
        }
      `}
    >
      {articles.map((article, index) => {
        // Sanitize article data before rendering
        const sanitized = sanitizeArticle(article);
        if (!sanitized) {
          console.warn('[ArticleGrid] Skipping invalid article:', article);
          return null;
        }

        // Calculate staggered delay (50ms per card, max 15 cards = 750ms)
        const delay = Math.min(index * 50, 750);

        return (
          <ErrorBoundary
            key={sanitized.id}
            fallback={
              <CardError
                error={new Error('Failed to render card')}
                variant={viewMode === 'feed' ? 'feed' : 'grid'}
              />
            }
          >
            <div
              className={`
                h-full
                ${shouldAnimate ? 'animate-fade-in-up' : 'opacity-0'}
                motion-reduce:animate-none motion-reduce:opacity-100
              `}
              style={{
                animationDelay: shouldAnimate ? `${delay}ms` : '0ms',
              }}
            >
              <NewsCard
                ref={(el) => registerCard(sanitized.id, el)}
                article={sanitized}
                viewMode={viewMode}
                onCategoryClick={onCategoryClick}
                onClick={handleCardClick}
                currentUserId={currentUserId}
                onTagClick={onTagClick}
                // Disable inline expansion for desktop multi-column grid
                disableInlineExpansion={isMultiColumnGrid}
              />
            </div>
          </ErrorBoundary>
        );
      })}

      {/* Infinite Scroll Trigger - Only show for grid/utility views (not masonry, which has its own) */}
      {viewMode !== 'masonry' && (
        <InfiniteScrollTrigger
          onIntersect={handleLoadMore}
          isLoading={isFetchingNextPage}
          hasMore={hasNextPage}
        />
      )}
      
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
  );
};


