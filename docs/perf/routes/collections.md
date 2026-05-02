# Route: Collections (`/collections`, `/collections/:id`)

## Rendering model

CSR via React Router. Collection detail pulls collection-scoped feeds and metadata.

Likely hotspots:

- Page: [`src/pages/CollectionsPage.tsx`](../../src/pages/CollectionsPage.tsx) (list)
- Page: [`src/pages/CollectionDetailPage.tsx`](../../src/pages/CollectionDetailPage.tsx) (detail)

## Data fetching

Client adapter path:

- Primary API surface documented in [`../apis/articles.md`](../apis/articles.md) and collection routes under [`server/src/routes/collections.ts`](../../server/src/routes/collections.ts).

## Perf risks

Server-side expansion of nested collection membership vs client-only rendering churn.
- WO-06: articles route no longer fans out to child collections at read time; collection filter uses persisted entries directly.

