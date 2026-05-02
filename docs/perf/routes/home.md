# Route: Home (`/`)

## Purpose

Primary feed experience and cold-load critical path.

## Rendering model

CSR shell → lazy-loaded page:

- Router + shell: [`src/App.tsx`](../../src/App.tsx)
- Page: [`src/pages/HomePage.tsx`](../../src/pages/HomePage.tsx)
- Grid: [`src/components/ArticleGrid.tsx`](../../src/components/ArticleGrid.tsx) (and masonry path when enabled)

There is **no SSR for humans** beyond OG middleware for crawlers (see [`server/src/middleware/ogMiddleware.ts`](../../server/src/middleware/ogMiddleware.ts)).

## Data fetching

Typical queries on first paint:

- Feed pages: [`src/hooks/useInfiniteArticles.ts`](../../src/hooks/useInfiniteArticles.ts)
- Taxonomy: [`src/hooks/useTagTaxonomy.ts`](../../src/hooks/useTagTaxonomy.ts)
- Misc chrome/config queries referenced from home subtree (legal, disclaimers, etc.)

## Perf risks (to validate with traces)

- **DOM scaling** with accumulated infinite pages unless windowed/virtualized.
- **Per-card markdown / measurement** CPU in [`docs/perf/components/card-content.md`](../components/card-content.md).

## Owned backlog items

See [backlog.md](../backlog.md) P1-02 feed windowing.

## Change log pointers

[`../changelog.md`](../changelog.md)
