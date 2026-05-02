# Context Bridge: Nuggets Performance Refactor

## Core Tech Stack
- **Frontend**: React 19.2.1, Vite 7.2.7, React Router 7.10.1.
- **Backend**: Express 5.2.1, Node-Redis 5.x, Mongoose 9.0.1.
- **State Management**: TanStack React Query 5.90.12.
- **Virtualization**: TanStack React Virtual 3.13.13 (installed, underutilized).

## Architectural Constraints
- **Data Layer**: Runtime is strictly `RestAdapter`. `LocalAdapter` is legacy/dead code.
- **Query Strategy**: `staleTime` 5m, `gcTime` 30m, `refetchOnWindowFocus: false`.
- **Pagination**: Home feed and Pulse use page-number based infinite loading (limit: 25).

## Home feed path (current)
**`HomePage` → `HomeArticleFeed`:** the **default grid** view uses **`HomeGridVirtualized`** (TanStack Virtual) so only the virtual window (plus overscan) mounts card rows. **`MasonryGrid`** is used when `viewMode === 'masonry'`. **`ArticleGrid`** remains for **Saved**, **Collections browse**, and **Collection detail** — not the main `/` feed.

## Residual pressure
Non-home surfaces that still use **`ArticleGrid`** (or long admin tables without virtualization) can still grow DOM or main-thread cost on deep lists; see **`docs/refactor-log/CLOSEOUT-TASK-026.md`** for ranked follow-ups.
