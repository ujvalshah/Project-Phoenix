import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { articleService, PaginatedArticlesResponse } from '@/services/articleService';
import { FilterState, SortOrder, ContentStream, Article } from '@/types';

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
  contentStream?: ContentStream;
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
  totalCount?: number;
  isLoading: boolean;
  /** True when fetching due to filter/sort change (not initial load or next page) */
  isFilterRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  refetch: () => void;
}

export type InfiniteArticlesOptions = Required<
  Pick<
    UseInfiniteArticlesOptions,
    | 'searchQuery'
    | 'activeCategory'
    | 'sortOrder'
    | 'limit'
    | 'tag'
    | 'collectionId'
    | 'favorites'
    | 'unread'
    | 'formats'
    | 'timeRange'
    | 'formatTagIds'
    | 'domainTagIds'
    | 'subtopicTagIds'
    | 'selectedCategories'
  >
> &
  Pick<UseInfiniteArticlesOptions, 'contentStream'>;

const MIN_COMMITTED_QUERY_LENGTH = 3;

export const buildInfiniteArticlesQueryOptions = (options: InfiniteArticlesOptions) => ({
  queryKey: [
    'articles',
    'infinite',
    options.searchQuery.trim(),
    options.activeCategory,
    // Multi-select categories must participate in the key; otherwise changes
    // to selectedCategories don't refetch when activeCategory happens to
    // remain the same.
    options.selectedCategories.join(','),
    options.sortOrder,
    options.limit,
    options.tag ?? '',
    options.collectionId ?? '',
    options.favorites,
    options.unread,
    options.formats.join(','),
    options.timeRange,
    options.formatTagIds.join(','),
    options.domainTagIds.join(','),
    options.subtopicTagIds.join(','),
    options.contentStream ?? '',
  ],
  queryFn: async ({ pageParam = 1 }: { pageParam?: unknown }) => {
    const trimmedQuery = options.searchQuery.trim();
    if (trimmedQuery.length > 0 && trimmedQuery.length < MIN_COMMITTED_QUERY_LENGTH) {
      return {
        data: [],
        total: 0,
        page: pageParam as number,
        limit: options.limit,
        hasMore: false,
      };
    }

    const categoryParam =
      options.selectedCategories && options.selectedCategories.length > 0
        ? options.selectedCategories
        : options.activeCategory === 'All'
          ? []
          : [options.activeCategory];

    const filters: FilterState = {
      query: trimmedQuery,
      searchMode: trimmedQuery.length >= MIN_COMMITTED_QUERY_LENGTH ? 'relevance' : undefined,
      categories: categoryParam,
      tag: options.tag || null,
      sort: options.sortOrder,
      limit: options.limit,
      collectionId: options.collectionId || undefined,
      favorites: options.favorites || undefined,
      unread: options.unread || undefined,
      formats: options.formats.length > 0 ? options.formats : undefined,
      timeRange:
        options.timeRange !== 'all'
          ? (options.timeRange as FilterState['timeRange'])
          : undefined,
      formatTagIds:
        options.formatTagIds.length > 0 ? options.formatTagIds : undefined,
      domainTagIds:
        options.domainTagIds.length > 0 ? options.domainTagIds : undefined,
      subtopicTagIds:
        options.subtopicTagIds.length > 0 ? options.subtopicTagIds : undefined,
      contentStream: options.contentStream || undefined,
    };

    return articleService.getArticles(filters, pageParam as number);
  },
  getNextPageParam: (lastPage: PaginatedArticlesResponse) =>
    lastPage?.hasMore ? lastPage.page + 1 : undefined,
  initialPageParam: 1,
  staleTime: 1000 * 30,
});

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
  contentStream,
}: UseInfiniteArticlesOptions): UseInfiniteArticlesResult => {
  // useInfiniteQuery automatically handles:
  // - Page accumulation
  // - Reset on query key change (category/search/sort/tag/collection changes)
  // - Caching
  // - Race condition protection
  const query = useInfiniteQuery<PaginatedArticlesResponse>(
    buildInfiniteArticlesQueryOptions({
      searchQuery,
      activeCategory,
      selectedCategories: selectedCategories ?? [],
      sortOrder,
      limit,
      tag,
      collectionId,
      favorites,
      unread,
      formats,
      timeRange,
      formatTagIds,
      domainTagIds,
      subtopicTagIds,
      contentStream,
    }),
  );

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

    return deduplicated;
  }, [query.data]); // FIXED: Use query.data instead of query.data?.pages for more reliable updates

  const totalCount = query.data?.pages?.[0]?.total;

  return {
    articles, // Return articles directly - backend has already filtered them
    totalCount,
    isLoading: query.isLoading,
    isFilterRefetching: query.isFetching && !query.isLoading && !query.isFetchingNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false, // Backend's hasMore is now accurate for filtered data
    fetchNextPage: () => query.fetchNextPage(),
    error: query.error as Error | null,
    refetch: () => query.refetch(),
  };
};

