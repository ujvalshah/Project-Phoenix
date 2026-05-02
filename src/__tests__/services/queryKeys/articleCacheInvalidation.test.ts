import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateArticleListCaches, patchArticleAcrossCaches } from '@/services/queryKeys/articleKeys';
import {
  feedKeys,
  FEED_COLLECTION_ENTRIES_PAGE_SIZE,
  FEED_COLLECTION_ENTRIES_SORT_LATEST,
} from '@/services/queryKeys/feedKeys';
import { FEED_COLLECTION_ENTRIES_INFINITE_PREFIX } from '@/services/queryKeys/feedPrefixes';
import type { Article } from '@/types';

describe('invalidateArticleListCaches convergence (TASK-005)', () => {
  it('share one canonical prefix tuple with feedKeys for collection-entry infinite caches', () => {
    expect(FEED_COLLECTION_ENTRIES_INFINITE_PREFIX).toEqual(feedKeys.collectionEntriesInfiniteAllPrefix);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('invalidates stream infinite, feed collection-entry prefix, collection detail shells, masonry, myspace, and list caches', async () => {
    const qc = new QueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);
    await invalidateArticleListCaches(qc);

    const prefixTriples = invalidateSpy.mock.calls.map(([{ queryKey }]) =>
      Array.isArray(queryKey) ? queryKey.slice(0, 6) : [],
    );

    expect(prefixTriples.some((p) => p[0] === 'articles' && p[1] === 'list')).toBe(true);
    expect(prefixTriples.some((p) => p[0] === 'articles' && p[1] === 'infinite')).toBe(true);
    expect(
      prefixTriples.some((p) => p[0] === 'feed' && p[1] === 'collection-entries' && p[2] === 'infinite'),
    ).toBe(true);
    expect(
      prefixTriples.some((p) => p[0] === 'collections' && p[1] === 'detail'),
    ).toBe(true);
    expect(prefixTriples.some((p) => p[0] === 'articles' && p[1] === 'myspace')).toBe(true);
    expect(prefixTriples.some((p) => p[0] === 'articles' && p[1] === 'masonry')).toBe(true);
  });

  it('mutation path: optimistic patch updates an article nested under feed collection-entries infinite cache', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { staleTime: 0, retry: false } },
    });

    const key = feedKeys.collectionEntriesInfinite({
      collectionId: 'cid-test',
      limit: FEED_COLLECTION_ENTRIES_PAGE_SIZE,
      sort: FEED_COLLECTION_ENTRIES_SORT_LATEST,
    });

    const baseArticle: Article = {
      id: 'n1',
      title: 'Before',
      excerpt: '',
      content: '',
      author: { id: 'u', name: '' },
      tags: [],
      publishedAt: new Date().toISOString(),
      readTime: 1,
    };

    qc.setQueryData(key, {
      pages: [{ data: [baseArticle], total: 1, page: 1, limit: FEED_COLLECTION_ENTRIES_PAGE_SIZE, hasMore: false }],
      pageParams: [1],
    });

    patchArticleAcrossCaches(qc, baseArticle.id, () => ({
      ...baseArticle,
      title: 'After',
    }));

    const data = qc.getQueryData(key) as {
      pages: { data: Article[] }[];
    };
    expect(data.pages[0].data[0].title).toBe('After');
  });
});
