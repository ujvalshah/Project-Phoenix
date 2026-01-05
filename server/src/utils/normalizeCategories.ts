/**
 * Shared Category Normalization Utility (Backend)
 * 
 * Single source of truth for category normalization rules:
 * - Remove whitespace-only categories
 * - Deduplicate categories (case-insensitive)
 * - Filter out invalid entries (null, undefined, empty strings)
 * 
 * Rules:
 * - categories[] optional, but when present:
 *   - must be non-empty strings
 *   - must resolve to categoryIds on backend
 * 
 * This matches the frontend normalization rules in:
 * src/shared/articleNormalization/normalizeCategories.ts
 */

/**
 * Normalize categories array:
 * 1. Filter out invalid entries (null, undefined, empty strings, whitespace-only)
 * 2. Deduplicate (case-insensitive)
 * 3. Return array of valid, unique categories
 */
export function normalizeCategories(categories: (string | null | undefined)[]): string[] {
  if (!Array.isArray(categories)) {
    return [];
  }

  // Step 1: Filter out invalid entries and whitespace-only categories
  const validCategories = categories.filter((cat): cat is string => 
    typeof cat === 'string' && cat.trim().length > 0
  );

  // Step 2: Deduplicate (case-insensitive)
  const categoryMap = new Map<string, string>();
  for (const category of validCategories) {
    const normalized = category.toLowerCase().trim();
    if (!categoryMap.has(normalized)) {
      // Keep original casing of first occurrence
      categoryMap.set(normalized, category.trim());
    }
  }

  return Array.from(categoryMap.values());
}

