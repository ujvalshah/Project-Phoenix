/**
 * Helpers for homepage grid virtualization (row = one horizontal band of N cards).
 */

const GRID_GAP_PX = 24; // matches gap-6

/**
 * Coalesce `virtualizer.measure()` when container width flickers (e.g. desktop filter
 * column reflow). Keep modest to limit layout thrash.
 */
export const HOME_GRID_VIRTUAL_MEASURE_DEBOUNCE_MS = 120;

/**
 * Recompute window `scrollMargin` after layout settles. Desktop filter aside uses a
 * 220ms CSS transition on inner panel motion; finishing slightly after avoids stale
 * anchor geometry when width-driven reflow completes.
 */
export const HOME_GRID_SCROLL_MARGIN_DEBOUNCE_MS = 260;

/**
 * TanStack Virtual `overscan` in **rows** (not cells). Larger values smooth fast scroll /
 * compound layouts on long feeds (~100+) at modest memory cost (TASK-020).
 */
export const HOME_FEED_WINDOW_VIRTUAL_OVERSCAN_ROWS = 5;

/** IntersectionObserver `rootMargin` for infinite scroll — prefetch before sentinel enters view. */
export const HOME_FEED_INFINITE_SCROLL_ROOT_MARGIN_PX = 520;

/** Split flat items into rows of `columnCount` cells (last row may be shorter). */
export function chunkIntoGridRows<T>(items: T[], columnCount: number): T[][] {
  if (columnCount < 1) return [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columnCount) {
    rows.push(items.slice(i, i + columnCount));
  }
  return rows;
}

/**
 * Rough row height for a NewsCard tile: 16:9 media (see CardMedia defaults) + text/meta block.
 */
export function estimateHomeGridRowHeightPx(containerInnerWidth: number, columnCount: number): number {
  const cols = Math.max(1, columnCount);
  const totalGaps = GRID_GAP_PX * (cols - 1);
  const cellWidth = Math.max(120, (containerInnerWidth - totalGaps) / cols);
  const imageHeight = cellWidth * (9 / 16);
  // Hybrid grid cards: tags + title + truncated body (max ~180px) + footer/meta +
  // padding. Conservative vs old 140px to reduce estimate→measure gap and row overlap.
  const textBlock = 235;
  return Math.round(imageHeight + textBlock);
}

export function gridRowGapPx(): number {
  return GRID_GAP_PX;
}

/** Row index in chunked rows for a flat article index. */
export function flatIndexToRowIndex(flatIndex: number, columnCount: number): number {
  if (columnCount < 1) return 0;
  return Math.floor(flatIndex / columnCount);
}
