# API: Bookmarks

Routes under `/api/bookmarks` via [`server/src/routes/bookmarks.ts`](../../server/src/routes/bookmarks.ts).

## Perf hotspots

Anything that scans large user corpora server-side:

- Prefer DB-bounded pagination and indexed text strategy over full in-memory passes.
- WO-07 shipped: atch-toggle no longer loops with sequential awaits; now uses bulk/pipelined DB operations.

- WO-03 shipped: search path in `getBookmarks` now runs in Mongo aggregation with `$facet` pagination.

[`../db/bookmark-queries.md`](../db/bookmark-queries.md)
