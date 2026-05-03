import {
  useInfiniteQuery,
  type FetchNextPageOptions,
  type InfiniteData,
  type RefetchOptions,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { articleService, PaginatedArticlesResponse } from '@/services/articleService';
import type { Article, ContentStream, FilterState, SortOrder } from '@/types';
import {
  feedKeys,
  FEED_COLLECTION_ENTRIES_SORT_LATEST,
  FEED_COLLECTION_ENTRIES_PAGE_SIZE,
} from '@/services/queryKeys/feedKeys';
import { INFINITE_ARTICLES_STALE_MS } from '@/constants/reactQueryTiming';
import { MIN_RELEVANCE_SEARCH_LENGTH, normalizeSearchQuery } from '@/utils/searchQuery';
import { resolveCommittedSearchMode } from '@/utils/searchMode';
import { storageService } from '@/services/storageService';

// ── Stream feed (Home / Collections scoped / Saved later) ───────────────────

export interface UseInfiniteArticlesOptions {
  searchQuery: string;
  activeCategory: string;
  selectedCategories?: string[];
  sortOrder?: SortOrder;
  limit?: number;
  tag?: string | null;
  collectionId?: string | null;
  favorites?: boolean;
  unread?: boolean;
  formats?: string[];
  timeRange?: string;
  formatTagIds?: string[];
  domainTagIds?: string[];
  subtopicTagIds?: string[];
  contentStream?: ContentStream;
  /** When false, the stream infinite query does not fetch (defaults true). */
  enabled?: boolean;
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
  Pick<UseInfiniteArticlesOptions, 'contentStream'> & {
    resolvedSearchMode?: FilterState['searchMode'];
  };

export const buildInfiniteArticlesQueryOptions = (options: InfiniteArticlesOptions) => ({
  queryKey: feedKeys.streamInfinite({
    q: normalizeSearchQuery(options.searchQuery),
    searchMode: options.resolvedSearchMode ?? '',
    activeCategory: options.activeCategory,
    selectedCategories: options.selectedCategories,
    sortOrder: options.sortOrder,
    limit: options.limit,
    tag: options.tag ?? '',
    collectionId: options.collectionId ?? '',
    favorites: options.favorites,
    unread: options.unread,
    formats: options.formats,
    timeRange: options.timeRange,
    formatTagIds: options.formatTagIds,
    domainTagIds: options.domainTagIds,
    subtopicTagIds: options.subtopicTagIds,
    contentStream: options.contentStream ?? '',
  }),
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const trimmedQuery = normalizeSearchQuery(options.searchQuery);
    const resolvedSearchMode =
      options.resolvedSearchMode ?? resolveCommittedSearchMode(trimmedQuery);

    const categoryParam =
      options.selectedCategories && options.selectedCategories.length > 0
        ? options.selectedCategories
        : options.activeCategory === 'All'
          ? []
          : [options.activeCategory];

    const filters: FilterState = {
      query: trimmedQuery,
      searchMode:
        trimmedQuery.length >= MIN_RELEVANCE_SEARCH_LENGTH ? resolvedSearchMode : undefined,
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

    return articleService.getArticles(filters, pageParam);
  },
  getNextPageParam: (lastPage: PaginatedArticlesResponse) =>
    lastPage?.hasMore ? lastPage.page + 1 : undefined,
  initialPageParam: 1 as const,
  staleTime: INFINITE_ARTICLES_STALE_MS,
});

/** Inert stream config when `/collections/:id` branch is active (must never run). */
const disabledStreamInfiniteOptions = buildInfiniteArticlesQueryOptions({
  searchQuery: '',
  resolvedSearchMode: undefined,
  activeCategory: 'All',
  selectedCategories: [],
  sortOrder: 'latest',
  limit: 25,
  tag: null,
  collectionId: null,
  favorites: false,
  unread: false,
  formats: [],
  timeRange: 'all',
  formatTagIds: [],
  domainTagIds: [],
  subtopicTagIds: [],
  contentStream: undefined,
});

export interface UnifiedInfiniteArticlesResult {
  articles: Article[];
  totalCount?: number;
  hasNextPage: boolean;
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<unknown>;
  isFetchingNextPage: boolean;
  isFetching: boolean;
  isFetched: boolean;
  isPending: boolean;
  isLoading: boolean;
  isFeedRefetching: boolean;
  error: Error | null;
  errorUpdatedAt: number;
  refetch: (options?: RefetchOptions) => Promise<unknown>;
}

function flattenDedupeArticles(pages: PaginatedArticlesResponse[]): Article[] {
  const seen = new Set<string>();
  const deduplicated: Article[] = [];

  for (const page of pages) {
    for (const article of page?.data ?? []) {
      if (article?.id && !seen.has(article.id)) {
        seen.add(article.id);
        deduplicated.push(article);
      }
    }
  }

  return deduplicated;
}

export function buildCollectionEntriesInfiniteQueryOptions(collectionId: string) {
  const limit = FEED_COLLECTION_ENTRIES_PAGE_SIZE;
  const sort = FEED_COLLECTION_ENTRIES_SORT_LATEST;
  return {
    queryKey: feedKeys.collectionEntriesInfinite({ collectionId, limit, sort }),
    queryFn: async ({ pageParam }: { pageParam: unknown }): Promise<PaginatedArticlesResponse> => {
      const page =
        typeof pageParam === 'number' && Number.isFinite(pageParam) ? pageParam : 1;
      try {
        return await storageService.getCollectionArticles(collectionId, {
          page,
          limit,
          sort,
        });
      } catch (e) {
        console.error('Failed to load collection data:', e);
        throw e;
      }
    },
    initialPageParam: 1 as const,
    getNextPageParam: (lastPage: PaginatedArticlesResponse) =>
      lastPage?.hasMore ? lastPage.page + 1 : undefined,
    staleTime: INFINITE_ARTICLES_STALE_MS,
  };
}

/** Inert collection-membership config when stream branch is active. */
const disabledCollectionInfiniteOptions =
  buildCollectionEntriesInfiniteQueryOptions('__inactive_collection_scope__');

export type UnifiedFeedInput =
  | (UseInfiniteArticlesOptions & { scope?: 'stream' })
  | {
      scope: 'collection-entries';
      collectionId: string | undefined;
      enabled: boolean;
    };

export function useUnifiedInfiniteArticles(input: UnifiedFeedInput): UnifiedInfiniteArticlesResult {
  const isCollect = input.scope === 'collection-entries';
  const collectionIdTrimmed = isCollect ? (input.collectionId?.trim() ?? '') : '';
  const collectionGate = isCollect && Boolean(collectionIdTrimmed) && input.enabled;

  const streamInput = !isCollect ? (input as UseInfiniteArticlesOptions) : null;
  const streamEnabled = streamInput ? (streamInput.enabled ?? true) : false;

  const streamInfiniteOptions = useMemo(() => {
    if (!streamInput) {
      return disabledStreamInfiniteOptions;
    }
    const normalizedSearchQuery = normalizeSearchQuery(streamInput.searchQuery);
    const resolvedSearchMode = resolveCommittedSearchMode(normalizedSearchQuery);
    return buildInfiniteArticlesQueryOptions({
      searchQuery: streamInput.searchQuery,
      resolvedSearchMode,
      activeCategory: streamInput.activeCategory,
      selectedCategories: streamInput.selectedCategories ?? [],
      sortOrder: streamInput.sortOrder ?? 'latest',
      limit: streamInput.limit ?? 25,
      tag: streamInput.tag ?? null,
      collectionId: streamInput.collectionId ?? null,
      favorites: streamInput.favorites ?? false,
      unread: streamInput.unread ?? false,
      formats: streamInput.formats ?? [],
      timeRange: streamInput.timeRange ?? 'all',
      formatTagIds: streamInput.formatTagIds ?? [],
      domainTagIds: streamInput.domainTagIds ?? [],
      subtopicTagIds: streamInput.subtopicTagIds ?? [],
      contentStream: streamInput.contentStream,
    });
  }, [
    streamInput?.activeCategory,
    streamInput?.collectionId,
    streamInput?.contentStream,
    streamInput?.domainTagIds?.join('\u241e'),
    streamInput?.favorites,
    streamInput?.formatTagIds?.join('\u241e'),
    streamInput?.formats?.join('\u241e'),
    streamInput?.limit,
    streamInput?.searchQuery,
    streamInput?.selectedCategories?.join('\u241e'),
    streamInput?.sortOrder,
    streamInput?.subtopicTagIds?.join('\u241e'),
    streamInput?.tag,
    streamInput?.timeRange,
    streamInput?.unread,
  ]);

  const streamQuery = useInfiniteQuery<
    PaginatedArticlesResponse,
    Error,
    InfiniteData<PaginatedArticlesResponse, number>,
    readonly unknown[],
    number
  >({
    queryKey: streamInfiniteOptions.queryKey,
    enabled: !isCollect && streamEnabled,
    queryFn: streamInfiniteOptions.queryFn,
    getNextPageParam: streamInfiniteOptions.getNextPageParam,
    initialPageParam: streamInfiniteOptions.initialPageParam,
    staleTime: streamInfiniteOptions.staleTime,
  });

  const collectionInfiniteOptions = useMemo(() => {
    if (!collectionGate) {
      return disabledCollectionInfiniteOptions;
    }
    return buildCollectionEntriesInfiniteQueryOptions(collectionIdTrimmed);
  }, [collectionGate, collectionIdTrimmed]);

  const collectionQuery = useInfiniteQuery<
    PaginatedArticlesResponse,
    Error,
    InfiniteData<PaginatedArticlesResponse, number>,
    readonly unknown[],
    number
  >({
    queryKey: collectionInfiniteOptions.queryKey,
    enabled: collectionGate,
    queryFn: collectionInfiniteOptions.queryFn,
    getNextPageParam: collectionInfiniteOptions.getNextPageParam,
    initialPageParam: collectionInfiniteOptions.initialPageParam,
    staleTime: collectionInfiniteOptions.staleTime,
  });

  const query = !isCollect ? streamQuery : collectionQuery;
  const articles = useMemo(() => {
    if (!query.data?.pages?.length) {
      return [];
    }
    return flattenDedupeArticles(query.data.pages);
  }, [query.data]);

  const totalCount = query.data?.pages?.[0]?.total;

  const isFeedRefetching =
    query.isFetching && !query.isLoading && !query.isFetchingNextPage;

  return {
    articles,
    totalCount,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetching: query.isFetching,
    isFetched: query.isFetched,
    isPending: query.isPending,
    isLoading: query.isLoading,
    isFeedRefetching,
    error: (query.error as Error | null) ?? null,
    errorUpdatedAt: query.errorUpdatedAt,
    refetch: query.refetch,
  };
}
