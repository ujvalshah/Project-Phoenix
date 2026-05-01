# Performance changelog — Nuggets

Newest entries first.

## 2026-05-01 — WO-10: Metrics expansion + CI widening (B012 + I-CI-01)

What changed  

- `server/src/utils/metrics.ts`: added app-level counter family `app_events_total`.
- `server/src/services/apiResponseCacheService.ts`: emits cache access/write/invalidation counters (`hit`, `miss`, `read_error`, `write`, `invalidation`) to metrics.
- `server/tsconfig.ci.json`: widened CI server typecheck scope incrementally to include the new cache helper (`apiResponseCacheService`) in addition to existing config/metrics/sentry entries.

Why  

- Adds visibility into cache behavior and raises CI strictness without requiring a broad tooling rewrite.

Risk / rollback  

- Low; rollback by reverting metrics counter additions and restoring narrower CI include scope.

Measured impact (baseline → after): pending (capture `app_events_total` on repeated cacheable GET traffic and CI runtime delta).

Related  

- [PERF_MASTER.md](PERF_MASTER.md) B012; [backlog.md](backlog.md) WO-10.

---

## 2026-05-01 — WO-09: Response cache standardization (B009)

What changed  

- Added shared cache helper service (`server/src/services/apiResponseCacheService.ts`) and applied it to:
  - `GET /api/categories/taxonomy` (`server/src/controllers/tagsController.ts`)
  - `GET /api/legal` and `GET /api/legal/:slug` (`server/src/controllers/legalController.ts`)
- Added mutation-time invalidation for related cache prefixes in tag and legal admin mutation paths.
- Updated ADR-003 status from proposal to accepted incremental rollout with implemented namespaces/TTLs.

Why  

- Standardizes read-through response caching semantics across safe read-heavy GETs and ensures explicit invalidation hooks.

Risk / rollback  

- Medium: stale reads remain possible if future mutation paths miss invalidation. Rollback by removing controller cache wiring while keeping helper for later.

Measured impact (baseline → after): pending (capture p95 and cache-hit ratio for taxonomy/legal endpoints).

Related  

- [PERF_MASTER.md](PERF_MASTER.md) B009; [backlog.md](backlog.md) WO-09; [decisions/ADR-003-api-response-caching.md](decisions/ADR-003-api-response-caching.md).

---

## 2026-05-01 — WO-08: Header shell cost reduction (B008)

What changed  

- `src/components/Header.tsx`: moved `adminFeedbackService` load from top-level import to on-demand dynamic import in `DrawerFeedbackForm` submit handler.
- `src/components/Header.tsx`: merged duplicate viewport resize listeners into one shared effect that updates `isMobile`, `isTablet`, and `isXl`.
- `docs/perf/components/header.md`: updated dossier with implementation details and expected effect.

Why  

- Reduces always-paid header bundle work and avoids duplicate resize-driven state churn in global chrome.

Risk / rollback  

- Low; rollback by restoring eager service import and separate tablet resize effect.

Measured impact (baseline → after): pending (capture route transition responsiveness and script eval deltas locally).

Related  

- [PERF_MASTER.md](PERF_MASTER.md) B008; [backlog.md](backlog.md) WO-08; [components/header.md](components/header.md).

---

## 2026-05-01 — WO-07: Bookmark batch-toggle bulk path (B007)

What changed  

- server/src/controllers/bookmarksController.ts atchToggle no longer performs per-item sequential helper calls.
- Bookmark action now uses batched prefetch/insert/update/link operations and one default-folder count reconciliation.
- Unbookmark action now performs batched bookmark/link deletes plus grouped collection counter decrements.

Why  

- Reduces O(N) sequential latency for larger batch toggles (up to current limit of 50).

Risk / rollback  

- Bulk path is more complex; rollback by restoring prior sequential loop implementation.

Measured impact (baseline → after): pending (capture N=50 and N=100 batch duration sample).

Related  

- [PERF_MASTER.md](PERF_MASTER.md) B007; [backlog.md](backlog.md) WO-07; [db/bookmark-queries.md](db/bookmark-queries.md).

---

## 2026-05-01 — WO-06: Collection filter fan-out removal (B006)

What changed  

- server/src/controllers/articlesController.ts: removed read-time child collection fan-out in the collection filter path (Collection.find({ parentId })).
- Route now uses selected collection entries directly to build the article-id filter.

Why  

