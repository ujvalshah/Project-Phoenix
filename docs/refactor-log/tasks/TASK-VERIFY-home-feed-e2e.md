# TASK-VERIFY: Home Feed Playwright Smoke / Perf Guard

## Goal
Provide **automated regression coverage** for the TASK-001 home surface: **`/` grid path** (`HomeArticleFeed` + **`HomeGridVirtualized`**), complementary to modal perf guards.

## Preconditions
- **API + auth reachable** so `tests/e2e/global-setup.ts` succeeds (otherwise specs may **skip**; fix env or mock as per project norms).
- Dev or preview URL configured consistently with existing Playwright config (`baseURL`).

## Planned coverage
1. **Long scroll**
   - Load `/` with enough items (seed data or mocks); scroll past several **virtual overscan** windows.
   - Assert **no fatal errors**, feed still responsive, optional DOM cap heuristic (bounded card roots vs page count—not `document.all` brute force if flaky).

2. **Infinite scroll**
   - Intersect or scroll until **`fetchNextPage`** path runs; assert **network** or UI signal (loading row / appended count—match existing patterns).

3. **Click latency / interaction sanity**
   - Time from visible card tap to **`ArticleModal`** open (desktop/small breakpoints as applicable) OR drawer `?expanded=` on **lg**, within a generous ceiling; fail on regressions vs baseline artifact.

4. **Masonry vs grid toggle** (if header toggles route state)
   - Ensure switching `viewMode` does not crash and grid path mounts **`HomeGridVirtualized`** again.

## Commands
- `npm run test:e2e -- tests/e2e/<new-spec>.spec.ts` (during development).
- Wire into **`npm run test:e2e:smoke`** only if CI runtime budget allows—or keep a dedicated `npm run test:e2e:home-feed` script if added to `package.json`.

## Definition of Done
- New spec committed under **`tests/e2e/`**.
- Passing locally with **`global-setup`** authenticated when server is healthy.
- Documented required env/secrets in **`docs/refactor-log/README.md`** or Playwright readme if non-obvious.
