# Nuggets Testing Workflow (Smoke / Forensic / Performance)

This project uses a three-layer Playwright workflow to protect feed stability and performance
without slowing down normal delivery.

## Layer contract (config-driven)

- **Smoke layer** (`playwright.config.ts` project: `smoke`)
  - Fast critical-path checks for PR/push and everyday agent work.
  - No heavy geometry crawling or perf benchmarking.
- **Forensic layer** (`playwright.config.ts` project: `forensic`)
  - Geometry/layout audit for Nuggets grid/feed reconciliation.
  - Emits raw JSON snapshots for comparison.
  - Gated (not part of default fast CI suite).
- **Performance layer** (`playwright.perf.config.ts` projects)
  - `perf-append`, `perf-collect`, `perf-sidebar-guard`.
  - Tracks append latency/longtask and broader perf regressions.
  - Warning/baseline oriented; avoid brittle hard-fail budgets early.

## Commands

- `npm run test:e2e` -> smoke default
- `npm run test:e2e:smoke`
- `npm run test:e2e:forensic`
- `npm run perf:feed-append`
- `npm run perf:collect`
- `npm run perf:sidebar-guard`
- `npm run perf:all`

Forensic artifacts are written to `output/forensic/*.json` when
`NUGGETS_FORENSIC_EMIT_JSON=1` (enabled by `test:e2e:forensic` script).

Performance raw artifacts remain in `output/*.json` (for example
`output/home-feed-append-perf-results.json`).

## Trigger guidance

### Run smoke for
- Any PR touching `src/` behavior.
- UI copy, route, filter, card interaction, modal-shell behavior changes.
- Any agent-driven relevant implementation change.

### Run forensic for
- Virtualized grid/feed layout, row geometry, spacing, overflow, anchor/scroll-margin changes.
- Wrapper width/padding/max-width contract changes around home feed.
- Sidebar toggle behavior that affects feed width.

### Run performance for
- Changes that can affect append throughput or long tasks:
  - card rendering path
  - markdown/media behavior
  - virtualization measurement lifecycle
  - fetch/infinite-load behavior
- Pre-release checks and scheduled baseline trend collection.

## Metrics that matter most for Nuggets

Primary (raw source-of-truth):
- Row non-overlap (`row(i+1).top >= row(i).bottom - 1`)
- `measureParent.scrollWidth <= measureParent.clientWidth`
- append duration (`average`, `p95`)
- long-task summary (`count`, `totalBlockingTimeMs`)

Secondary:
- derived layout health score (forensic) for quick trend visibility only.

## Recommended CI behavior

- **PR/push blocking:** smoke only (`npm run test:e2e`).
- **Gated/manual jobs:** forensic and performance scripts.
- **Pre-release or scheduled:** `perf:feed-append` and/or `perf:all`, compare against recent raw baselines.

## Recommended Cursor/agent workflow

1. Implement change.
2. Run smoke.
3. If change touches feed/grid geometry or wrappers, run forensic and inspect `output/forensic/*.json`.
4. If change touches render/append/perf-sensitive path, run perf layer and compare against recent raw JSONs.
5. Escalate only on clear raw-metric regressions, not on one-off noise.
