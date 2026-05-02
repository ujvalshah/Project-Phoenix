/**
 * Window virtualization helpers for workspace library (MySpace grid/list).
 * Grid bands mirror `gap-3` + `aspect-video` thumbnails on {@link NuggetGridCard}.
 */

export { chunkIntoGridRows } from '@/utils/homeGridVirtualization';

const WORKSPACE_GRID_GAP_PX = 12; // Tailwind gap-3

/** Align with MySpace grid: `md:grid-cols-2`, `xl:grid-cols-3`. */
export function workspaceGridColumnCount(containerWidthPx: number): number {
  if (containerWidthPx >= 1280) return 3;
  if (containerWidthPx >= 768) return 2;
  return 1;
}

export function estimateWorkspaceGridRowHeightPx(
  containerInnerWidth: number,
  columnCount: number,
): number {
  const cols = Math.max(1, columnCount);
  const totalGaps = WORKSPACE_GRID_GAP_PX * (cols - 1);
  const cellWidth = Math.max(120, (containerInnerWidth - totalGaps) / cols);
  const imageHeight = cellWidth * (9 / 16);
  const textBlock = 120;
  return Math.round(imageHeight + textBlock);
}

export function workspaceGridRowGapPx(): number {
  return WORKSPACE_GRID_GAP_PX;
}

/** List band: ~fixed row height target (TASK-031) + `gap-2.5` spacing. */
export const WORKSPACE_LIST_VIRTUAL_ROW_ESTIMATE_PX = 100;
const WORKSPACE_LIST_GAP_PX = 10; // gap-2.5

export function estimateWorkspaceListBandHeightPx(compact: boolean): number {
  return WORKSPACE_LIST_VIRTUAL_ROW_ESTIMATE_PX + WORKSPACE_LIST_GAP_PX + (compact ? 0 : 8);
}

export function workspaceListRowGapPx(): number {
  return WORKSPACE_LIST_GAP_PX;
}

/** Avoid virtualizer setup for short libraries. */
export const WORKSPACE_LIBRARY_VIRTUAL_MIN_ITEMS = 21;
