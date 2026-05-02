# How to continue this performance program (LLM or human)

This repo’s **execution source of truth** is under `docs/perf/`. The Cursor plan file [.cursor/plans/nuggets_perf_step-change_4370e11e.plan.md](../../.cursor/plans/nuggets_perf_step-change_4370e11e.plan.md) is a concise outline; **`PERF_MASTER.md` + `backlog.md` + `changelog.md` win conflicts**.

---

## Pick one scoped unit of work

1. Read [PERF_MASTER.md](PERF_MASTER.md) bottleneck table — choose one **ID** (e.g. B003).
2. Open the matching dossier:
   - **Route work** → [routes/](routes/)
   - **Endpoint work** → [apis/](apis/)
   - **UI work** → [components/](components/)
   - **Query/index work** → [db/](db/)
3. Open [backlog.md](backlog.md) and pick a **WO-xx** from "Parallel work orders (10)".
4. If Batch-1 rows are already `done`, start from the lowest-numbered `todo` WO and keep the scope boundary strict.

Never start “drive-by” refactors across unrelated areas.

---

## Before you edit code

- **Evidence**: Paste the bottleneck’s line anchors into your PR/description (from `PERF_MASTER`).
- **Behavior contract**: Describe what must stay identical for users (API shape, redirects, UX).
- **Instrumentation**: Decide what you’ll measure **before** and **after** (see Measurement below).

---

## While implementing

- **Stay inside the dossier boundary** unless the bottleneck spans two (then update both dossiers).
- Prefer **feature flags / env gates** for risky paths (already used elsewhere, e.g. feed virtualization flag in `ArticleGrid`).
- **No sweeping cache redesign** unless the backlog item explicitly says so and ADR-003 is updated.

---

## After code changes

Run locally:

```bash
npm run lint:all
npm run typecheck:all
npm run test:ci
npm run build
npm run build:server
```

Touch server only?

- Still run `npm run build:server` when `server/` changes.

Touch feed/cards?

- Add or extend targeted tests under `src/__tests__/` when behavior is fragile.

---

## Documentation you must update (same PR)

Minimum:

1. [changelog.md](changelog.md) — what changed, rollback, baseline → after metrics (even “not yet measured”).
2. [backlog.md](backlog.md) — mark item `done` or split follow-ups.

If you changed assumptions or architecture:

- Update [PERF_MASTER.md](PERF_MASTER.md) bottleneck row (especially **Evidence** if lines moved).
- Add/adjust ADR under [decisions/](decisions/) when choosing between tradeoffs.

---

## Measurement playbook

| Surface | Quick check |
|--------|--------------|
| API latency | Compare response times locally with same fixture query; prod: use APM / logs with request id |
| Bundle | `npm run analyze:bundle`, `npm run test:bundles` |
| CWV lab | Lighthouse mobile (already scripted in [`package.json`](../../package.json) `perf:lh-mobile-local` if you run a local server) |
| DB | Add notes to dossier under [db/](db/) with `explain` output when you touch queries |

---

## Handoff blurb template (paste at end of session)

```
Worked on bottleneck: Bxxx
Outcome: merged / wip / blocked
PR:
Metrics: baseline … → after … (or: pending prod sample)
Rollback: …
Docs: PERF_MASTER §…, changelog entry YYYY-MM-DD, backlog IDs …
Open questions: …
```

See also [.cursor/rules/nuggets-performance-program.mdc](../../.cursor/rules/nuggets-performance-program.mdc) for Cursor agent defaults.
