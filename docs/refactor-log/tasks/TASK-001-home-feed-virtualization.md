# TASK-001: Home Feed Virtualization Swap

## Goal
Replace `ArticleGrid` in `src/pages/HomePage.tsx` with the **`HomeGridVirtualized`** grid path (`HomeArticleFeed` composes `HomeGridVirtualized` so masonry, drawer URL state, and error/loading UI remain intact).

## Implementation status (live repo)
**Implemented — not fully proven:** typecheck passes; **`HomeArticleFeed`** is wired from **`HomePage`**. Automated proof is incomplete: Lighthouse ran against **dev** (noisy); Playwright global setup hit **`ECONNREFUSED`** so related specs could skip. See [`README.md`](../README.md).

## Requirements
1. Map `useInfiniteArticles` outputs correctly into the virtualized component.
2. Preserve existing click handlers, retry behavior, empty state, loading state, and error state.
3. Preserve existing Home feed filters and pagination behavior.
4. Do not change server contracts or query keys in this task.

## Exclusions
- Do NOT refactor `RestAdapter`.
- Do NOT refactor `useInfiniteArticles`.
- Do NOT add markdown deferral, image lazy-loading changes, or Collection Detail changes in this task.
- Do NOT touch backend files.

## Definition of Done
- `HomePage` uses the virtualized feed path (**via `HomeArticleFeed`**).
- Infinite scrolling still works.
- Existing interactions still work.
- `npm run typecheck` passes.
- Relevant perf/test checks pass (canonical: **`npm run test:perf-guards`** — there is **`no`** `testperf-guards` script).
- Baseline file is updated with pre/post results (treat LH numbers as indicative only until preview + stable API).

## Follow-up
- **TASK-002** — render churn / deferral audit.
- **TASK-VERIFY** — home-feed Playwright smoke (scroll, pagination, clicks).
