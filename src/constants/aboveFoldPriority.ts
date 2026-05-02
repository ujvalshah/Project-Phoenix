/**
 * Above-the-fold feed tuning for LCP (Core Web Vitals).
 * First N tiles skip entrance opacity animation and use eager + high fetch priority for thumbnails.
 * Ceiling stays modest to avoid `fetchpriority=high` contention on wide multi-column desktops.
 */
export const PRIORITY_THUMBNAIL_CAP = 8;

/** How many feed tiles (flat index) get LCP-oriented treatment for the current column layout. */
export function getPriorityThumbnailCount(columnCount: number): number {
  const cols = Math.max(1, columnCount);
  /** One full row plus one slack tile (round-robin / tallest LCP); tighter than cols×2. */
  const oneRowPlusSlack = cols + 1;
  return Math.min(oneRowPlusSlack, PRIORITY_THUMBNAIL_CAP);
}
