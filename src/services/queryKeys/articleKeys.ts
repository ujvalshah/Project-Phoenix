import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Article } from '@/types';
import { FEED_COLLECTION_ENTRIES_INFINITE_PREFIX } from '@/services/queryKeys/feedPrefixes';
import { COLLECTION_DETAIL_INVALIDATION_PREFIX } from '@/services/queryKeys/collectionKeys';

type Primitive = string | number | boolean | null;
type KeyValue = Primitive | Primitive[] | undefined;

type QueryKeyParams = Record<string, KeyValue>;

function normalizeKeyParams<T extends QueryKeyParams>(params: T): Record<string, Primitive | Primitive[]> {
  const normalizedEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, [...value].sort()] as const;
      }
      return [key, value as Primitive] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  return Object.fromEntries(normalizedEntries);
}

export const articleKeys = {
  all: ['articles'] as const,
  details: () => ['articles', 'detail'] as const,
  detail: (articleId: string) => ['articles', 'detail', articleId] as const,
  legacyDetail: (articleId: string) => ['article', articleId] as const,

  lists: () => ['articles', 'list'] as const,
  list: (params: QueryKeyParams) =>
    ['articles', 'list', normalizeKeyParams(params)] as const,

  infiniteLists: () => ['articles', 'infinite'] as const,
  infiniteList: (params: QueryKeyParams) =>
    ['articles', 'infinite', normalizeKeyParams(params)] as const,

  myspaceBase: (userId: string) => ['articles', 'myspace', userId] as const,
  myspace: (userId: string, visibility: 'public' | 'private') =>
    ['articles', 'myspace', userId, visibility] as const,

  masonryLists: () => ['articles', 'masonry'] as const,
  masonryList: (params: QueryKeyParams) =>
    ['articles', 'masonry', normalizeKeyParams(params)] as const,
};

function patchArticleInArray(
  data: unknown,
  articleId: string,
  updater: (article: Article) => Article
): unknown {
  if (!Array.isArray(data)) return data;
  return data.map((item) =>
    item && typeof item === 'object' && (item as Article).id === articleId
      ? updater(item as Article)
      : item
  );
}

function patchArticleInResponse(
  data: unknown,
  articleId: string,
  updater: (article: Article) => Article
): unknown {
  if (!data || typeof data !== 'object') return data;

  const maybe = data as { data?: unknown };
  if (Array.isArray(maybe.data)) {
    return {
      ...maybe,
      data: patchArticleInArray(maybe.data, articleId, updater),
    };
  }

  return data;
}

function patchArticleInInfinite(
  data: unknown,
  articleId: string,
  updater: (article: Article) => Article
): unknown {
  const maybe = data as InfiniteData<{ data?: Article[] }> | undefined;
  if (!maybe?.pages || !Array.isArray(maybe.pages)) return data;

  return {
    ...maybe,
    pages: maybe.pages.map((page) => ({
      ...page,
      data: Array.isArray(page.data)
        ? (patchArticleInArray(page.data, articleId, updater) as Article[])
        : page.data,
    })),
  };
}

export function patchArticleAcrossCaches(
  queryClient: QueryClient,
  articleId: string,
  updater: (article: Article) => Article
): void {
  queryClient.setQueriesData({ queryKey: articleKeys.lists(), exact: false }, (oldData) =>
    patchArticleInResponse(oldData, articleId, updater)
  );
  queryClient.setQueriesData({ queryKey: articleKeys.infiniteLists(), exact: false }, (oldData) =>
    patchArticleInInfinite(oldData, articleId, updater)
  );
  queryClient.setQueriesData(
    { queryKey: FEED_COLLECTION_ENTRIES_INFINITE_PREFIX, exact: false },
    (oldData) => patchArticleInInfinite(oldData, articleId, updater),
  );
  queryClient.setQueriesData({ queryKey: ['articles', 'myspace'], exact: false }, (oldData) =>
    patchArticleInInfinite(oldData, articleId, updater)
  );
}

export async function invalidateArticleListCaches(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: articleKeys.lists(), exact: false }),
    queryClient.invalidateQueries({ queryKey: articleKeys.infiniteLists(), exact: false }),
    /** `/collections/:id` membership infinite lists (`feedKeys.collectionEntriesInfinite*`). */
    queryClient.invalidateQueries({
      queryKey: FEED_COLLECTION_ENTRIES_INFINITE_PREFIX,
      exact: false,
    }),
    /** Collection document rows (counts, names) touched when membership/order changes materially. */
    queryClient.invalidateQueries({
      queryKey: COLLECTION_DETAIL_INVALIDATION_PREFIX,
      exact: false,
    }),
    queryClient.invalidateQueries({ queryKey: ['articles', 'myspace'], exact: false }),
    queryClient.invalidateQueries({ queryKey: articleKeys.masonryLists(), exact: false }),
  ]);
}