- Cuts extra query work on collection-filtered feed requests and simplifies hot-path execution.

Risk / rollback  

- If legacy parent collections depend on child fan-out at read time, results can appear narrower. Rollback: reintroduce fan-out or run backfill to keep parent entries authoritative.

Measured impact (baseline → after): pending (collection-filter endpoint p95/query-count sample).

Related  

- [PERF_MASTER.md](PERF_MASTER.md) B006; [backlog.md](backlog.md) WO-06; [routes/collections.md](routes/collections.md).

---

## 2026-05-01 — WO-05: Progressive local batching for non-virtualized grid (B004)

What changed  

- src/components/ArticleGrid.tsx: added progressive render batching for non-virtualized grid mode using LOCAL_RENDER_INITIAL and LOCAL_RENDER_BATCH.
- Added LocalRenderBatchTrigger (IntersectionObserver) to reveal additional batches as the user scrolls near the rendered tail.
- Existing single-column virtualization path remains unchanged.

Why  

- Reduces initial DOM/render pressure when many articles are loaded but multi-column virtualization is intentionally disabled.

Risk / rollback  

- Very low: reveal behavior is monotonic and only applies to non-virtual branch. Rollback by reverting ArticleGrid batching additions.

Measured impact (baseline → after): pending (capture feed render duration + node count sample on large list).

Related  

- [PERF_MASTER.md](PERF_MASTER.md) B004; [backlog.md](backlog.md) WO-05; [components/article-grid.md](components/article-grid.md).

---

## 2026-05-01 — WO-04: Articles hybrid search fan-out reduction (B002)

What changed  

- Replaced the hybrid-search fan-out in `server/src/controllers/articlesController.ts` from four parallel queries (`distinct + find` for relevance/fallback) to one `Article.aggregate` call with `$facet`.
- Preserved merge behavior: relevance docs first, fallback docs fill gaps, uniqueness by `_id`, total from union of relevance/fallback id sets.

Why  

- Cuts query round trips and lowers app-side orchestration overhead in the hot hybrid search path.

Risk / rollback  

- Aggregation branch is more complex; rollback by reverting the hybrid branch in `getArticles`.

Measured impact (baseline → after): pending (add local harness/APM sample for searchMode=hybrid).

Related  

- [PERF_MASTER.md](PERF_MASTER.md) B002; [backlog.md](backlog.md) WO-04; [db/article-queries.md](db/article-queries.md).

---

## 2026-05-01 — WO-03: Bookmark search moved to DB-bounded pipeline (B003)

What changed  

- Replaced in-memory bookmark search in `server/src/controllers/bookmarksController.ts` with Mongo aggregation:
  - `$match` on bookmark filters
  - `$lookup` to `articles` by `itemId`
  - access-control + text search match in DB
  - `$facet` for paged rows + total count in one pipeline
- Kept enrichment behavior (collection IDs and tag resolution) for page rows.

Why  

- Prevents latency from scaling with the full bookmark corpus size for users with many bookmarks.

Risk / rollback  

- Aggregation complexity increased; rollback by reverting controller changes to prior query path.

Measured impact (baseline → after): local harness sample (post-change): `runs=12`, `dataset=120`, `q=needle`, `limit=20` -> `p50=199.13ms`, `p95=311.97ms`, `avg=223.64ms` (in-memory Mongo harness).

Related  

- [PERF_MASTER.md](PERF_MASTER.md) B003; [backlog.md](backlog.md) WO-03; [db/bookmark-queries.md](db/bookmark-queries.md).
- Harness: `server/src/__tests__/bookmarksSearchPerf.local.test.ts`.

---

## 2026-05-01 — WO-02: Auth `tokenVersion` Redis cache (B001)

What changed  

- Added `getUserTokenVersionForAuth`, `upsertUserTokenVersionCache`, and `invalidateUserTokenVersionCache` in `server/src/services/tokenService.ts` (key `utv:{userId}`).
- `authenticateToken` uses the helper instead of always hitting Mongo for `tokenVersion`.
- After bumps, Redis is **upserted** with the authoritative new `tokenVersion` from Mongo; hard-delete still **deletes** the cache entry.
- Env: `AUTH_TOKEN_VERSION_CACHE_ENABLED` (default on; set `false` to disable), `AUTH_TOKEN_VERSION_CACHE_TTL_SECONDS` (10–600, default 120). Documented in `env.example`.

