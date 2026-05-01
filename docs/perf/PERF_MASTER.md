# Nuggets Performance — Master Record

This document is the **canonical performance program record**. Use it across sessions instead of scattering notes in chats.

Companion documents:

- How another LLM (or teammate) should continue: [LLM_HANDOFF.md](LLM_HANDOFF.md)
- Execution backlog and priorities: [backlog.md](backlog.md)
- Completed work and measurable deltas: [changelog.md](changelog.md)
- Reference audit artifact (web-specific deep dive): [../../.cursor/plans/web_performance_audit_d6fc8efc.plan.md](../../.cursor/plans/web_performance_audit_d6fc8efc.plan.md)
- Program rollout plan source: [../../.cursor/plans/nuggets_perf_step-change_4370e11e.plan.md](../../.cursor/plans/nuggets_perf_step-change_4370e11e.plan.md)

## Program goal

Deliver step-change responsiveness and load-time improvements across www.nuggets.one by targeting:

- Faster initial load and route transitions
- Lower origin CPU/DB pressure
- Smaller shipped JS where possible
- Better Core Web Vitals and perceived speed

## Completed groundwork (infra + observability rails)

Already shipped in-repo (baseline for subsequent perf work):

- **CI**: explicit client/server lint and typecheck in [.github/workflows/ci.yml](../../.github/workflows/ci.yml); server checks are blocking.
- **Backend production runtime**: compiled output via [`npm run build:server`](../../package.json); Docker runs `node server/dist/index.js`; local dev unchanged (`tsx watch`).
- **Sentry correlation**: frontend `release` wiring in [`src/utils/sentry.ts`](../../src/utils/sentry.ts); backend `release`/`environment` in [`server/src/utils/sentry.ts`](../../server/src/utils/sentry.ts) with env vars in [`server/src/config/envValidation.ts`](../../server/src/config/envValidation.ts) and documented in [`env.example`](../../env.example).
- **Telemetry foundation**: opt-in Prometheus text at `/api/metrics` (`METRICS_ENABLED`) in [`server/src/utils/metrics.ts`](../../server/src/utils/metrics.ts) hooked from [`server/src/index.ts`](../../server/src/index.ts).

## Architectural map

### Frontend (CSR)

Boot and routes:

- [`src/main.tsx`](../../src/main.tsx)
- [`src/App.tsx`](../../src/App.tsx)

Primary feed path:

- [`src/pages/HomePage.tsx`](../../src/pages/HomePage.tsx)
- [`src/components/ArticleGrid.tsx`](../../src/components/ArticleGrid.tsx)
- [`src/components/MasonryGrid.tsx`](../../src/components/MasonryGrid.tsx)
- [`src/components/NewsCard.tsx`](../../src/components/NewsCard.tsx)

Card hot spots:

- [`src/components/card/atoms/CardContent.tsx`](../../src/components/card/atoms/CardContent.tsx)
- [`src/components/card/atoms/CardMedia.tsx`](../../src/components/card/atoms/CardMedia.tsx)
- [`src/hooks/useNewsCard.ts`](../../src/hooks/useNewsCard.ts)

### Backend (Express)

- Entry and middleware ordering: [`server/src/index.ts`](../../server/src/index.ts)
- Hot endpoints: [`server/src/controllers/articlesController.ts`](../../server/src/controllers/articlesController.ts), [`server/src/controllers/searchController.ts`](../../server/src/controllers/searchController.ts), [`server/src/controllers/bookmarksController.ts`](../../server/src/controllers/bookmarksController.ts)
- Auth path: [`server/src/middleware/authenticateToken.ts`](../../server/src/middleware/authenticateToken.ts), [`server/src/services/tokenService.ts`](../../server/src/services/tokenService.ts)

### Build / infra

- [`package.json`](../../package.json)
- [`Dockerfile`](../../Dockerfile)
- [`vite.config.ts`](../../vite.config.ts)
- [`scripts/check-bundle-budget.mjs`](../../scripts/check-bundle-budget.mjs)

## Top bottleneck ranking (living list)

Evidence uses **repository line anchors** (`path` Lx–Ly). Refresh these when refactoring moves code.

### Critical

