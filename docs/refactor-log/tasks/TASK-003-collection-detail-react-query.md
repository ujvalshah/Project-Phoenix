# TASK-003 — Collection detail: React Query infinite list

## Implementation status (2026-05-02)

**Done —** [`src/pages/CollectionDetailPage.tsx`](../../../src/pages/CollectionDetailPage.tsx) uses **`useInfiniteArticles`** with **`scope: 'collection-entries'`** and **`feedKeys.collectionEntriesInfiniteRoot(collectionId)`** for cache scope and invalidation. Manual **`loadCollectionPage`** / local page state for the article list is **removed** in favor of infinite query + flatten (verify in file for any follow-up edge cases).

## Problem

[`src/pages/CollectionDetailPage.tsx`](../../../src/pages/CollectionDetailPage.tsx) loads collection nuggets with **`loadCollectionPage`** + local state:

- **`nuggets`**, **`page`**, **`hasMore`**, **`isLoadingMore`**, **`isLoading`**
- **`storageService.getCollectionArticles(id, { page, limit: 30, sort: 'latest' })`**
- **`onLoadMore`** → `loadCollectionPage(collectionId, page + 1, true)`
- **`handleBulkModalClose`** → full reload `loadCollectionPage(collectionId, 1, false)`
- **`handleBulkRemove`** → optimistic `setNuggets(prev => prev.filter(...))` without reconciling `hasMore` / React Query cache

Pagination, loading flags, and refresh-after-mutations are duplicated patterns already centralized for home via **`useInfiniteArticles`** + **`articleKeys`**.

## Goal

Replace manual paging with **`useInfiniteQuery`** (dedicated hook recommended, e.g. **`useInfiniteCollectionArticles`**) that:

1. **Calls the same REST contract** via **`storageService`** / **`RestAdapter.getCollectionArticles`** — **no backend changes**.
2. **Keeps URL and UX** unchanged: **`useParams`** `collectionId`; missing id → **`navigate('/collections')`**; **`ArticleGrid`** still receives `articles`, **`isFetchingNextPage`**, **`hasNextPage`**, **`onLoadMore`** wired to **`fetchNextPage`**; **`ArticleModal`**, selection / bulk bar, **`AddToCollectionModal`**, share/edit flows unchanged in behavior.
3. **Does not modify** **`HomePage`**, **`HomeArticleFeed`**, **`useInfiniteArticles`**, or other home-only components — only collection detail (and any shared query-key helper if extracted).

## Scope (in)

- New query key factory (e.g. **`collectionKeys.articlesInfinite(collectionId)`** in a small file under `src/services/queryKeys/` or colocated) including **`collectionId`**, **`limit`**, **`sort`** so cache is scoped per collection.
- **`queryFn`**: `pageParam` = server page number (1-based, matching current `getCollectionArticles` usage); map response to `{ data, hasMore }` → `getNextPageParam`.
- Flatten **`pages`** to **`Article[]`** for `ArticleGrid` (same shape as today’s **`nuggets`**).
- **Initial collection metadata**: keep **`getCollectionById`** either as a **`useQuery`** side-by-side with the infinite query or a minimal parallel fetch in the same loader effect — avoid regressing redirect-on-missing-collection.
- After **bulk save** / **bulk remove** / any action that changes membership: **`queryClient.invalidateQueries`** (or **`refetch`** from the hook) instead of ad-hoc **`loadCollectionPage(..., 1, false)`**, preserving today’s “refresh from server” semantics.
- Preserve **`pageSize = 30`** and **`sort: 'latest'`** unless product explicitly changes (document in PR if changed).

## Scope (out)

- Backend API, DTOs, or pagination logic.
- **`CollectionsPage`**, **Saved** flows, or **`ArticleGrid`** internals (except props wiring from **`CollectionDetailPage`**).
- Home feed, Market Pulse, or **`useInfiniteArticles`** filter keys.

## Acceptance criteria

1. No **`nuggets` / page / hasMore / isLoadingMore`** manual list state for articles; list state comes from React Query infinite result + derived flatten.
2. **`onLoadMore`** triggers **`fetchNextPage`** only when **`hasNextPage`**; loading indicator uses **`isFetchingNextPage`** (or equivalent from the hook).
3. Changing **`collectionId`** in the URL resets the infinite query (query key includes **`collectionId`**).
4. **Bulk modal close** and **bulk remove** leave the list consistent with server (invalidate or refetch; remove optimistic-only paths that desync **`hasNextPage`**).
5. **`npm run typecheck`** and existing tests still pass; add a focused test if low-cost (e.g. hook unit test with **`QueryClientProvider`** mock adapter **optional**).

## References

- [`IAdapter.getCollectionArticles`](../../../src/services/adapters/IAdapter.ts)
- [`RestAdapter.getCollectionArticles`](../../../src/services/adapters/RestAdapter.ts)
- [`useInfiniteArticles`](../../../src/hooks/useInfiniteArticles.ts) — pattern for **`useInfiniteQuery`**, **`getNextPageParam`**, stale time constants
- [`articleKeys`](../../../src/services/queryKeys/articleKeys.ts) — key structure precedent

## Verification (post-implementation)

- Manually open **`/collections/:id`**, scroll to trigger more pages, open modal, run bulk remove / save-to and confirm list refresh.
- Optional: extend Playwright later (not required for this task unless already stable).
