/**
 * Tag Normalization Utilities
 * 
 * Provides case-insensitive tag comparison to ensure consistent behavior
 * across create/edit modals regardless of rawName casing differences.
 * 
 * Background:
 * - Backend stores tags with canonicalName (lowercase) for uniqueness
 * - Frontend receives rawName (user-entered casing) for display
 * - Articles store tag names as plain strings (rawName values)
 * - Admin can rename tags, changing rawName but not canonicalName
 * - Result: Edit modal must compare tags case-insensitively
 */

/**
 * Normalizes a tag string to canonical form (lowercase, trimmed)
 * 
 * @example
 * normalizeTag("  AI  ") → "ai"
 * normalizeTag("PE/VC") → "pe/vc"
 * normalizeTag("Machine Learning") → "machine learning"
 */
export const normalizeTag = (tag: string): string => {
  return tag.trim().toLowerCase();
};

/**
 * Checks if two tags are equivalent (case-insensitive comparison)
 * 
 * @example
 * tagsMatch("AI", "ai") → true
 * tagsMatch("PE/VC", "pe/vc") → true
 * tagsMatch("AI", "Blockchain") → false
 */
export const tagsMatch = (tag1: string, tag2: string): boolean => {
  return normalizeTag(tag1) === normalizeTag(tag2);
};

/**
 * Finds the index of a tag in an array (case-insensitive)
 * Returns -1 if not found
 * 
 * @example
 * findTagIndex(["AI", "Blockchain"], "ai") → 0
 * findTagIndex(["AI", "Blockchain"], "blockchain") → 1
 * findTagIndex(["AI", "Blockchain"], "Reports") → -1
 */
export const findTagIndex = (tags: string[], searchTag: string): number => {
  const normalized = normalizeTag(searchTag);
  return tags.findIndex(tag => normalizeTag(tag) === normalized);
};

/**
 * Checks if a tag array includes a tag (case-insensitive)
 * 
 * @example
 * tagsInclude(["AI", "Blockchain"], "ai") → true
 * tagsInclude(["AI", "Blockchain"], "reports") → false
 */
export const tagsInclude = (tags: string[], searchTag: string): boolean => {
  return findTagIndex(tags, searchTag) !== -1;
};

/**
 * Removes a tag from an array (case-insensitive)
 * Returns new array without the tag
 * 
 * @example
 * removeTag(["AI", "Blockchain"], "ai") → ["Blockchain"]
 * removeTag(["AI", "Blockchain"], "reports") → ["AI", "Blockchain"]
 */
export const removeTag = (tags: string[], tagToRemove: string): string[] => {
  const normalized = normalizeTag(tagToRemove);
  return tags.filter(tag => normalizeTag(tag) !== normalized);
};

/**
 * Finds a tag in an array and returns its actual value (case-insensitive search)
 * Useful for preserving original casing when updating
 * 
 * @example
 * findTag(["AI", "Blockchain"], "ai") → "AI"
 * findTag(["AI", "Blockchain"], "reports") → undefined
 */
export const findTag = (tags: string[], searchTag: string): string | undefined => {
  const index = findTagIndex(tags, searchTag);
  return index !== -1 ? tags[index] : undefined;
};

/**
 * Deduplicates tags array (case-insensitive, keeps first occurrence)
 * 
 * @example
 * deduplicateTags(["AI", "ai", "Blockchain", "AI"]) → ["AI", "Blockchain"]
 */
export const deduplicateTags = (tags: string[]): string[] => {
  const seen = new Set<string>();
  return tags.filter(tag => {
    const normalized = normalizeTag(tag);
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
};



