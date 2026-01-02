import React, { useRef, useEffect, useCallback } from 'react';
import { Article } from '@/types';
import { NewsCard } from './NewsCard';
import { MasonryGrid } from './MasonryGrid';
import { EmptyState } from './UI/EmptyState';
import { SearchX, Loader2 } from 'lucide-react';
import { useRowExpansion } from '@/hooks/useRowExpansion';
import { ErrorBoundary } from './UI/ErrorBoundary';
import { sanitizeArticle } from '@/utils/errorHandler';

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
}) => {
  const { expandedId, toggleExpansion, registerCard } = useRowExpansion();

  // Infinite Scroll Handler
  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [isFetchingNextPage, hasNextPage, onLoadMore]);

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
          <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-2xl h-80 animate-pulse" />
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
      />
    );
  }

  // Render feed, grid, or utility layout
  // Debug: Log viewMode to verify it's being passed correctly
  if (process.env.NODE_ENV === 'development' && viewMode === 'utility') {
    console.log('[ArticleGrid] Rendering utility viewMode for', articles.length, 'articles');
  }
  
  return (
    <div
      className={
        viewMode === 'feed'
          ? "max-w-2xl mx-auto flex flex-col gap-8"
          : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-auto items-stretch mx-auto w-full"
      }
    >
      {articles.map((article) => {
        // Sanitize article data before rendering
        const sanitized = sanitizeArticle(article);
        if (!sanitized) {
          console.warn('[ArticleGrid] Skipping invalid article:', article);
          return null;
        }
        
        return (
          <ErrorBoundary key={sanitized.id} fallback={<div className="p-4 text-sm text-slate-500">Failed to load nugget</div>}>
            <NewsCard
              ref={(el) => registerCard(sanitized.id, el)}
              article={sanitized}
              viewMode={viewMode}
              onCategoryClick={onCategoryClick}
              onClick={onArticleClick}
              currentUserId={currentUserId}
              onTagClick={onTagClick}
            />
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


