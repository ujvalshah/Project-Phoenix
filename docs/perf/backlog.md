# Performance backlog — Nuggets

Status values: **todo** · **ready** · **doing** · **done** · **blocked** · **deferred**

Canonical context: [PERF_MASTER.md](PERF_MASTER.md)

## Most efficient next stage

Use parallel work orders with strict boundaries, but execute **Batch-1** first in this order:

1. ~~WO-01~~ **done** (B005 render stability)
2. ~~WO-02~~ **done** (B001 auth `tokenVersion` cache)
3. ~~WO-03~~ **done** (B003 bookmark DB-bounded search)

This gives fast user impact while keeping merge risk low.

## Batch-1 (execution-locked)

| Batch ID | Work order | Bottleneck | Status | Touchpoints | Acceptance gate |
|----|----|----|----|----|----|
| B1-01 | WO-01 | B005 | done | `src/components/card/atoms/CardMedia.tsx`, `src/components/ArticleDrawer.tsx` | No render-phase `setState`; no UX regression in card media/drawer |
| B1-02 | WO-02 | B001 | done | `server/src/middleware/authenticateToken.ts`, `server/src/services/tokenService.ts`, `server/src/config/envValidation.ts` | Redis `utv:{userId}` cache + invalidation on tokenVersion bumps; Mongo fallback when Redis disabled/unavailable |
| B1-03 | WO-03 | B003 | done | `server/src/controllers/bookmarksController.ts`, related model/index files | Search path moved to DB-bounded `$lookup` + `$facet` pagination |

## Parallel work orders (10)

| WO ID | Maps to | Priority | Status | Scope boundary (must stay inside) | Merge risk | Validation metric |
|----|----|----|----|----|----|----|
| WO-01 | B005 | P0 | done | `src/components/card/atoms/CardMedia.tsx`, `src/components/ArticleDrawer.tsx` | Low | React profiler commit count and interaction smoothness |
| WO-02 | B001 | P0 | done | `server/src/middleware/authenticateToken.ts`, `server/src/services/tokenService.ts`, `server/src/config/envValidation.ts` | Medium | `/api/*` authed p95 and DB read count |
| WO-03 | B003 | P0 | done | `server/src/controllers/bookmarksController.ts`, bookmark query/index touchpoints only | High | bookmarks search p95 vs bookmark-count growth |
| WO-04 | B002 | P1 | done | `server/src/controllers/articlesController.ts`, `docs/perf/db/article-queries.md` | High | articles/search query count and endpoint p95 |
| WO-05 | B004 | P1 | done | `src/components/ArticleGrid.tsx`, `src/components/MasonryGrid.tsx`, `docs/perf/components/article-grid.md` | High | feed render time and node count on large list |
| WO-06 | B006 | P1 | done | `server/src/controllers/articlesController.ts`, collection model/query files | Medium | collection-filter endpoint p95 and query count |
| WO-07 | B007 | P1 | done | `server/src/controllers/bookmarksController.ts` batch mutation path only | Medium | batch toggle duration for N=50/100 |
| WO-08 | B008 | P2 | done | `src/components/Header.tsx` plus directly-related header children only | Medium | route transition responsiveness and script eval |
| WO-09 | B009 | P2 | done | read-heavy GET controllers + cache helper/service layer + ADR-003 | High | cache hit rate and API p95 |
| WO-10 | B012 + I-CI-01 | P2 | done | `server/src/utils/metrics.ts`, `server/src/index.ts`, `server/tsconfig.ci.json` | Medium | metrics coverage and CI strictness delta |

## Work order handoff protocol

Each WO must include in PR description:

- Bottleneck ID and evidence anchor copied from `PERF_MASTER.md`
- Baseline metric and post-change metric
- Rollback path in one line
- Updated docs in same PR: `docs/perf/changelog.md` and this file

## Existing grouped backlog (program view)

## P0 — highest impact / lowest regret

