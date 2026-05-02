# TASK-002: Home Feed Render Churn & Deferral Audit

## Record (2026-05-02)

Implementation-side work (memo, refs, deferred lightbox URL) is reflected in code; methodology and verification caveats are summarized in [`../baselines/BASELINE-001-home-feed.md`](../baselines/BASELINE-001-home-feed.md). Formal profiler exports are **not** stored in-repo.

## Goal
After TASK-001, reduce **main-thread and reconciliation cost** on the home feed path without changing server contracts—by auditing **what re-renders**, **why**, and what work can move **below the fold / off the critical path**.

## Scope (front-end home path)
- **`HomeArticleFeed`** + **`HomeGridVirtualized`** + **`NewsCard`** / card atoms used in the grid row.
- **React Query** consumers that feed props into the grid (avoid unstable identities where fixable).

## Work items
1. **Render churn**
   - Profile with React Profiler (dev) or React Scan: scrolling, filter changes, pagination append.
   - List top offenders (parent re-renders forcing full row remount vs expected virtual window churn).

2. **Unstable props**
   - Trace inline objects/functions passed from **`HomePage`** → **`HomeArticleFeed`** → cards.
   - Memo boundaries: `React.memo` on purely presentational children only where measured wins exist.

3. **Markdown deferral**
   - Ensure markdown-heavy bodies stay **non-blocking for list tiles** per project invariants (no moving markdown into initial critical path bundles without ADR).

4. **Viewport-only heavy work**
   - Defer or gate work (non-LCP thumbnails, secondary embeds, non-visible analytics) until **IntersectionObserver / virtualizer visibility** when safe.

## Exclusions (unless spun out)
- `RestAdapter` / API shape changes.
- Redis or API caching (see separate backend tasks).

## Definition of Done
- Written audit notes under `docs/refactor-log/` or `docs/perf/` linking to_profiler methodology and ranked findings.
- At least one **measured** improvement merged (profiler before/after) or justified “no change” with data.
