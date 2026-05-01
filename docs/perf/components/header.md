# Component: Header (global chrome)

## Purpose

Always-mounted navigation and global utilities.

Primary file:

- [`src/components/Header.tsx`](../../src/components/Header.tsx)

## Perf topics

- Reduce work on initial route and on navigation
- Intent-based lazy mounting for non-critical popovers

## Latest optimization (WO-08 / B008)

- `src/components/Header.tsx` now loads `adminFeedbackService` with dynamic `import()` inside drawer feedback submit, instead of importing it on every app boot.
- Consolidated duplicate `resize` listeners for viewport flags (`isMobile`, `isTablet`, `isXl`) into a single observer path.

Expected effect:

- Slightly lower initial header shell parse/eval cost.
- Fewer redundant resize-driven state updates while keeping behavior unchanged.
