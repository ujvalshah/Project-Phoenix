# Cache contract and hierarchy (TASK-007)

This document is the **ownership map** for caches that affect public read paths. It is descriptive: **TTLs and behavior live in code**; update this file when you add or rename a layer.

---

## 1. Server: Redis API response cache (shared / multi-process)

**Implementation:** `server/src/services/apiResponseCacheService.ts`  
**Storage:** Redis when configured; otherwise the in-memory fallback inside `server/src/utils/redisClient.ts` (same API surface).  
**Key shape:** `{namespace}:{urlEncodedPart|urlEncodedPart|...}` via `buildApiCacheKey(namespace, parts)`.  
**Metrics:** `incrementAppCounter` for `api_response_cache_*` (hit/miss/read_error, write ok/error, invalidation ok/error).

| Namespace prefix | Route(s) | TTL (code) | Ownership / invalidation |
|------------------|---------|---------------|---------------------------|
| `articles:list:v1` | `GET /api/articles` | `server/src/config/publicReadCache.ts` | Article create/update/delete: `invalidateRedisArticleDerivedReadCaches()` |
| `collections:list:v1` | `GET /api/collections` | `publicReadCache.ts` | Collection CUD, entries, follow/unfollow writes, featured: `invalidateRedisCollectionReadCaches()` |
| `collections:articles:v1` | `GET /api/collections/:id/articles` | `publicReadCache.ts` | Same as collections + article-derived invalidation |
| `config:onboarding-bundle:v1` | `GET /api/config/onboarding-bundle` | `fetchOnboardingBundleCached()` | Admin PATCH micro-headers: `invalidateRedisOnboardingBundleCache()` |
| `legal:pages:v1` | `GET /api/legal`, `GET /api/legal/:slug` | `legalController.ts` | Admin legal update: `invalidateApiResponseCachePrefix(LEGAL_PAGES_CACHE_NAMESPACE)` |
| `tags:taxonomy:v1` | `GET /api/categories/taxonomy` | `tagsController.ts` | Tag/taxonomy mutations in `tagsController`: `invalidateApiResponseCachePrefix(TAG_TAXONOMY_CACHE_NAMESPACE)` |

**Bypass rules (Redis skipped on purpose)** are implemented in `publicReadCache.ts` and logged at **debug** as `[PublicReadCache] redis_bypass`:

- Articles list Redis: anonymous-only; skips `favorites=1`, `unread=1`.
- Collections list Redis: skips `type=private` listings.
- Collection articles Redis: **public** collection, **non-admin**, **no `q`** search.

**Observability:** `getOrSetCachedJson` emits **`[ApiResponseCache]`** structured **debug** lines with `outcome` ∈ `hit` | `miss` | `set_ok` | `write_error` | `read_error` when `observe` metadata is passed (controllers do this for routes above). Invalidation success logs **`invalidate_ok`** with `keysDeleted`. Enable **debug** log level for the server logger to collect these lines.

**Debug helper (REPL / scripts):** `formatPublicReadCacheRegistrySummary()` in `server/src/config/publicReadCache.ts` prints namespaces wired through config + cross-reference prefixes.

---

## 2. Server: in-process LRU / maps (single Node process only)

| Layer | Where | TTL / size | Invalidation |
|-------|--------|-------------|--------------|
| Article list/search cache (`_searchCache` Map + LRU eviction) | `articlesController.ts` | 60s, max 100 keys | `invalidateSearchCache()` on article CUD |
| Tag → name map (`_tagNameCache`) | `server/src/utils/db.ts` | TTL constant in file (~60s) | `invalidateTagNameCache()` from tag mutations |
| Config / admin reads (LRU) | `homeMicroHeaderConfigService`, `marketPulseMicroHeaderConfigService`, `disclaimerConfigService`, `mediaQuotaConfigService` | per-file `CACHE_TTL_MS` | `invalidate*Cache()` alongside admin PATCH |
| Admin moderation stats LRU | `adminController.ts` (`statsCache`) | 2 min, 10 entries | internal to admin handlers |
| Optional URL metadata LRU | `server/src/services/metadata.ts` | per-file constants | LRU eviction only |

Redis **onboarding bundle** can still reflect stale data for up to its TTL versus these service LRUs unless both Redis and service caches are invalidated (admin PATCH already calls service `invalidate*` + Redis bundle invalidation).

---

## 3. Client: TanStack React Query

**Defaults:** `src/queryClient.ts` — `staleTime` **5 minutes**, `gcTime` **30 minutes**, refetch on window focus **false**.

Additional `staleTime` overrides appear on specific hooks (e.g. `HomePage`, `useNotifications`, `useNuggetFormData`). List/detail invalidation is centralized in **`src/services/queryKeys/articleKeys.ts`** (`invalidateArticleListCaches`, `patchArticleAcrossCaches`).

**Ownership:** Frontend cache invalidation **does not** flush server Redis automatically; server mutations should hit invalidation helpers above.

---

## 4. Operational notes

- **Invalidation mechanism:** `invalidateApiResponseCachePrefix(prefix)` uses `KEYS prefix*` then `DEL` — fine for bounded namespaces; monitor Redis keyspace if prefixes grow huge.
- **Log volume:** `[ApiResponseCache]` and `[PublicReadCache] redis_bypass` emit at **debug**; keep production log level at **info** unless troubleshooting.