| ID | Bottleneck | Category | Sev. | Conf. | Evidence (anchor) | Proposed direction | Exp. gain | Risk |
|----|------------|----------|------|-------|-------------------|-------------------|-----------|------|
| B001 | Authed requests pay blacklist + tokenVersion resolution | backend | Crit. | High | **Mitigated (WO-02):** `authenticateToken.ts` L55–56 `isTokenBlacklisted`; L76–77 `getUserTokenVersionForAuth` (`tokenService` Redis `utv:` + Mongo read-through, TTL from `AUTH_TOKEN_VERSION_CACHE_*`); bumps call `invalidateUserTokenVersionCache` | Keep invalidation exhaustive on `$inc`/save paths; blacklist semantics unchanged (`STRICT_TOKEN_REVOCATION`) | Fewer Mongo reads per authed user under steady traffic | Med. |
| B002 | Hybrid search fan-out in articles search | backend/db | Crit. | High | **Mitigated (WO-04):** `server/src/controllers/articlesController.ts` hybrid branch now uses one `Article.aggregate([{ $facet: ... }])` call for relevance/fallback docs+ids instead of `distinct + find` x2 | Preserve merge ordering (relevance first, fallback fill), then follow up with index/`explain` tuning | Fewer DB round trips and lower app-side orchestration overhead | High |
| B003 | Bookmark text search performs corpus-wide in-memory filtering | backend/db | Crit. | High | **Mitigated (WO-03):** `server/src/controllers/bookmarksController.ts` search branch now uses Mongo `$lookup` (bookmarks -> article), access-filter + text match in pipeline, and `$facet` (`$skip/$limit` + `$count`) instead of loading all bookmarks and filtering in Node | Keep search DB-bounded; follow up with index tuning/`explain` if p95 remains high | Latency scales with page size, not full bookmark corpus | High |
| B004 | Multi-column grid maps every loaded article with stagger animation | frontend | Crit. | High | `src/components/ArticleGrid.tsx` L201–207 virtualization gated to single column + flag; L565–604 non-virtual path `displayArticles.map` + `delay = Math.min(index * 50, 750)` | Desktop-safe windowing OR cap animation work for large lists; extend virtualization beyond col=1 when UX-safe | Fewer DOM nodes + less style/layout work | High |
| B005 | Render-phase state updates can cause extra reconciliation | frontend | Crit. | Med. | **Fixed (WO-01):** `src/components/card/atoms/CardMedia.tsx` L46–69 `failedThumbKey` + derived `showImageError` (no render/effect resets); `src/components/ArticleDrawer.tsx` L48–53 clears `isClosing` via `queueMicrotask` when `isOpen` (avoids synchronous `setState` in effects per `react-hooks/set-state-in-effect`) | Maintain pattern: no derived state via `setState` during render; prefer derived keys vs effects for URL-driven resets | More stable renders; fewer glitch classes | Low–Med. |

### High

| ID | Bottleneck | Category | Sev. | Conf. | Evidence (anchor) | Proposed direction | Exp. gain | Risk |
|----|------------|----------|------|-------|-------------------|-------------------|-----------|------|
| B006 | Parent collection filter fans out extra `Collection.find` for children | backend | High | High | `server/src/controllers/articlesController.ts` L280–295 when `!collection.parentId`: `Collection.find({ parentId })` merges `entries` arrays | Materialized rollup on collection or persisted merged membership | Fewer queries on common filters | High |
| B007 | Bookmark batch mutation is sequential per id | backend | High | High | `server/src/controllers/bookmarksController.ts` L516–534 `for (const itemId of itemIds)` with awaits inside | Bulk prefetch + `bulkWrite` / pipelined ops | Faster batch UX | Med. |
| B008 | Global header shell complexity | frontend | High | Med. | **Mitigated (WO-08):** `src/components/Header.tsx` now dynamically imports `adminFeedbackService` only on feedback submit and uses one shared viewport resize observer for `isMobile`/`isTablet`/`isXl` state | Continue intent-lazy treatment for other non-critical header widgets as follow-up if needed | Lower header boot parse/eval and less redundant resize work | Med. |
| B009 | Read-heavy GETs inconsistent shared cache layers | caching | High | Med. | **Mitigated (WO-09):** shared helper in `server/src/services/apiResponseCacheService.ts`; cached read paths include `tagsController#getTagTaxonomy` and `legalController` GET endpoints with prefix invalidation on related admin mutations | Continue selective rollout to other read-heavy safe endpoints using same key/invalidation contract (ADR-003) | Lower repeated DB under load | Med.–High |

### Medium

| ID | Bottleneck | Category | Sev. | Conf. | Evidence (anchor) | Proposed direction | Exp. gain | Risk |
|----|------------|----------|------|-------|-------------------|-------------------|-----------|------|
| B010 | Feed query stale window vs overlay/refetch UX | frontend | Med. | Med. | `src/hooks/useInfiniteArticles.ts` L142 uses `INFINITE_ARTICLES_STALE_MS`; `src/constants/reactQueryTiming.ts` L11 aligned to 5m global default — pair with [`src/components/ArticleGrid.tsx`](../../src/components/ArticleGrid.tsx) L558–562 refetch overlay (`opacity` + `pointer-events`) | Tune staleTime vs product freshness; reduce overlay thrash cost | Better INP/refetch perception | Low–Med. |
| B011 | Markdown still a card CPU surface when expanded/full path loads | frontend | Med. | Med. | [`src/components/card/atoms/CardContent.tsx`](../../src/components/card/atoms/CardContent.tsx) L8–11 lazy `MarkdownRenderer`; L431 `<MarkdownRendererLazy` — verify when **not** deferred | Guarantee excerpt uses cheapest path until expand/detail | Lower main-thread on long feeds | Med. |
| B012 | Production observability beyond logs | infra | Med. | Med. | **Mitigated (WO-10):** `/api/metrics` now includes app-level cache counters (`app_events_total`) emitted from `apiResponseCacheService`; server CI typecheck scope widened incrementally via `server/tsconfig.ci.json` to include the new cache helper file | Follow up with percentile dashboards, alerting rules, and further CI scope expansion as type debt is reduced | Better cache visibility and stronger CI guardrails | Low–Med. |

### Note on older audits

Some narrative audits claimed a 30s infinite-query stale window; current code aligns feed stale time with the global 5-minute default (`src/constants/reactQueryTiming.ts`). Treat older docs as hypotheses until re-verified against `main`.

## Measurement standards

Baseline and post-change capture (when changing user-visible perf):

- LCP / INP / CLS (lab + RUM where available)
- TTFB for HTML and key APIs
- API p50/p95/p99
- Bundle: `npm run analyze:bundle`, `npm run test:bundles`

## Session handoff (fill every time)

- **Date**:
- **Owner**:
- **Done this session**: (link PR/commits)
- **Next 3 priorities**:
- **Open questions**:
