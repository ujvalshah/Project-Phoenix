/**
 * Unified feed/query surface for TanStack infinite article lists:
 * – **stream**: Home, Collections scoped browse, Saved later (`articleKeys.infiniteList` tuples).
 * – **collection-entries**: membership list on `/collections/:id` (`getCollectionArticles`).
 */

import { articleKeys } from './articleKeys';
import { FEED_COLLECTION_ENTRIES_INFINITE_PREFIX } from './feedPrefixes';

export const FEED_COLLECTION_ENTRIES_PAGE_SIZE = 30;
export const FEED_COLLECTION_ENTRIES_SORT_LATEST = 'latest' as const;

const feedRoot = ['feed'] as const;

export const feedKeys = {
  all: feedRoot,

  /**
   * Filtered/stream infinite feed — **same tuples as `articleKeys.infiniteList`** for cache parity.
   */
  streamInfinite: articleKeys.infiniteList,

  collectionEntriesInfiniteRoot: (collectionId: string) =>
    [...feedRoot, 'collection-entries', 'infinite', collectionId] as const,

  collectionEntriesInfinite: (params: {
    collectionId: string;
    limit: number;
    sort: string;
  }) =>
    [
      ...feedRoot,
      'collection-entries',
      'infinite',
      params.collectionId,
      params.limit,
      params.sort,
    ] as const,

  collectionEntriesDisabledKey: [...feedRoot, 'collection-entries', 'infinite', 'disabled'] as const,

  /** Prefix invalidation across all `/collections/:id` article membership caches */
  collectionEntriesInfiniteAllPrefix: FEED_COLLECTION_ENTRIES_INFINITE_PREFIX,
};
