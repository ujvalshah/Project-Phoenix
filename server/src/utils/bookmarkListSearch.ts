/**
 * Pure helpers for GET /api/bookmarks text search (filter before pagination).
 */

export function buildItemIdsMatchingBookmarkQuery(
  articles: Array<{
    _id: { toString: () => string };
    title?: string;
    content?: string;
    excerpt?: string;
  }>,
  searchTrimmed: string
): Set<string> {
  const searchLower = searchTrimmed.toLowerCase();
  const matchingItemIds = new Set<string>();
  for (const a of articles) {
    const id = a._id.toString();
    const title = (a.title ?? '').toLowerCase();
    const content = (a.content ?? '').toLowerCase();
    const excerpt = (a.excerpt ?? '').toLowerCase();
    if (
      title.includes(searchLower) ||
      content.includes(searchLower) ||
      excerpt.includes(searchLower)
    ) {
      matchingItemIds.add(id);
    }
  }
  return matchingItemIds;
}

export function paginateInMemory<T>(
  items: T[],
  page: number,
  limit: number
): { pageItems: T[]; total: number; hasMore: boolean } {
  const skip = (page - 1) * limit;
  const total = items.length;
  const pageItems = items.slice(skip, skip + limit);
  const hasMore = skip + pageItems.length < total;
  return { pageItems, total, hasMore };
}
