/**
 * Helpers for homepage grid virtualization (row = one horizontal band of N cards).
 */

const GRID_GAP_PX = 24; // matches gap-6

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
 * Rough row height for a NewsCard tile: 4:3 media + text/meta block.
 * Matches the spirit of {@link estimateCardHeight} in FeedContainer (image + ~132px chrome).
 */
export function estimateHomeGridRowHeightPx(containerInnerWidth: number, columnCount: number): number {
  const cols = Math.max(1, columnCount);
  const totalGaps = GRID_GAP_PX * (cols - 1);
  const cellWidth = Math.max(120, (containerInnerWidth - totalGaps) / cols);
  const imageHeight = cellWidth * (3 / 4);
  const textBlock = 140;
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