Why  

- Cuts repeated Mongo reads on hot authed routes while preserving revocation semantics when invalidation runs.

Risk / rollback  

- If Redis is wrong/stale: worst case old JWT accepted until TTL — rely on invalidation + short TTL. Rollback: set `AUTH_TOKEN_VERSION_CACHE_ENABLED=false` or revert.

Measured impact (baseline → after): pending (APM / load test).

Related  

- [ADR-002](decisions/ADR-002-auth-validation-cache.md); [PERF_MASTER.md](PERF_MASTER.md) B001; [backlog.md](backlog.md) WO-02.

---

## 2026-05-01 — WO-01: CardMedia + ArticleDrawer render stability

What changed  

- `CardMedia`: replaced thumbnail error reset that ran `setState` during render with `failedThumbKey` and derived `showImageError` so a new thumbnail URL naturally clears the error state.
- `ArticleDrawer`: when `isOpen` becomes true, reset `isClosing` inside `queueMicrotask` so reopening during a close animation works without synchronous `setState` in an effect (`react-hooks/set-state-in-effect`).
- Removed unused imports/locals in `CardMedia` surfaced when linting touched files.

Why  

- Eliminates illegal render-phase updates and matches repo ESLint rules.

Risk / rollback  

- Revert the commit(s) (UI-only paths touched).

Measured impact (baseline → after): pending (profiler / QA).

Related  

- WO-01 / B005; [backlog.md](backlog.md); [PERF_MASTER.md](PERF_MASTER.md) bottleneck B005 row.

---

## 2026-05-01 — Execution stage locked (Batch-1 + 10 work orders)

What changed  

- Reworked [backlog.md](backlog.md) into an execution board with:
  - 3-item Batch-1 run order (`WO-01` to `WO-03`) marked `ready`
  - 10 scoped parallel work orders with merge-risk and validation metric fields
  - Explicit handoff protocol for PR descriptions and same-PR docs updates
- Updated [LLM_HANDOFF.md](LLM_HANDOFF.md) to route new sessions through `WO-xx` and Batch-1 priority.

Why  

- Reduces coordination overhead and makes parallel implementation safe for multiple LLM sessions.

Risk / rollback  

- Docs-only rollback: revert changes to [backlog.md](backlog.md) and [LLM_HANDOFF.md](LLM_HANDOFF.md).

Measured impact  

- Documentation/process only; no runtime behavior change.

---

## Template

```
## YYYY-MM-DD — Title

What changed  
Why  
Risk / rollback  
Measured impact (baseline → after): …  
Files: …  
```

---

## 2026-05-01 — PERF_MASTER evidence table + LLM handoff guide + Cursor rule

What changed  

- Expanded [PERF_MASTER.md](PERF_MASTER.md) bottleneck tables with repository line anchors (evidence column).
- Added [LLM_HANDOFF.md](LLM_HANDOFF.md) for cross-session / cross-LLM continuity.
- Added Cursor rule [.cursor/rules/nuggets-performance-program.mdc](../../.cursor/rules/nuggets-performance-program.mdc) scoped to `docs/perf/**`.

Measured impact  

- Documentation and agent guidance only.

---

## 2026-05-01 — Perf program docs scaffold + groundwork alignment

What changed  

- Added this `docs/perf/` scaffold for multi-session continuity.
- Aligned canonical plan docs with groundwork already landed in-repo (CI/runtime/Sentry/metrics baseline).

Why  

- Provides a durable handoff substrate beyond chat history.

Risk / rollback  

- Docs-only rollback: delete or revert additions under [`docs/perf/`](.).

Measured impact  

- Documentation only (no UX change captured here).

Related code / config (already in repo)  

- [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [Dockerfile](../../Dockerfile)
- [package.json](../../package.json)
- [`src/utils/sentry.ts`](../../src/utils/sentry.ts)
- [`server/src/utils/sentry.ts`](../../server/src/utils/sentry.ts)
- [`server/src/utils/metrics.ts`](../../server/src/utils/metrics.ts)
- [`server/src/index.ts`](../../server/src/index.ts)

---

## 2026-05-01 — Frontend lint: fix hook order in CardTags

What changed  

- Ensured hooks always run in a stable order in [`src/components/card/atoms/CardTags.tsx`](../../src/components/card/atoms/CardTags.tsx).

Measured impact  

- `npm run lint:all` green (local validation in-session).
