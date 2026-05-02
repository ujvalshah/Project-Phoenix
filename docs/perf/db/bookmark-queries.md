# DB / queries: Bookmarks

Controller:

- [`server/src/controllers/bookmarksController.ts`](../../server/src/controllers/bookmarksController.ts)

## Perf topics

Pagination + search semantics for large bookmarks sets.
- WO-07: atchToggle switched from sequential per-item helper calls to bulk bookmark/link operations and batched counter updates.


- WO-03: search in `getBookmarks` is DB-bounded via Mongo aggregation (`$lookup` article by `itemId`, access filter, text match, `$facet` count+page) instead of loading all bookmarks and filtering/paginating in memory.
