# Component: NewsCard (feed card)

## Purpose

Primary interactive unit in the home feed and other grids.

Entry points:

- [`src/components/NewsCard.tsx`](../../src/components/NewsCard.tsx)
- [`src/hooks/useNewsCard.ts`](../../src/hooks/useNewsCard.ts)

## Perf topics

- Interaction state surface area per mounted card
- Child atom costs: media, tags, overflow measurement

## Related routes

[`../routes/home.md`](../routes/home.md)
