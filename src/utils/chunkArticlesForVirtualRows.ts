/**
 * Split a flat article list into rows for window virtualization.
 * Column count must match the responsive grid (feed = 1 column per row).
 */
export function chunkArticlesForVirtualRows<T>(items: T[], columnCount: number): T[][] {
  if (items.length === 0) return [];
  if (columnCount <= 1) {
    return items.map((item) => [item]);
  }
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columnCount) {
    rows.push(items.slice(i, i + columnCount));
  }
  return rows;
}
