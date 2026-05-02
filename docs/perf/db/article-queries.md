# DB / queries: Articles

Living notes for hotspots in article listing pipelines.

Controllers:

- [`server/src/controllers/articlesController.ts`](../../server/src/controllers/articlesController.ts)

Models:

- [`server/src/models/Article.ts`](../../server/src/models/Article.ts)

## What to paste here later

Explain plans (`explain()`), scanned docs estimates, compound index recommendations, migration notes.

- WO-04: `getArticles` hybrid mode now uses one aggregation `$facet` call (relevance docs/ids + fallback docs/ids) instead of four separate round trips.
