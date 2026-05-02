# Baseline: Home Feed Performance

## Test Environment
- Device: Developer workstation (Windows), Lighthouse mobile emulation / throttled lab profile (Lighthouse default for navigation).
- Browser: Headless Chromium (via Lighthouse 13.2.0; host UA reports Chrome 147).
- Route: `/`
- Server URL: http://localhost:3000/
- Data volume: Local dev (`npm run dev` + `npm run dev:server`); API proxies showed intermittent `ECONNREFUSED` in the dev log during the audit window, which inflates paint metrics.
- Notes:
  - These runs targeted **dev mode** (**`npm run dev`**): unoptimized bundles, HMR tooling, and variable API health → Lighthouse metrics are **noisy/indicative**, not release gates.
  - Lighthouse CLI emitted `lighthouse-report-pre-task001.report.{html,json}` (copies named `lighthouse-report-pre-task001.html`; same for **post**). Ad-hoc `npx lighthouse@13`; repo also ships **`npm run perf:lh-mobile-local`** (**`lighthouse@12`**, JSON to `lighthouse-mobile-local-unthrottled.json`).
  - **INP** did not appear as a lab audit field in those performance-only JSON exports.
  - **Perf guard script:** use **`npm run test:perf-guards`** Vitest subset. **`npm run testperf-guards`** does **not** exist.
  - **Playwright (`tests/e2e/perf-guards-nugget-modal.spec.ts`):** **`global-setup` failed with `fetch` / `ECONNREFUSED`** when API unreachable → **skipped** authenticated cases; smoke pass was partial.

## Metrics (Before Task 001)
- Lighthouse Performance Score: **28** (0.28)
- FCP: **26.6 s**
- LCP: **58.6 s**
- TBT: **1,610 ms**
- CLS: **0.054**
- INP: *Not reported by Lighthouse in this run (see notes).*
- DOM Node Count (initial):
- DOM Node Count (after deep scroll):
- Main Thread Long Tasks:
- Scroll smoothness notes:
- Click latency notes:

## Metrics (After Task 001)
- Lighthouse Performance Score: **30** (0.30)
- FCP: **28.6 s**
- LCP: **59.3 s**
- TBT: **1,350 ms**
- CLS: **0.054**
- INP: *Not reported by Lighthouse in this run (see notes).*
- DOM Node Count (initial):
- DOM Node Count (after deep scroll):
- Main Thread Long Tasks:
- Scroll smoothness notes:
- Click latency notes:

## Delta Summary
- What improved:
  - **Performance score** +2 points (28 → 30).
  - **TBT** −260 ms (1,610 → 1,350 ms).
  - **CLS** unchanged (0.054).
- What stayed the same:
  - **CLS** identical between runs.
  - **INP** still unavailable from these Lighthouse artifacts.
- Remaining bottlenecks:
  - **FCP/LCP** remain very high in this environment; likely dominated by network/API availability and dev build cost, not solely feed DOM size. Re-run on a stable backend and production build for decision-grade numbers.
  - Multi-column **window virtualization** may still show mixed-height row banding (known tradeoff documented previously on the legacy `HOME_FEED_VIRTUALIZATION` path); monitor desktop grid fidelity.

---

## TASK-002 / TASK-VERIFY (follow-up execution, no new Lighthouse run)

### React Profiler
- **Not captured in-repo:** Chrome React Profiler before/after is **manual** (open DevTools → Profiler → record scroll on `/`). Code changes targeted **stable ref/select callbacks** in `HomeGridVirtualized`, **`React.memo`** on **`NewsCard`**, and **deferred lightbox URL assembly** until the lightbox opens.

### Automated home-feed smoke
- **Spec:** `tests/e2e/home-feed-smoke.spec.ts`
- Pagination is asserted via **`GET /api/articles` request count** (including cases where responses error behind the proxy).
- **`npm run perf:lh-mobile-local` / Lighthouse** was **not** re-run here; reuse prior baseline numbers until a preview + stable API pass.

---

## Home feed verification close-out (2026-05-01)

### Environment (automated run)

- **OS:** Windows 10 (`10.0.26200`).
- **Stack:** Repo scripts; Playwright **`playwright.config.ts`** spawns **`npm run dev`** (port **3000**). **`tests/e2e/global-setup.ts`** tries **`http://localhost:3000/api/auth/login`** first, then **`http://localhost:5000/api/auth/login`**.
- **Full stack (`npm run dev:all`):** Needed for **`/api`** on the dev origin unless Vite proxies to a live backend at **5000**. Playwright against **Vite-only** may see **`ECONNREFUSED`** / **proxy error** after auth attempt.

### Automated results

| Check | Result | Detail |
|--------|--------|--------|
| **`npm run test:perf-guards`** | **PASS** | Chunk cache / rollout guards (Vitest subset). |
| **`npx playwright test tests/e2e/home-feed-smoke.spec.ts`** | **SKIP (3/3)** | Global setup logged **HTTP 500** from **`POST`** to **`localhost:3000/api/auth/login`**, then **`ECONNREFUSED`** to **`localhost:5000`**. Spec helpers **skipped** (no **`[data-virtual-row]`** / no **`[data-article-id]`** in page). |
| **Lighthouse** | *not re-run* | — |

### React DevTools Profiler (manual — operator)

Record on **`/`**: (1) initial load, (2) deep scroll, (3) card click → **`ArticleModal`**, (4) filter change.

| Scenario | Expected (implementation) |
|----------|----------------------------|
| Initial load | Query + shell + first virtual rows; **`NewsCard`** mounts only for overscan-visible band. |
| Deep scroll | Virtual rows **mount/unmount**; commits should reflect **window + overscan**, not full feed cardinality. |
| Card open | Commit burst localized to **`HomePage`** **`ArticleModal`** / selection wiring. |
| Filter change | Refetch resets feed; profiler shows whether **`memo(NewsCard)`** avoids work on **`article`** identity-stable rows carried over. |

### `NewsCard` `React.memo`

- **Effective when** `article` reference is stable across irrelevant parent renders (aligned with **`useInfiniteArticles`** page identity + **`HomeArticleFeed`** prepare-article reuse).
- **Bypassed when** upstream builds a new `article` object for the same id, or unstable inline props defeat memo (home paths use stable `articleSelectHandlers`, `onCategoryClick`, and `onBookmarkChange` refs where applicable).

### Verification verdict

- **Perf guards:** **Pass** → acceptable closure for scripted perf smoke.
- **Playwright home-feed:** **Skipped** → **do not treat as regression** until re-run against **healthy API + data** (**`dev:all`** or equivalent backend + `.env`).
- Overall: **verification documented**; strict E2E green still **pending** same-origin API health for login + article list.
