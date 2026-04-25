import { Collection } from '@/types';

type CollectionQuery = {
  type?: 'public' | 'private';
  page: number;
  limit: number;
  includeCount: true;
  includeEntries?: boolean;
  summary?: boolean;
  sortField?: 'created' | 'updated' | 'followers' | 'nuggets' | 'name';
  sortDirection?: 'asc' | 'desc';
  searchQuery?: string;
};

type CollectionResult = Collection[] | { data: Collection[]; count?: number };

type FetchCollections = (query: CollectionQuery) => Promise<CollectionResult>;

export async function fetchAllCollectionsPaged(
  fetchCollections: FetchCollections,
  options: {
    type?: 'public' | 'private';
    limit?: number;
    includeEntries?: boolean;
    summary?: boolean;
    sortField?: 'created' | 'updated' | 'followers' | 'nuggets' | 'name';
    sortDirection?: 'asc' | 'desc';
    searchQuery?: string;
  }
): Promise<Collection[]> {
  const limit = Math.max(1, options.limit ?? 100);
  const collected: Collection[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (collected.length < total) {
    const result = await fetchCollections({
      type: options.type,
      page,
      limit,
      includeCount: true,
      includeEntries: options.includeEntries,
      summary: options.summary,
      sortField: options.sortField,
      sortDirection: options.sortDirection,
      searchQuery: options.searchQuery,
    });

    const data = Array.isArray(result) ? result : result.data ?? [];
    const countFromApi = Array.isArray(result) ? data.length : result.count;
    total = typeof countFromApi === 'number' ? countFromApi : data.length;

    collected.push(...data);

    if (data.length === 0 || data.length < limit || collected.length >= total) {
      break;
    }
    page += 1;
  }

  return collected;
}
