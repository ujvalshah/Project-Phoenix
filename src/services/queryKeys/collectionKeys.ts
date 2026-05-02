/** Collection document cache keys (metadata), not feed membership lists — see `feedKeys`. */

export const collectionKeys = {
  all: ['collections'] as const,
  detail: (id: string) => [...collectionKeys.all, 'detail', id] as const,
};

/** Invalidate all TanStack caches for `GET` collection shells (counts, descriptions, curator fields). */
export const COLLECTION_DETAIL_INVALIDATION_PREFIX = [...collectionKeys.all, 'detail'] as const;
