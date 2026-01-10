/**
 * Shared Tag Normalization Utility (Backend)
 * 
 * Single source of truth for tag normalization rules:
 * - Remove whitespace-only tags
 * - Deduplicate tags (case-insensitive)
 * - Filter out invalid entries (null, undefined, empty strings)
 * 
 * Rules:
 * - tags[] MUST NOT be empty for both CREATE and EDIT
 * - All tags must be non-empty strings
 * 
 * This matches the frontend normalization rules in:
 * src/shared/articleNormalization/normalizeTags.ts
 */

/**
 * Normalize tags array:
 * 1. Filter out invalid entries (null, undefined, empty strings, whitespace-only)
 * 2. Deduplicate (case-insensitive)
 * 3. Return array of valid, unique tags
 */
export function normalizeTags(tags: (string | null | undefined)[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  // Step 1: Filter out invalid entries and whitespace-only tags
  const validTags = tags.filter((tag): tag is string => 
    typeof tag === 'string' && tag.trim().length > 0
  );

  // Step 2: Deduplicate (case-insensitive)
  const tagMap = new Map<string, string>();
  for (const tag of validTags) {
    const normalized = tag.toLowerCase().trim();
    if (!tagMap.has(normalized)) {
      // Keep original casing of first occurrence
      tagMap.set(normalized, tag.trim());
    }
  }

  return Array.from(tagMap.values());
}

/**
 * Validate that tags array is not empty after normalization
 * Returns true if tags are valid (non-empty), false otherwise
 */
export function validateTagsNotEmpty(tags: (string | null | undefined)[]): boolean {
  const normalized = normalizeTags(tags);
  return normalized.length > 0;
}



