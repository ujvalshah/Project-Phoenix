import { describe, expect, it, vi } from 'vitest';
import { fetchAllCollectionsPaged } from '@/utils/collectionPicker';
import type { Collection } from '@/types';

function makeCollection(id: string): Collection {
  return {
    id,
    name: `Collection ${id}`,
    description: '',
    creatorId: 'user-1',
    type: 'public',
    entries: [],
    followersCount: 0,
    createdAt: new Date().toISOString(),
  };
}

describe('fetchAllCollectionsPaged', () => {
  it('loads collections across multiple pages (>100 total)', async () => {
    const firstPage = Array.from({ length: 100 }, (_, idx) => makeCollection(`c-${idx + 1}`));
    const secondPage = Array.from({ length: 30 }, (_, idx) => makeCollection(`c-${idx + 101}`));

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ data: firstPage, count: 130 })
      .mockResolvedValueOnce({ data: secondPage, count: 130 });

    const all = await fetchAllCollectionsPaged(fetcher, {
      type: 'public',
      limit: 100,
      sortField: 'name',
      sortDirection: 'asc',
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(all).toHaveLength(130);
    expect(all.at(-1)?.id).toBe('c-130');
  });

  it('passes search query and keeps paginating while pages are full', async () => {
    const page1 = Array.from({ length: 100 }, (_, idx) => makeCollection(`c-${idx + 1}`));
    const page2 = [makeCollection('target-collection')];

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, count: 101 })
      .mockResolvedValueOnce({ data: page2, count: 101 });

    const all = await fetchAllCollectionsPaged(fetcher, {
      type: 'public',
      limit: 100,
      searchQuery: 'target',
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 1, searchQuery: 'target' })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, searchQuery: 'target' })
    );
    expect(all.some((collection) => collection.id === 'target-collection')).toBe(true);
  });
});