| ID | Title | Status | Why | Primary files | Dependencies | Risk | Rollback |
|----|-------|--------|-----|---------------|--------------|------|----------|
| P0-01 | Render stability: eliminate render-phase `setState` in card/drawer hot paths | done | Prevents instability and avoids wasted renders | [`src/components/card/atoms/CardMedia.tsx`](../../src/components/card/atoms/CardMedia.tsx), [`src/components/ArticleDrawer.tsx`](../../src/components/ArticleDrawer.tsx) | None | Low | Revert commits |
| P0-02 | Auth middleware fast path | done | Removes repeated Mongo/Redis overhead on authenticated traffic | [`server/src/middleware/authenticateToken.ts`](../../server/src/middleware/authenticateToken.ts), [`server/src/services/tokenService.ts`](../../server/src/services/tokenService.ts) | Redis availability semantics | Medium | Set `AUTH_TOKEN_VERSION_CACHE_ENABLED=false` or TTL= minimum |
| P0-03 | Bookmark search bounded by DB | done | Stops latency growing with corpus size | [`server/src/controllers/bookmarksController.ts`](../../server/src/controllers/bookmarksController.ts) | Index design | High | Route flag to old behavior (short window) |

## P1 — structural upside

| ID | Title | Status | Why | Primary files | Dependencies | Risk | Rollback |
|----|-------|--------|-----|---------------|--------------|------|----------|
| P1-01 | Articles list/search query consolidation | done | Fewer DB round trips under load | [`server/src/controllers/articlesController.ts`](../../server/src/controllers/articlesController.ts), [db/article-queries.md](db/article-queries.md) | Explains/indexes | High | Feature-flag query path |
| P1-02 | Desktop feed windowing/virtualization | done | Progressive local batching shipped for non-virtualized desktop path | [`src/components/ArticleGrid.tsx`](../../src/components/ArticleGrid.tsx), [components/article-grid.md](components/article-grid.md) | UX parity QA | High | Toggle virtualization mode |
| P1-03 | Collection filter fan-out reduction | done | Removed read-time child collection fan-out in collection filter path | [`server/src/controllers/articlesController.ts`](../../server/src/controllers/articlesController.ts) | Collection data model | Medium | Feature-flag query path |
| P1-04 | Bookmark batch mutation bulk path | done | Batch toggle now uses bulk/pipelined mutation path | [`server/src/controllers/bookmarksController.ts`](../../server/src/controllers/bookmarksController.ts) | Bulk write semantics | Medium | Toggle batch strategy |

## P2 — hygiene and guardrails

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| P2-01 | Header shell cost reduction | done | Deferred non-critical feedback service import and removed duplicate resize observer path |
| P2-02 | Read-heavy response cache standardization | done | Shared helper + cached taxonomy and legal GETs with mutation invalidation hooks |
| P2-03 | Metrics expansion + CI widening | done | Added app cache counters in `/api/metrics` and widened server CI typecheck incrementally for cache touchpoints |
| P2-04 | Slim feed markdown path | deferred | Depends on agreed lightweight renderer strategy |
| I-CI-01 | Server build emits without `--noCheck` once full server type debt is eliminated | deferred | Depends on widening `server/tsconfig.ci.json` scope |

## Prerequisites — completed

| ID | Title | Status | Evidence |
|----|-------|--------|----------|
| PRE-01 | CI client/server lint + typecheck (blocking server path) | done | [.github/workflows/ci.yml](../../.github/workflows/ci.yml) |
| PRE-02 | Compiled server in production | done | [Dockerfile](../../Dockerfile), [package.json](../../package.json) |
| PRE-03 | Sentry release/env wiring | done | [`src/utils/sentry.ts`](../../src/utils/sentry.ts), [`server/src/utils/sentry.ts`](../../server/src/utils/sentry.ts) |
| PRE-04 | Metrics foundation (`/api/metrics`) | done | [`server/src/utils/metrics.ts`](../../server/src/utils/metrics.ts) |
| PRE-05 | Frontend lint blocker fixed (`CardTags`) | done | [`src/components/card/atoms/CardTags.tsx`](../../src/components/card/atoms/CardTags.tsx) |

## Validation checklist (per work order)

- [ ] Record baseline metric(s)
- [ ] Implement minimal diff inside scope boundary
- [ ] Run `npm run lint:all`, `npm run typecheck:all`, `npm run test:ci`
- [ ] Run `npm run build` (+ `npm run build:server` when server touched)
- [ ] Capture after metrics and note tradeoffs
- [ ] Update `docs/perf/changelog.md` and work-order status in this file
