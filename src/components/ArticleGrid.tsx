import React, { useRef, useEffect, useCallback, useState } from 'react';
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

  // Trigger animations when loading completes OR when component mounts with data
  useEffect(() => {
    // Case 1: Transitioning from loading → loaded (initial load)
    if (prevLoadingRef.current && !isLoading && articles.length > 0) {
      const timer = setTimeout(() => setShouldAnimate(true), 50);
      return () => clearTimeout(timer);
    }

    // Case 2: Component mounted with cached data (no loading transition)
    // This handles switching to Grid view when data is already loaded
    if (!hasInitializedRef.current && !isLoading && articles.length > 0) {
      hasInitializedRef.current = true;
      const timer = setTimeout(() => setShouldAnimate(true), 50);
      return () => clearTimeout(timer);
    }

    prevLoadingRef.current = isLoading;
  }, [isLoading, articles.length]);

  // Infinite Scroll Handler
  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [isFetchingNextPage, hasNextPage, onLoadMore]);

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
                onClick={onArticleClick}
                currentUserId={currentUserId}
                onTagClick={onTagClick}
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
    </div>
  );
};


