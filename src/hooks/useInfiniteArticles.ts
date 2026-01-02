import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { articleService, PaginatedArticlesResponse } from '@/services/articleService';
import { FilterState, SortOrder, Article } from '@/types';

interface UseInfiniteArticlesOptions {
  searchQuery: string;
  activeCategory: string; // 'All', 'Today', or category name
  sortOrder?: SortOrder;
  limit?: number;
}

/**
 * Unified infinite scroll hook using React Query's useInfiniteQuery
 * 
 * Phase 3: Replaces manual state management in Feed.tsx
 * - Handles pagination automatically
 * - Accumulates pages across fetches
 * - Resets on filter changes via query key
 * - Provides fetchNextPage for infinite scroll
 */
export interface UseInfiniteArticlesResult {
  articles: Article[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  refetch: () => void;
}

export const useInfiniteArticles = ({
  searchQuery,
  activeCategory,
  sortOrder = 'latest',
  limit = 25,
}: UseInfiniteArticlesOptions): UseInfiniteArticlesResult => {
  // useInfiniteQuery automatically handles:
  // - Page accumulation
  // - Reset on query key change (category/search/sort changes)
  // - Caching
  // - Race condition protection
  const query = useInfiniteQuery<PaginatedArticlesResponse>({
    queryKey: ['articles', 'infinite', searchQuery.trim(), activeCategory, sortOrder, limit],
    queryFn: async ({ pageParam = 1 }) => {
      // Build filters inside queryFn to avoid stale closures
      // Determine category parameter for backend
      // "Today" is now handled by backend, so pass it through
      const categoryParam = activeCategory === 'All'
        ? []
        : [activeCategory]; // Include "Today" or any other category

      // Build filter state
      const filters: FilterState = {
        query: searchQuery.trim() || undefined,
        categories: categoryParam,
        tag: null,
        sort: sortOrder,
        limit,
      };

      return articleService.getArticles(filters, pageParam as number);
    },
    getNextPageParam: (lastPage) => {
      // Return next page number if there are more pages
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 30, // 30 seconds
    // CRITICAL FIX: Removed placeholderData - it interferes with page accumulation in infinite queries
    // React Query handles data persistence naturally without placeholderData
  });

  // Accumulate all pages into a single articles array (memoized)
  // Backend now handles all filtering (including "Today" date filter)
  // No client-side filtering needed - pagination works correctly
  const articles = useMemo(() => {
    if (!query.data?.pages) {
      return [];
    }
    
    return query.data.pages.flatMap((page) => page.data);
  }, [query.data]); // FIXED: Use query.data instead of query.data?.pages for more reliable updates

  return {
    articles, // Return articles directly - backend has already filtered them
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false, // Backend's hasMore is now accurate for filtered data
    fetchNextPage: () => query.fetchNextPage(),
    error: query.error as Error | null,
    refetch: () => query.refetch(),
  };
};

