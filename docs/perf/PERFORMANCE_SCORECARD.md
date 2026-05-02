# Performance scorecard — baseline & regression

Single place to record **what we measure**, **what is automated**, and a **frozen baseline** after the startup-shell / lazy-chunk / DnD / typecheck fixes. Refresh this snapshot when deliberate perf work lands.

## How to refresh the baseline row

Same machine variability applies; CI is the reproducible lane.

```bash
npm run build
node scripts/check-bundle-budget.mjs
npm run perf:scorecard-bundle-snapshot
npm run typecheck:client
npm run build:server
npm run test:perf-guards
```

Optional deep dive:

```bash
npm run analyze:bundle && node scripts/print-bundle-top.mjs
```

Optional local Lighthouse (dev server must be up on `:3000`):

```bash
npm run perf:lh-mobile-local
```

## Snapshot — 2026-05-02 (bundle rows refreshed; gzip labels unchanged vs prior snapshot; TASK-034 vendor-markdown isolation row)

Captured after `npm run build` + checks above. **Hashed filenames** (`index-*`, chunks) change when bundle graph changes.

| Metric | Observed | Hard limit / expectation | Automated? |
|--------|-----------|---------------------------|-------------|
<!-- PERF_SCORECARD_BUNDLE_ROWS_START -->
| **index \*.js** (main app entry chunk) | **101 872 bytes** (~28.5 kB gzip per Vite output) | `indexJsMaxBytes` **550 000** in `scripts/bundle-budget.json` | ✅ `npm run test:bundles` / `build:verify` |
| **CreateNuggetModal \*.js** (modal core chunk) | **140 574 bytes** (~32.5 kB gzip) | `createNuggetModalChunkMaxBytes` **190 000** | ✅ same |
<!-- PERF_SCORECARD_BUNDLE_ROWS_END -->
| **Client typecheck** | **clean** (`tsc --noEmit`) | Must stay error-free | ✅ CI `npm run typecheck:client` |
| **Server TS emit** | **clean** (`tsc -p server/tsconfig.build.json --noCheck`) | Must compile for deploy bundle | ✅ CI `npm run build:server` |
| **Perf guard tests** | **7 / 7** pass (`performanceRollout` + `markdownSlimFeedIsolation` + `createNuggetModalChunk` cache dedupe) | Must pass | ⚠️ **Partially** — tracked subset; full suite via `npm run test:ci` in CI |

### Reference lazy / vendor chunks (same build)

Not CI-gated today; paste from `npm run build` when comparing refactors.

| Chunk (suffix pattern) | Raw (approx) | Gzip (Vite label) |
|------------------------|--------------|----------------|
| vendor-react | 430 kB | ~131 kB |
| useHomeGridColumnCount | 193 kB | ~38.5 kB |
| vendor-markdown | **184 kB** | ~54.5 kB |
| Header | 130 kB | ~22.6 kB |
| CollectionsPage | 107 kB | ~18.4 kB |
| HomePage | 38 kB | ~10 kB |
| AdminPanelPage (router shell only) | 24 kB | ~5.3 kB |
| sortable.esm (@dnd-kit shared) | 46 kB | ~15.3 kB |
| UnifiedMediaManager (+ DnD UI) | 29 kB | ~4.5 kB |
| vendor-sentry | 10 kB | ~3.3 kB |

**TASK-034 — `vendor-markdown-*.js`:** ~**184 kB** raw / **~54.5 kB** gzip (`npm run analyze:bundle`). Collapsed feed cards use **`LightweightMarkdownExcerpt`** + **`slimFeedMarkdown`** (no `react-markdown`). Full GFM loads via **`MarkdownRenderer`** (detail, expanded card, pipe-table / disclaimer-table escalation). Guard: `src/utils/__tests__/markdownSlimFeedIsolation.test.ts` (`npm run test:perf-guards`).

## Automation map

| Capability | Location | Runs in CI? |
|------------|----------|-------------|
| Vite production build | `npm run build` | ✅ (`build` job) |
| `dist` sanity + bundle budgets | `npm run build:verify` (`verify-build.js` + `check-bundle-budget.mjs`) | ✅ |
| Client typecheck | `npm run typecheck:client` | ✅ (`quality` job) |
| Server typecheck | `npm run typecheck:server` | ✅ (`quality` job) |
| Server compile to `server/dist` | `npm run build:server` | ✅ (`build` job) |
| Bundle treemap artifact | `ANALYZE=1 vite build`, `scripts/print-bundle-top.mjs` | ❌ local / optional |
| Vitest perf guard subset (`performanceRollout`, `markdownSlimFeedIsolation`, `createNuggetModalChunk` cache) | `npm run test:perf-guards` | ❌ not isolated; **`test:ci` runs full Vitest** |
| Playwright perf smoke (`perf-guards-nugget-modal`) | `npm run test:e2e:smoke` | ✅ CI **`quality`** job (Mongo + `dev:all` via Playwright `webServer`) |
| Lighthouse JSON | `npm run perf:lh-mobile-local` | ⚠️ manual locally; optional CI workflow **Lighthouse mobile (preview)** (`workflow_dispatch`) |
| Scorecard bundle rows | `npm run perf:scorecard-bundle-snapshot` (after `npm run build`) | ❌ manual |

