# View Full Article Regression Debug

## Root Cause Found

Two regressions were introduced by the recent interaction optimization changes.

1. **Drawer reopen/double-trigger regression (`HomeArticleFeed`)**
   - The new URL sync helper used `startTransition` + `queueMicrotask` to clear `isUpdatingFromUrlRef`.
   - That released the guard before the `expanded` query param update had settled.
   - Close flow briefly produced this sequence:
     - local state closes drawer (`drawerOpen=false`, `expandedArticleId=null`)
     - URL still temporarily contains previous `expanded` id
     - sync effect sees URL id and reopens drawer
   - Result: close looked like open/close again.

2. **Click-through during drawer close (`ArticleDrawer`)**
   - During close animation, drawer/backdrop switched to `pointer-events-none`.
   - This allowed the finishing click to pass through to underlying UI while the drawer was still visually present.
   - On long feed pages this can hit cards/FAB and cause accidental actions (including scroll-to-top if FAB is hit).

## Back-to-top FAB Investigation

- FAB z-index is `Z_INDEX.CHROME_WIDGET` (95), below drawer host (`Z_INDEX.DRAWER`, 1200).
- While drawer is open, FAB should not be reachable.
- The issue was **not static z-index ordering**; it was **close-time click-through** caused by drawer dropping pointer interception mid-exit.
- Therefore FAB was an involved symptom vector, not the primary state-management root cause.

## Fix Strategy

**Fixed forward with partial targeted revert**:
- Reverted only the risky URL-sync timing pattern in `HomeArticleFeed` to the prior stable guard timing (`setTimeout`-based guard release), while keeping `preventScrollReset`.
- Kept the performance-safe preloading change.
- Hardened `ArticleDrawer` close behavior so overlay/backdrop continue intercepting pointer events during exit.

## Exact Files Changed

- `src/components/feed/HomeArticleFeed.tsx`
  - Removed `startTransition`-based `updateExpandedSearchParam`.
  - Restored direct param updates in open/close/navigate handlers with explicit guard timing.
  - Kept `{ preventScrollReset: true }` in query-param updates.
  - Reverted effect guard release from microtask back to timeout on URL-driven open path.

- `src/components/ArticleDrawer.tsx`
  - Prevented close re-entry while already closing.
  - Kept overlay/backdrop `pointer-events` active during close animation to block click-through.
  - Kept `focus({ preventScroll: true })` for focus restoration.

## Why Double Open/Close Happened

- URL param (`expanded`) and local drawer state were being synchronized by both event handlers and an effect.
- The new microtask-based guard release could occur before router state settled.
- That allowed the effect to interpret stale URL as a reopen instruction immediately after close.

## Why Scroll Still Reset Happened

- The scroll jump was primarily from accidental close-time click-through (possible underlying FAB/card interaction), not from a single explicit `scrollTo(0)` in the drawer close path.
- Query-param updates now keep `preventScrollReset`, and close-time click-through is blocked.

## Verification Results

- Typecheck passed: `npm run typecheck`.
- No new lints on changed files.
- Regression conditions addressed:
  - drawer closes once
  - close does not auto-reopen
  - drawer close no longer allows pointer events to underlying feed/FAB during exit
  - scroll context preservation path no longer races query sync on close

## Decision

- **Fixed forward** with a **small partial revert** of the unstable URL-sync timing change.
- Full revert was unnecessary once root causes were isolated and corrected safely.
