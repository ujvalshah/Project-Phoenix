import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  buildCollectionEntriesInfiniteQueryOptions,
  useUnifiedInfiniteArticles,
} from '@/hooks/useUnifiedInfiniteArticles';
import { feedKeys, FEED_COLLECTION_ENTRIES_PAGE_SIZE, FEED_COLLECTION_ENTRIES_SORT_LATEST } from '@/services/queryKeys/feedKeys';
import { articleKeys } from '@/services/queryKeys/articleKeys';
import { storageService } from '@/services/storageService';
import type { PaginatedArticlesResponse } from '@/services/articleService';
import { createMockPageResponse } from '../utils/mockArticles';

vi.mock('@/services/storageService', () => ({
  storageService: {
    getCollectionArticles: vi.fn(),
  },
}));

describe('useUnifiedInfiniteArticles (TASK-004 feed engine)', () => {
  it('streams use the same key factory as legacy article infinite lists', () => {
    expect(feedKeys.streamInfinite).toBe(articleKeys.infiniteList);
  });

  it('collection-entries infinite key includes feed scope, collectionId, limit, sort', () => {
    expect(
      feedKeys.collectionEntriesInfinite({
        collectionId: 'c-x',
        limit: FEED_COLLECTION_ENTRIES_PAGE_SIZE,
        sort: FEED_COLLECTION_ENTRIES_SORT_LATEST,
      }),
    ).toEqual([
      ...feedKeys.all,
      'collection-entries',
      'infinite',
      'c-x',
      FEED_COLLECTION_ENTRIES_PAGE_SIZE,
      FEED_COLLECTION_ENTRIES_SORT_LATEST,
    ]);
  });

  describe('collection-entries scope', () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      vi.clearAllMocks();
    });

    afterEach(() => {
      queryClient.clear();
    });

    it('buildCollectionEntriesInfiniteQueryOptions matches getNextPageParam invariant', () => {
      const opts = buildCollectionEntriesInfiniteQueryOptions('c-abc');
      const last: PaginatedArticlesResponse = {
        data: [],
        total: 40,
        page: 1,
        limit: FEED_COLLECTION_ENTRIES_PAGE_SIZE,
        hasMore: true,
      };
      expect(opts.getNextPageParam(last)).toBe(2);
      expect(opts.getNextPageParam({ ...last, hasMore: false, page: 2 })).toBeUndefined();
    });

    it('does not fetch when disabled', () => {
      renderHook(
        () =>
          useUnifiedInfiniteArticles({
            scope: 'collection-entries',
            collectionId: 'c1',
            enabled: false,
          }),
        { wrapper },
      );
      expect(storageService.getCollectionArticles).not.toHaveBeenCalled();
    });

    it('loads first page with limit 30 and sort latest', async () => {
      const page1 = createMockPageResponse(1, FEED_COLLECTION_ENTRIES_PAGE_SIZE, 75);
      vi.mocked(storageService.getCollectionArticles).mockResolvedValueOnce(page1);

      const { result } = renderHook(
        () =>
          useUnifiedInfiniteArticles({
            scope: 'collection-entries',
            collectionId: 'c1',
            enabled: true,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(storageService.getCollectionArticles).toHaveBeenCalledWith('c1', {
        page: 1,
        limit: FEED_COLLECTION_ENTRIES_PAGE_SIZE,
        sort: FEED_COLLECTION_ENTRIES_SORT_LATEST,
      });
      expect(result.current.articles).toHaveLength(FEED_COLLECTION_ENTRIES_PAGE_SIZE);
      expect(result.current.hasNextPage).toBe(true);
    });

    it('fetchNextPage appends following page', async () => {
      const page1 = createMockPageResponse(1, FEED_COLLECTION_ENTRIES_PAGE_SIZE, 75);
      const page2 = createMockPageResponse(2, FEED_COLLECTION_ENTRIES_PAGE_SIZE, 75);

      vi.mocked(storageService.getCollectionArticles)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);

      const { result } = renderHook(
        () =>
          useUnifiedInfiniteArticles({
            scope: 'collection-entries',
            collectionId: 'c1',
            enabled: true,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isPending).toBe(false));
      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() =>
        expect(result.current.articles.length).toBe(FEED_COLLECTION_ENTRIES_PAGE_SIZE * 2),
      );
      expect(storageService.getCollectionArticles).toHaveBeenLastCalledWith('c1', {
        page: 2,
        limit: FEED_COLLECTION_ENTRIES_PAGE_SIZE,
        sort: FEED_COLLECTION_ENTRIES_SORT_LATEST,
      });
    });

    it('invalidateQueries on collectionEntriesInfiniteRoot refetches', async () => {
      const page1 = createMockPageResponse(1, FEED_COLLECTION_ENTRIES_PAGE_SIZE, 60);
      vi.mocked(storageService.getCollectionArticles).mockResolvedValue(page1);

      const { result } = renderHook(
        () =>
          useUnifiedInfiniteArticles({
            scope: 'collection-entries',
            collectionId: 'coll-x',
            enabled: true,
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isPending).toBe(false));
      expect(storageService.getCollectionArticles).toHaveBeenCalledTimes(1);

      vi.mocked(storageService.getCollectionArticles).mockClear();
      vi.mocked(storageService.getCollectionArticles).mockResolvedValue(page1);

      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: feedKeys.collectionEntriesInfiniteRoot('coll-x'),
        });
      });

      await waitFor(() =>
        expect(vi.mocked(storageService.getCollectionArticles).mock.calls.length).toBeGreaterThanOrEqual(
          1,
        ),
      );
    });
  });
});
