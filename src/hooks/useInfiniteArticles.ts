import type { Article } from '@/types';
import {
  useUnifiedInfiniteArticles,
  type UseInfiniteArticlesOptions,
} from '@/hooks/useUnifiedInfiniteArticles';

export type { InfiniteArticlesOptions, UseInfiniteArticlesOptions } from '@/hooks/useUnifiedInfiniteArticles';

export { buildInfiniteArticlesQueryOptions } from '@/hooks/useUnifiedInfiniteArticles';

export interface UseInfiniteArticlesResult {
  articles: Article[];
  totalCount?: number;
  isLoading: boolean;
  /** TanStack Query pending (used by pages that keyed off `useUnifiedInfiniteArticles`). */
  isPending: boolean;
  isFetched: boolean;
  isFetching: boolean;
  isFeedRefetching: boolean;
  isFilterRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  errorUpdatedAt: number;
  refetch: () => void;
}

/**
 * Filtered/stream infinite articles. Uses {@link useUnifiedInfiniteArticles}.
 */
export function useInfiniteArticles(options: UseInfiniteArticlesOptions): UseInfiniteArticlesResult {
  const query = useUnifiedInfiniteArticles(options);
  return {
    articles: query.articles,
    totalCount: query.totalCount,
    isLoading: query.isLoading,
    isPending: query.isPending,
    isFetched: query.isFetched,
    isFetching: query.isFetching,
    isFeedRefetching: query.isFeedRefetching,
    isFilterRefetching: query.isFeedRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
    error: query.error,
    errorUpdatedAt: query.errorUpdatedAt,
    refetch: () => void query.refetch(),
  };
}