## Runtime / route observability (dev & prod UA)

Instrumentation exists **in app code** — no separate dashboard unless you ingest it.

| Signal | Files / marks |
|--------|----------------|
| Cold boot shell | `src/main.tsx` — `app:boot:start`, `app:boot:mounted`, measure `app:boot:mount` |
| SPA route transitions | `src/App.tsx`, `src/utils/routeProfiling.ts` — `route:transition:…`, `route:content-ready:…`, `markRouteContentReady` |
| Home feed | `src/pages/HomePage.tsx` — marks for query state / first content + measures |
| Admin navigation | `src/admin/layout/AdminLayout.tsx` — `markPagePerformance({ name: 'admin:navigation', … })` via `telemetry.ts` |
| Nugget modal CTP budgeting | `src/components/CreateNuggetModal.tsx` — marks/measures around critical path |

**Consumption:** Chrome DevTools → Performance → user timings / `performance.getEntriesByType('measure')` in console.

## Gaps — not scripted today

- **Core Web Vitals / LCP** aggregation on every PR (Lighthouse: **local** script + **optional** `workflow_dispatch` workflow; not a default PR gate).
- **Per-chunk gzip budgets** (only raw bytes for index + modal in `bundle-budget.json`).
- **`Header`**, **`vendor-react`**, **`HomePage`** size regressions beyond eyeballing build output or treemap.
- **API latency / React Query staleTime** dashboards (values live in hooks / `src/queryClient.ts`, not asserted in CI).

## Task notes

- **TASK-021:** Masonry remained non-virtualized by design; optimization focused on tile memoization plus capped entrance animation because masonry is opt-in, not default.
- **TASK-022:** Feed card images now use tighter above-fold `fetchpriority=high`/eager coverage (`cols+1`), responsive `sizes` on hero/grid/masonry tiles, and 16∶9 intrinsic dimensions on fixed-aspect hero thumbnails; CDN/`srcset` alignment is separate if transforms are introduced.
- **TASK-023:** Cloudinary **`/image/upload/`** URLs without an existing transform segment get width-based **`srcSet`** (`feedImageResponsive.ts`); YouTube, OG, **`/image/fetch/`**, pre-transformed Cloudinary, and other hosts stay single **`src`** (safe fallback).
- **TASK-024:** Workspace grid/list cards use the same responsive **`src`/`srcSet`/`sizes`** + priority thumb budget as the main feed; list/grid remain non-virtualized (filtered client-side); CI **`quality`** job runs Playwright smoke against Mongo so both perf-guard tests pass.
- **TASK-025:** Admin nuggets **card** view + moderation **ReportContentPreview** use feed-style responsive thumbnails; scorecard bundle row automation (`perf:scorecard-bundle-snapshot`); optional Lighthouse workflow; E2E modal wait includes **Title (Optional)**.
- **TASK-026:** Documentation closeout only — [refactor-log closeout](../refactor-log/CLOSEOUT-TASK-026.md) records completed vs documented work, risks, and next-wave tasks.
- **TASK-027:** E2E smoke is **reliable in CI** (2-pass expected): relaxed perf-guard limits, Mongo service, and **single-base** auth so the Playwright `quality` job can run `test:e2e:smoke` without flakes.
- **TASK-028:** `AdminTable` **window virtualization** via `@tanstack/react-virtual` (`useWindowVirtualizer`): fixed row height with **spacer rows** (no `transform` on data rows) so **sticky** header + bulk-select checkboxes keep working; expanded admin rows (e.g. moderation) **fall back** to full render.
- **TASK-032 / TASK-034:** Collapsed feed cards use **`LightweightMarkdownExcerpt`** + **`slimFeedMarkdown`** (no `react-markdown` on that path). **`vendor-markdown`** remains a separate chunk for **`MarkdownRenderer`** (detail, expand, tables). **TASK-034** documents the chunk + adds **`markdownSlimFeedIsolation`** perf guard.

## Related docs

- [README](README.md) — perf folder index  
- [PERF_MASTER.md](PERF_MASTER.md) — program architecture  
- [changelog.md](changelog.md) — narrative history (update when changing budgets or major splits)
