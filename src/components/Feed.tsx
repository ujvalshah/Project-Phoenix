// Phase 3: Unified data fetching using useInfiniteQuery
// This component now uses useInfiniteArticles hook for unified React Query pattern.
// Eliminates split-brain data fetching model (useArticles vs Feed.tsx).

import React, { useRef, useEffect, useCallback } from 'react';
import { Article } from '@/types';
import { NewsCard } from './NewsCard';
import { Loader2 } from 'lucide-react';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';

interface FeedProps {
  activeCategory: string; // 'All', 'Today', or category name
  searchQuery?: string;
  sortOrder?: 'latest' | 'oldest'; // Sort order from Header UI
  selectedTag?: string | null; // Tag filter (client-side, backend doesn't support tag filtering)
  onArticleClick: (article: Article) => void;
  onCategoryClick: (category: string) => void;
  onTagClick?: (tag: string) => void;
  currentUserId?: string;
}

// Skeleton Component for Initial Load
const NuggetSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 animate-pulse">
    <div className="flex items-start gap-4 mb-4">
      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
      <div className="flex-1">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32" />
      </div>
    </div>
    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6 mb-4" />
    <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg mb-4" />
    <div className="flex gap-2">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-20" />
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-16" />
    </div>
  </div>
);

// Infinite Scroll Trigger Component
// Uses useRef for callback to avoid re-subscribing observer on every render
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
    if (!hasMore) {
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          callbackRef.current();
        }
      },
      {
        rootMargin: '300px', // Increased prefetch distance for smoother UX
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
  }, [hasMore]); // Only re-subscribe when hasMore changes

  if (!hasMore) return null;

  return (
    <div ref={triggerRef} className="flex justify-center py-6">
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-medium">Loading more...</span>
        </div>
      )}
    </div>
  );
};

export const Feed: React.FC<FeedProps> = ({
  activeCategory,
  searchQuery = '',
  sortOrder = 'latest',
  selectedTag = null,
  onArticleClick,
  onCategoryClick,
  onTagClick,
  currentUserId,
}) => {
  // Phase 3: Unified data fetching using useInfiniteQuery
  // React Query handles:
  // - Pagination accumulation
  // - Filter reset (via query key changes)
  // - Caching
  // - Race condition protection
  const {
    articles: allNuggets,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteArticles({
    searchQuery,
    activeCategory,
    sortOrder, // Connected to Header sort dropdown
    limit: 25,
  });

  // Apply tag filtering client-side (backend doesn't support tag filtering)
  // Tags are mandatory - filter for nuggets containing the selected tag
  const nuggets = React.useMemo(() => {
    if (!selectedTag) return allNuggets;
    
    return allNuggets.filter(article => {
      const tags = article.tags || [];
      return tags.includes(selectedTag);
    });
  }, [allNuggets, selectedTag]);

  // Infinite Scroll Handler - memoized for stable reference
  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  // Render Initial Load Skeletons
  if (isLoading && nuggets.length === 0) {
    return (
      <div className="w-full flex flex-col gap-7">
        {Array.from({ length: 8 }).map((_, i) => (
          <NuggetSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    );
  }

  // Render Error State
  if (error && nuggets.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12">
        <p className="text-gray-500 mb-4">{error.message || 'Failed to load feed'}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Render Empty State
  if (nuggets.length === 0 && !isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12">
        <p className="text-gray-500">No nuggets found.</p>
        <p className="text-sm text-gray-400 mt-2">Try adjusting your filters.</p>
      </div>
    );
  }

  // Render Feed
  // Finance-grade: Consistent vertical rhythm (24-32px gap = gap-7 = 28px)
  return (
    <div className="w-full flex flex-col gap-7">
      {nuggets.map((article) => (
        <NewsCard
          key={article.id}
          article={article}
          viewMode="feed"
          onCategoryClick={onCategoryClick}
          onClick={onArticleClick}
          currentUserId={currentUserId}
          onTagClick={onTagClick}
        />
      ))}

      {/* Infinite Scroll Trigger */}
      <InfiniteScrollTrigger
        onIntersect={handleLoadMore}
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
      />
    </div>
  );
};

