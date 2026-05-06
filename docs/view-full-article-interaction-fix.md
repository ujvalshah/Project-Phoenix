# View Full Article Interaction Fix

## Scope
- Surface: home feed/grid "View Full Article" interaction.
- Goals: instant-feeling open, exact scroll continuity after close, and no infinite-feed reset.

## Root Causes Found

### Lag Before Article View Opened
1. The detail panel was code-split and loaded only at interaction time for some paths.
   - Desktop grid had an eager import path, but mobile/feed and first interaction still depended on late module fetch timing.
2. URL search-param synchronization (`expanded`) was coupled to the same interaction path as drawer open.
   - Param writes can trigger route-level state updates during the same user click, delaying perceived response.
3. URL-sync guard logic used timer-based release (`setTimeout`) in open/close paths.
   - This was brittle and could extend interaction state churn under load.

### Scroll Reset / Jump-to-Top
1. Drawer close restored focus with `element.focus()` (default scroll behavior).
   - Browsers are allowed to scroll the focused element into view, which can fight preserved feed scroll position.
2. Expanded query-param writes/deletes did not explicitly prevent scroll-reset semantics.
   - On long feeds, this can surface as jumpy restoration behavior.
3. Modal scroll lock relied on overflow toggling only.
   - On long/mobile scroll surfaces, overflow-only lock/unlock can produce inconsistent scroll restoration.

## Files Changed
- `src/components/ArticleDetailLazy.tsx`
- `src/components/feed/HomeArticleFeed.tsx`
- `src/components/ArticleDrawer.tsx`
- `src/components/UI/ModalShell.tsx`

## Exact Fix Implemented

### 1) Open Feels Immediate (Prefetch + Decoupled URL Update)
- Added shared detail-module preload API in `ArticleDetailLazy`:
  - `preloadArticleDetail()` now reuses the same module promise as the lazy component.
- In `HomeArticleFeed`:
  - Opportunistically preloads `ArticleDetail` after feed items exist, during idle time (with timeout fallback).
  - On desktop card click, opens drawer state immediately and preloads detail module right away.
  - Moved `expanded` query-param writes into a single helper that runs in `startTransition`, keeping visible UI updates first.

### 2) Removed Timer-Based Interaction Coordination
- Replaced `setTimeout(..., 100)` and `setTimeout(..., 0)` URL-sync guard resets with `queueMicrotask`.
- Result: deterministic, non-arbitrary coordination without timeout hacks.

### 3) Scroll Preservation Hardened
- In `HomeArticleFeed`, all `setSearchParams` updates for `expanded` now use:
  - `{ replace: true, preventScrollReset: true }`
- In `ArticleDrawer`:
  - Focus handoff now uses `{ preventScroll: true }` for both initial focus trap entry and close-time return focus.
  - This prevents focus-driven scroll jumps during close.
- In `ModalShell`:
  - Upgraded body lock/unlock to deterministic fixed-position locking with captured `scrollY`.
  - Added nested lock counting to avoid conflict between stacked modals.
  - Restores exact scroll position on final unlock via `window.scrollTo`.

## Infinite Scroll / Virtualized Feed Safety
- No feed data source or pagination logic was changed.
- No query keys or cache invalidation behavior was changed.
- No remounting trigger was added for `HomeGridVirtualized`.
- `expanded` URL sync remains intact for back/forward navigation, now with safer scroll handling.

## Verification Performed
- `npm run typecheck` passed.
- Verified lints for changed files: no new linter errors.

## Remaining Risks / Follow-ups
- If any other overlay bypasses `ModalShell` and implements custom body lock, it may still exhibit drift. Those should converge to one lock strategy.
- If additional route-level overlays use search-param state, they should also use `preventScrollReset: true` when the intent is in-place overlay state.

## Pattern to Reuse Elsewhere
For any long-feed overlay interaction:
1. Open shell state first (immediate feedback).
2. Defer URL synchronization work with transition priority.
3. Preload heavy detail chunks opportunistically (idle + intent).
4. Use focus restore with `preventScroll`.
5. Use deterministic body lock with captured `scrollY` and exact restore on unlock.
