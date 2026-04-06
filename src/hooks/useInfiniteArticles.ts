import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { articleService, PaginatedArticlesResponse } from '@/services/articleService';
import { FilterState, SortOrder, Article } from '@/types';

interface UseInfiniteArticlesOptions {
  searchQuery: string;
  activeCategory: string; // 'All', 'Today', or category name (derived for query key)
  selectedCategories?: string[]; // Full categories array for multi-category filtering
  sortOrder?: SortOrder;
  limit?: number;
  tag?: string | null;    // Tag filter — sent to backend for server-side filtering
  collectionId?: string | null; // Community collection filter — server-side via collectionId param
  favorites?: boolean;
  unread?: boolean;
  formats?: string[];
  timeRange?: string;
  formatTagIds?: string[];
  domainTagIds?: string[];
  subtopicTagIds?: string[];
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
  /** True when fetching due to filter/sort change (not initial load or next page) */
  isFilterRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  refetch: () => void;
}

export const useInfiniteArticles = ({
  searchQuery,
  activeCategory,
  selectedCategories,
  sortOrder = 'latest',
  limit = 25,
  tag = null,
  collectionId = null,
  favorites = false,
  unread = false,
  formats = [],
  timeRange = 'all',
  formatTagIds = [],
  domainTagIds = [],
  subtopicTagIds = [],
}: UseInfiniteArticlesOptions): UseInfiniteArticlesResult => {
  // useInfiniteQuery automatically handles:
  // - Page accumulation
  // - Reset on query key change (category/search/sort/tag/collection changes)
  // - Caching
  // - Race condition protection
  const query = useInfiniteQuery<PaginatedArticlesResponse>({
    queryKey: ['articles', 'infinite', searchQuery.trim(), activeCategory, sortOrder, limit, tag ?? '', collectionId ?? '', favorites, unread, formats.join(','), timeRange, formatTagIds.join(','), domainTagIds.join(','), subtopicTagIds.join(',')],
    queryFn: async ({ pageParam = 1 }) => {
      // Build filters inside queryFn to avoid stale closures
      // Use full selectedCategories array when available, fall back to activeCategory
      const categoryParam = selectedCategories && selectedCategories.length > 0
        ? selectedCategories
        : activeCategory === 'All'
          ? []
          : [activeCategory];

      // Build filter state
      const filters: FilterState = {
        query: searchQuery.trim(),
        categories: categoryParam,
        tag: tag || null,
        sort: sortOrder,
        limit,
        collectionId: collectionId || undefined,
        favorites: favorites || undefined,
        unread: unread || undefined,
        formats: formats.length > 0 ? formats : undefined,
        timeRange: timeRange !== 'all' ? (timeRange as FilterState['timeRange']) : undefined,
        formatTagIds: formatTagIds.length > 0 ? formatTagIds : undefined,
        domainTagIds: domainTagIds.length > 0 ? domainTagIds : undefined,
        subtopicTagIds: subtopicTagIds.length > 0 ? subtopicTagIds : undefined,
      };

      return articleService.getArticles(filters, pageParam as number);
    },
    getNextPageParam: (lastPage) => {
      // Return next page number if there are more pages
      // Add null check to prevent errors during refetch/reset
      return lastPage?.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 30, // 30 seconds
    // CRITICAL FIX: Removed placeholderData - it interferes with page accumulation in infinite queries
    // React Query handles data persistence naturally without placeholderData
  });

  // Accumulate all pages into a single articles array (memoized)
  // Backend now handles all filtering (including "Today" date filter)
  // No client-side filtering needed - pagination works correctly
  // DEDUPLICATION FIX: Deduplicate articles by ID to prevent duplicates across page boundaries
  const articles = useMemo(() => {
    if (!query.data?.pages) {
      return [];
    }

    // Add null check for pages during refetch/reset
    const allArticles = query.data.pages.flatMap((page) => page?.data ?? []);

    // DEDUPLICATION: Remove duplicate articles by ID
    // This prevents the same article appearing multiple times if pagination boundaries shift
    const seen = new Set<string>();
    const deduplicated: Article[] = [];

    for (const article of allArticles) {
      if (article?.id && !seen.has(article.id)) {
        seen.add(article.id);
        deduplicated.push(article);
      }
    }

    if (deduplicated.length !== allArticles.length) {
      console.log('[useInfiniteArticles] Deduplicated articles:', {
        before: allArticles.length,
        after: deduplicated.length,
        removed: allArticles.length - deduplicated.length,
      });
    }

    return deduplicated;
  }, [query.data]); // FIXED: Use query.data instead of query.data?.pages for more reliable updates

  return {
    articles, // Return articles directly - backend has already filtered them
    isLoading: query.isLoading,
    isFilterRefetching: query.isFetching && !query.isLoading && !query.isFetchingNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false, // Backend's hasMore is now accurate for filtered data
    fetchNextPage: () => query.fetchNextPage(),
    error: query.error as Error | null,
    refetch: () => query.refetch(),
  };
};

