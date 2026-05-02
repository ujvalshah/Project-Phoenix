# API: Articles

Express routes mount at `/api/articles` via [`server/src/routes/articles.ts`](../../server/src/routes/articles.ts).

## Primary handlers

- [`server/src/controllers/articlesController.ts`](../../server/src/controllers/articlesController.ts)

## Perf topics to track here

Query fan-out modes (filters, hybrid search branches), normalization cost, serialization shape to client.
- WO-04 shipped: hybrid search fan-out (`distinct + find` x2) consolidated into one aggregation `$facet` round trip in `getArticles`.


## Related DB dossier

[`../db/article-queries.md`](../db/article-queries.md)
