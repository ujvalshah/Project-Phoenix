# Closeout — TASK-026 (refactor program + perf documentation)

**Date:** 2026-05-02  
**Scope:** Documentation alignment after performance / feed / admin work through **TASK-025**.  
**Code:** None in this task (docs only).

## 1. Source-of-truth map

| Area | Canonical location |
|------|-------------------|
| Refactor program (home path, task index) | [`README.md`](README.md) |
| System invariants | [`03-invariants.md`](03-invariants.md) |
| Stack / context (keep current) | [`00-context-bridge.md`](00-context-bridge.md) |
| Performance baselines, CI map, refresh commands | [`../perf/PERFORMANCE_SCORECARD.md`](../perf/PERFORMANCE_SCORECARD.md) |
| Work orders + P0–P2 backlog | [`../perf/backlog.md`](../perf/backlog.md) |
| Note: `docs/refactor/` | **Not used** in this repo; use **`docs/refactor-log/`** only. |

## 2. Completed work — documentation vs implementation

| Task / theme | Doc said | Reality (2026-05-02) | Action taken |
|--------------|----------|------------------------|----------------|
| **TASK-001** | Virtualized home path; verification incomplete | `HomePage` → `HomeArticleFeed` → `HomeGridVirtualized` for grid; **home does not** use `ArticleGrid` for the main feed | README already correct; **00-context-bridge** was wrong — **updated** |
| **TASK-002** | Render audit + measured improvement | Code: `HomeGridVirtualized` ref stability, `NewsCard` memo, deferred lightbox URL work (per [BASELINE-001](baselines/BASELINE-001-home-feed.md)) | Marked **delivered in code**; profiler evidence remains **manual** |
| **TASK-003** | RQ infinite collection list | `CollectionDetailPage` uses `useInfiniteArticles` + `feedKeys.collectionEntriesInfiniteRoot` | **TASK-003** file **updated** with implementation status |
| **TASK-VERIFY** | Home-feed Playwright | `tests/e2e/home-feed-smoke.spec.ts` exists; can **skip** when login/API unhealthy | **Risk** — see §4 |
| **TASK-021–024** | Feed / workspace images, Cloudinary `srcSet`, etc. | Reflected in [PERFORMANCE_SCORECARD.md](../perf/PERFORMANCE_SCORECARD.md) task notes | **Accurate** |
| **TASK-025** | Admin dashboard rendering audit | Card thumbnails: responsive `src`/`srcSet`/`sizes` + priority; moderation preview image; scorecard + Lighthouse workflow + E2E modal helpers (see [TASK-025](tasks/TASK-025-admin-dashboard-rendering.md)) | **New task note** |
| **CI E2E** | Some docs said smoke “not in CI” | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) **`quality`** job runs `npm run test:e2e:smoke` with **Mongo**; Playwright starts **`npm run dev:all`** via `webServer` in `playwright.config.ts` | **Scorecard** automation table **corrected** |

## 3. Measurable wins (recorded)

- **Bundle budgets (client):** Main `index-*.js` **~102 kB** raw; **CreateNuggetModal** chunk **~141 kB** raw — both under limits in `scripts/bundle-budget.json` (see scorecard snapshot row, refresh via `npm run perf:scorecard-bundle-snapshot` after `npm run build`).
- **Automated checks:** `npm run typecheck:client`, `npm run test:perf-guards` (4 tests) — clean in last workflow-aligned run.
- **Home feed:** Virtualized grid path reduces unbounded DOM growth vs full `ArticleGrid` on `/` (qualitative; deep-scroll Lab numbers remain environment-sensitive per baseline doc).
- **Admin (TASK-025):** Nuggets **card** view uses feed-aligned responsive thumbnails + above-the-fold priority cap; moderation preview uses responsive helper for small thumbs.
- **Tooling:** `npm run perf:scorecard-bundle-snapshot`; optional GitHub Action **Lighthouse mobile (preview)** (`workflow_dispatch`); Playwright `waitForModal` waits for dialog + **Title (Optional)** field.

## 4. Unresolved risks

| Risk | Severity | Notes |
|------|-----------|--------|
| **Lab Lighthouse / dev noise** | Medium | Baseline [BASELINE-001](baselines/BASELINE-001-home-feed.md) used **dev** + unstable API; scores are **not** release gates without **preview + stable backend**. |
| **Home-feed E2E skips** | Medium | When `global-setup` or API fails, **home-feed-smoke** skips — closure is “documented” not “always green” locally. |
| **Admin long lists** | Medium | `AdminTable` **virtualized** prop is **deprecated / unused**; **no** row virtualization for large admin tables yet — UX and main-thread cost at scale. |
| **Lighthouse not on every PR** | Low | Optional workflow exists; local script still needs running app. |
| **Gzip / large chunk regression** | Low | Only **index + modal** raw bytes are CI-gated; **Header** / **vendor-react** growth is **manual** eyeball (scorecard “Gaps”). |

## 5. Next wave — five ranked tasks

1. **Admin list virtualization (TASK follow-up)** — Implement real virtualization or replace deprecated props for **long** admin tables (`AdminNuggetsPage`, `AdminUsersPage`, etc.); preserve bulk actions, selection, and drawers. Highest impact for ops-heavy tenants.
2. **Close TASK-VERIFY on CI** — Add **seed data** or **health assertion** so `home-feed-smoke.spec.ts` **runs green** in CI without fragile skips; optionally add narrow script `test:e2e:home-feed` in `package.json` for local ergonomics.
3. **Lighthouse signal hardening** — On scheduled or manual workflow: persist JSON artifact, document **how to compare** two runs; optional **budget JSON** check (performance score floor — flaky, document variance).
4. **Bundle / chunk guardrails** — Extend budget script or CI step to **warn** on top-N chunk growth (e.g. **Header**, **vendor-react**) using `dist/assets` + manifest — non-blocking at first.
5. **Deferred product-tech decision** — **P2-04** slim markdown renderer: choose strategy so feed list work does not pull full **`vendor-markdown`** into critical paths beyond current boundaries.

## 6. Stale notes removed or corrected (this pass)

- **`00-context-bridge.md`:** Removed incorrect claim that Home renders through **`ArticleGrid`**.
- **`PERFORMANCE_SCORECARD.md`:** E2E smoke row now matches **CI `quality`** job; **Gaps** section acknowledges optional **Lighthouse** workflow; **TASK-025** note added.

## 7. Related

- [TASK-025-admin-dashboard-rendering.md](tasks/TASK-025-admin-dashboard-rendering.md)
- [PERFORMANCE_SCORECARD.md](../perf/PERFORMANCE_SCORECARD.md)
