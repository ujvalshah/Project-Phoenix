# Nuggets performance refactor log

Canonical notes for TASK-001 and follow-ups. Paths under this folder are descriptive; **`package.json` is authoritative** for scripts.  
**Program closeout (stale doc audit, next-wave list):** [`CLOSEOUT-TASK-026.md`](CLOSEOUT-TASK-026.md) (2026-05-02).

> **Note:** There is no `docs/refactor/` tree in this repository; this folder (`docs/refactor-log/`) is the canonical “refactor program” location.

## Task index
- [`tasks/TASK-001-home-feed-virtualization.md`](tasks/TASK-001-home-feed-virtualization.md) — home grid virtualization (implemented; see verification gaps below).
- [`tasks/TASK-002-home-feed-render-audit.md`](tasks/TASK-002-home-feed-render-audit.md) — render churn, deferral, viewport work.
- [`tasks/TASK-VERIFY-home-feed-e2e.md`](tasks/TASK-VERIFY-home-feed-e2e.md) — home-feed Playwright coverage.
- [`tasks/TASK-003-collection-detail-react-query.md`](tasks/TASK-003-collection-detail-react-query.md) — collection detail: React Query infinite list (**implemented** in `CollectionDetailPage` — see task file).
- [`tasks/TASK-025-admin-dashboard-rendering.md`](tasks/TASK-025-admin-dashboard-rendering.md) — admin nuggets/moderation image alignment + scorecard/Lighthouse/E2E helpers (**closed**).
- **TASK-004 (implemented):** Unified feed engine — [`src/hooks/useUnifiedInfiniteArticles.ts`](../../src/hooks/useUnifiedInfiniteArticles.ts) + [`src/services/queryKeys/feedKeys.ts`](../../src/services/queryKeys/feedKeys.ts): stream feeds share **`articleKeys.infiniteList`** tuples via **`feedKeys.streamInfinite`**; `/collections/:id` membership uses **`feedKeys.collectionEntriesInfinite`**. Home still consumes **`useInfiniteArticles`** (thin wrapper).
- **TASK-005 (implemented):** Cache invalidation convergence — **`invalidateArticleListCaches`** ([`articleKeys`](../../src/services/queryKeys/articleKeys.ts)) now also drops **`feed` / `collection-entries` / `infinite`** membership caches (`FEED_COLLECTION_ENTRIES_INFINITE_PREFIX` in [`feedPrefixes`](../../src/services/queryKeys/feedPrefixes.ts)) and refreshes **`['collections','detail']`** shells for metadata/counts when article lists change. **`patchArticleAcrossCaches`** applies optimistic updates inside feed collection-entry infinite data as well.

## Live wiring (TASK-001)
- **`useUnifiedInfiniteArticles` / `feedKeys` (TASK-004):** **`HomePage`** → **`useInfiniteArticles`** → unified stream path; **`CollectionsPage`** (**`BrowseLanding`**, **`ScopedNuggetFeed`**) calls unified directly; **`CollectionDetailPage`** uses **`scope: 'collection-entries'`** + **`feedKeys.collectionEntriesInfiniteRoot`** invalidation after bulk flows.
- `src/pages/HomePage.tsx` renders **`HomeArticleFeed`** (not `ArticleGrid`).
- **`HomeArticleFeed`** uses **`HomeGridVirtualized`** for `viewMode === 'grid'`; **`MasonryGrid`** when `viewMode === 'masonry'`.
- `ArticleGrid` remains for Saved / Collections / Collection detail surfaces.

## Perf and test scripts (from `package.json`)
**There is no `testperf-guards` script.** Use:
- **`npm run test:perf-guards`** — Vitest perf-guard subset (chunk cache + rollout tests).
- **`npm run perf:lh-mobile-local`** — Lighthouse JSON against `127.0.0.1:3000/` (pinned `lighthouse@12`, mobile emulation).
- **`npm run typecheck`** — client TS (`npm run typecheck:all` includes server).

E2E:
- **`npm run test:e2e:smoke`** — `tests/e2e/perf-guards-nugget-modal.spec.ts` only.
- **Home feed:** `npx playwright test tests/e2e/home-feed-smoke.spec.ts` — virtual grid scroll/pagination/modal/grid↔masonry (requires reachable article API for meaningful assertions).
- **`npm run test:e2e`** — full Playwright suite.

**Global setup / auth:** `tests/e2e/global-setup.ts` tries login at, in order: `PLAYWRIGHT_LOGIN_API_BASE` (optional), **`${PLAYWRIGHT_WEB_ORIGIN ?? 'http://localhost:3000'}/api`**, then **`PLAYWRIGHT_API_BASE`** (default `http://localhost:5000/api`). Use `npm run dev:all` locally so `:3000` proxies to a live backend.

## Verification reality (TASK-001 not fully proven)
- **Lighthouse (ad-hoc / dev):** Baseline runs used **dev server + unminified bundles** and a **moving API** condition; scores and paint timings are **noisy** and not release gates by themselves. Prefer **`npm run build` + `npm run preview`** (or staging) plus stable backend before comparing runs.
- **Playwright (CI):** The **`quality`** job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs **`npm run test:e2e:smoke`** with a **Mongo** service; `playwright.config.ts` starts **`npm run dev:all`** for that run. This does **not** include the **home-feed** spec — that remains a **separate** local/optional run.
- **Playwright (local):** Global setup tries the **Vite origin** (`/api` on port 3000) before the direct backend port. **`ECONNREFUSED`** still happens if neither is up. Home-feed smoke still needs a **healthy API** or it may **skip**. Use **`npm run dev:all`** for full-stack tests.
- **`HOME_FEED_VIRTUALIZATION` / `VITE_HOME_FEED_VIRTUALIZATION`:** Controls **`ArticleGrid` single-column** window virtualization only. **Home** (`HomeArticleFeed`) **always** virtualizes the grid via `HomeGridVirtualized` and does **not** read this flag. See [`src/constants/featureFlags.ts`](../../src/constants/featureFlags.ts).

## Explicitly out of scope here
- **Redis / server response caching** — not started; track under separate backend tasks when approved.
