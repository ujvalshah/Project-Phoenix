# TASK-025 — Admin dashboard rendering audit (record)

## Status

**Closed (2026-05-02)** — implementation landed in admin UI + tooling; see [CLOSEOUT-TASK-026.md](../CLOSEOUT-TASK-026.md).

## Goal (original)

Audit admin shell lazy routes, table/card rendering, DnD pairing with `@dnd-kit`, and align heavy thumbnails with feed/workspace image patterns where safe.

## What shipped

- **`AdminNuggetsPage`** (card view): `buildFeedImageResponsiveProps` + `WORKSPACE_GRID_CARD_IMAGE_SIZES`, intrinsic hints, `decoding="async"`, priority loading for first **N** tiles via `getPriorityThumbnailCount` (3-column grid).
- **`ReportContentPreview`** (nugget): responsive thumb + `sizes="80px"` for moderation preview.
- **Docs / automation:** `npm run perf:scorecard-bundle-snapshot`; markers in `docs/perf/PERFORMANCE_SCORECARD.md`; optional workflow `.github/workflows/lighthouse-mobile.yml`; Playwright **`waitForModal`** waits for dialog + **Title (Optional)** visible.

## Explicit non-goals / follow-ups

- **No** virtualization added for admin tables (`AdminTable`’s `virtualized` flag remains unused) — see **next wave #1** in [CLOSEOUT-TASK-026.md](../CLOSEOUT-TASK-026.md).

## Verification commands (as run in development)

- `npm run typecheck:client`
- `npm run test:perf-guards`
- `npm run build` + `npm run test:bundles`
- `npm run test:e2e:smoke` (requires stack reachable — e.g. `npm run dev:all`)
