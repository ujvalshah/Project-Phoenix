/**
 * Array normalization utilities for defensive coding
 * Safely handles null, undefined, and non-array values
 */

/**
 * Safely converts a value to an array
 * Returns empty array if value is null, undefined, or not an array
 * 
 * @param v - Value that may be an array, null, or undefined
 * @returns Array (empty if input was null/undefined/non-array)
 * 
 * @example
 * const media = asArray(req.body.media); // [] if media is null/undefined
 * const tags = asArray(data.tags); // [] if tags is null/undefined
 */
export function asArray<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Safely gets the length of an array-like value
 * Returns 0 if value is null, undefined, or not an array
 * 
 * @param v - Value that may be an array, null, or undefined
 * @returns Length of array, or 0 if not an array
 */
export function arrayLength<T>(v: T[] | null | undefined): number {
  return Array.isArray(v) ? v.length : 0;
}

/**
 * Safely checks if an array-like value has items
 * Returns false if value is null, undefined, or not an array
 * 
 * @param v - Value that may be an array, null, or undefined
 * @returns true if array has items, false otherwise
 */
export function hasArrayItems<T>(v: T[] | null | undefined): boolean {
  return Array.isArray(v) && v.length > 0;
}

