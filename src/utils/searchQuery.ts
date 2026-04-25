export const MIN_TYPEAHEAD_SEARCH_LENGTH = 2;
export const MIN_RELEVANCE_SEARCH_LENGTH = 3;

/**
 * Canonical query normalization used by both suggestion and committed search.
 * - trims leading/trailing whitespace
 * - collapses internal whitespace runs to a single space
 */
export function normalizeSearchQuery(query: string | null | undefined): string {
  if (typeof query !== 'string') return '';
  return query.trim().replace(/\s+/g, ' ');
}
