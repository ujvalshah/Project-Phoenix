# KPI contract — Nugget modal (composer path)

**Purpose:** Measurable targets for **click → visible shell** and **click → core interactive**, without forcing the heavy editor/media graph to load with the shell. **Editor-ready** may trail the shell.

## Targets

| Metric | Warm | Cold | Notes |
|--------|------|------|--------|
| Click → **shell visible** | \< 100 ms | \< 200 ms | Shell = modal chrome + safe title/primary affordances per `01-data-contract.md`; **not** full markdown surface. |
| Click → **core interactive** | \< 250 ms | \< 400 ms | User can meaningfully act (e.g. focus title, dismiss, start typing in shell-allowed fields) without waiting for deferred tiers. |
| **Editor-ready** | Best-effort after shell | Same | Rich body editor may hydrate after shell; targets are secondary to shell/core. |

**Warm** = modal chunk already fetched (e.g. after intent preload from `preloadCreateNuggetModalChunk` in `src/components/createNuggetModalChunk.ts`). **Cold** = no prefetch; first `import()` after click.

## Architectural constraints (measurable)

1. **Shell chunk must not synchronously import** the heavy markdown/editor bundle (`ContentEditor` path, `vendor-markdown` isolation in `vite.config.ts`) or **UnifiedMediaManager**-scale UI (`CreateNuggetModal.tsx` uses `React.lazy` for `./CreateNuggetModal/UnifiedMediaManager`).
2. **Double-rAF “paint” probe** is already implemented for observability when `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS` \> 0 (`CreateNuggetModal.tsx` + `src/utils/nuggetModalPerfConfig.ts`). Composer V2 should keep a comparable probe on the **shell** boundary, not only inside the monolithic modal.

## Gate: CTP budget warning

If **local profiling** consistently exceeds the configured `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS` budget for **shell visible** (once the shell is split), **`VITE_NUGGET_COMPOSER_V2` must not become default-on** until the shell path is optimized or targets in this doc are revised with owner sign-off.

*(Today the warning measures the monolithic modal’s first paint after open, not a separate shell component.)*

## Verification sources — this repo (actual)

| Source | What it enforces today |
|--------|-------------------------|
| `npm run test:perf-guards` | Runs Vitest files listed in `package.json` under `test:perf-guards`. |
| `src/utils/__tests__/performanceRollout.test.ts` | Preload cohort helper; feature off when `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD=false`. |
| `src/components/__tests__/createNuggetModalChunkCache.test.ts` | **Warm path:** repeated `loadCreateNuggetModalModule()` shares one `import()` promise (`createNuggetModalChunk.ts`). |
| `src/utils/__tests__/markdownSlimFeedIsolation.test.ts` | **Feed cards** stay off `react-markdown` / `remark-gfm` in slim paths — related to bundle hygiene, not modal latency directly. |
| `tests/e2e/perf-guards-nugget-modal.spec.ts` | **E2E:** after two open cycles, **no second network fetch** of a URL containing `CreateNuggetModal` (duplicate chunk fetch regression). Does **not** assert ms timings. |
| `npm run build:verify` / `scripts/check-bundle-budget.mjs` | Bundle size budgets (including modal chunk snapshot tooling in `scripts/update-scorecard-bundle-snapshot.mjs`). |
| `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS` | **Dev-only** console warning; not a CI assertion. |

**Gap (explicit):** No automated test currently asserts 100/200 ms shell or 250/400 ms core-interactive. Composer V2 work should add **either** small perf tests (e.g. mark-based budgets in Vitest with generous slack + mocked dynamic imports) **or** Playwright traces with budget gates — **after** shell extraction makes timing meaningful.

## Current vs target (timing semantics)

| | **Current** | **Target (composer V2)** |
|---|-------------|---------------------------|
| First user-visible modal state | `CreateNuggetModalLoadable` Suspense fallback (spinner) until **`CreateNuggetModal` entire chunk** loads (`CreateNuggetModalLoadable.tsx`). | Lightweight **shell** Suspense boundary paints first; heavy tiers defer. |
| Editor | `NuggetContentEditorPanel` + optional lazy `ContentEditor` (`NuggetContentEditorPanel.tsx`). | Same or `VITE_NUGGET_EDITOR_V2`; must hydrate **after** shell KPI. |
