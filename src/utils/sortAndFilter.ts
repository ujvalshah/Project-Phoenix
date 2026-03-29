/**
 * Pure, generic sort & filter utilities.
 *
 * Extracted from page-level inline logic so that:
 * 1. AdminCollectionsPage and CollectionsPage share the same code
 * 2. Every function is testable in isolation (no React dependency)
 */

// ---------------------------------------------------------------------------
// Generic comparator
// ---------------------------------------------------------------------------

export type SortDirection = 'asc' | 'desc';

/**
 * Compare two values for sorting. Handles strings (case-insensitive),
 * numbers, dates (ISO strings or Date objects), booleans, and nullish values.
 *
 * Nullish values always sort last regardless of direction.
 */
export function compareValues(
  a: unknown,
  b: unknown,
  direction: SortDirection = 'asc',
): number {
  // Nullish values sort last
  const aNull = a == null || a === '';
  const bNull = b == null || b === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  let result: number;

  if (typeof a === 'string' && typeof b === 'string') {
    result = a.localeCompare(b, undefined, { sensitivity: 'base' });
  } else if (typeof a === 'number' && typeof b === 'number') {
    result = a - b;
  } else if (typeof a === 'boolean' && typeof b === 'boolean') {
    result = Number(a) - Number(b);
  } else {
    // Fallback: coerce to string
    result = String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
  }

  return direction === 'desc' ? -result : result;
}

// ---------------------------------------------------------------------------
// Generic sortBy — works with any object type
// ---------------------------------------------------------------------------

export interface SortConfig<K extends string = string> {
  key: K;
  direction: SortDirection;
}

/**
 * Sort an array by one or more keys. Returns a new array (non-mutating).
 *
 * `valueExtractor` maps a sort key to the comparable value for a given item.
 * This keeps the sort logic decoupled from object shape.
 *
 * @example
 * ```ts
 * sortBy(collections, [{ key: 'createdAt', direction: 'desc' }], (item, key) => {
 *   if (key === 'createdAt') return new Date(item.createdAt).getTime();
 *   if (key === 'creator') return item.creator?.name?.toLowerCase() ?? '';
 *   return item[key];
 * });
 * ```
 */
export function sortBy<T, K extends string = string>(
  items: readonly T[],
  sorts: ReadonlyArray<SortConfig<K>>,
  valueExtractor: (item: T, key: K) => unknown,
): T[] {
  if (sorts.length === 0) return [...items];

  return [...items].sort((a, b) => {
    for (const { key, direction } of sorts) {
      const valA = valueExtractor(a, key);
      const valB = valueExtractor(b, key);
      const cmp = compareValues(valA, valB, direction);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Date filter helper
// ---------------------------------------------------------------------------

/**
 * Filter items to those matching a specific calendar date.
 * Compares only the date portion (ignores time).
 */
export function filterByDate<T>(
  items: readonly T[],
  dateStr: string,
  dateExtractor: (item: T) => string | Date,
): T[] {
  if (!dateStr) return [...items];
  const targetDate = new Date(dateStr).toDateString();
  return items.filter((item) => {
    const itemDate = dateExtractor(item);
    return new Date(itemDate).toDateString() === targetDate;
  });
}

// ---------------------------------------------------------------------------
// Text search filter
// ---------------------------------------------------------------------------

/**
 * Case-insensitive search across multiple fields of an item.
 */
export function filterByText<T>(
  items: readonly T[],
  query: string,
  fieldExtractors: Array<(item: T) => string | undefined>,
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...items];

  return items.filter((item) =>
    fieldExtractors.some((extract) => {
      const value = extract(item);
      return value != null && value.toLowerCase().includes(trimmed);
    }),
  );
}
