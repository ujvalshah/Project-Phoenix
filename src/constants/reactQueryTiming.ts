/**
 * TanStack Query timing shared where we intentionally mirror app defaults.
 *
 * @see {@link ../queryClient.ts} — global `staleTime` is `5 * 60 * 1000`.
 */

/** Mirrors `QueryClient` default stale window for list queries (`queryClient.ts`). */
export const DEFAULT_QUERY_STALE_MS = 1000 * 60 * 5;

/** Infinite article feed: aligns with global defaults so the feed is not artificially “fresh” every 30s. */
export const INFINITE_ARTICLES_STALE_MS = DEFAULT_QUERY_STALE_MS;
