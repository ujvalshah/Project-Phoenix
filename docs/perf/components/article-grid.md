# Component: ArticleGrid

## Purpose

Maps visible feed items to `NewsCard` instances.

Primary file:

- [`src/components/ArticleGrid.tsx`](../../src/components/ArticleGrid.tsx)

## Perf topics

- DOM node count as infinite query pages accumulate
- Virtualization/windowing feasibility on multi-column layouts

- WO-05: non-virtual desktop grid now reveals cards in local batches (IntersectionObserver trigger) to avoid eagerly rendering the full loaded corpus at once.

## Related component dossiers

- [`card-content.md`](card-content.md)
