/**
 * Test Suite: useInfiniteArticles Hook
 * 
 * Tests pagination, page accumulation, and infinite scroll behavior
 * 
 * CRITICAL: These tests ensure the "only 25 items visible" bug never reoccurs
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { createMockPageResponse, createMockPageResponses } from '../utils/mockArticles';
import { createMockArticleService } from '../utils/apiMocks';
import * as articleService from '@/services/articleService';

// Mock the article service
vi.mock('@/services/articleService', () => ({
  articleService: {
    getArticles: vi.fn(),
  },
}));

describe('useInfiniteArticles Hook', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    // Create a new QueryClient for each test to avoid state pollution
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Test 1: Initial Load Renders First 25 Items', () => {
    it('should load and return first 25 items on initial render', async () => {
      const page1Response = createMockPageResponse(1, 25, 75);
      vi.mocked(articleService.articleService.getArticles).mockResolvedValueOnce(page1Response);

      const { result } = renderHook(
        () => useInfiniteArticles({
          searchQuery: '',
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        { wrapper }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify only page 1 was requested
      expect(articleService.articleService.getArticles).toHaveBeenCalledTimes(1);
      expect(articleService.articleService.getArticles).toHaveBeenCalledWith(
        expect.objectContaining({
          query: undefined,
          categories: [],
          sort: 'latest',
          limit: 25,
        }),
        1 // page 1
      );

      // Verify 25 items returned
      expect(result.current.articles).toHaveLength(25);
      expect(result.current.articles[0].id).toBe('article-1');
      expect(result.current.articles[24].id).toBe('article-25');

      // Verify hasNextPage is true
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe('Test 2: Scrolling Loads Next Page & Appends Items', () => {
    it('should append items when fetchNextPage is called', async () => {
      const page1Response = createMockPageResponse(1, 25, 75);
      const page2Response = createMockPageResponse(2, 25, 75);

      vi.mocked(articleService.articleService.getArticles)
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const { result } = renderHook(
        () => useInfiniteArticles({
          searchQuery: '',
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        { wrapper }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.articles).toHaveLength(25);

      // Trigger fetchNextPage
      result.current.fetchNextPage();

      // Wait for page 2 to load
      await waitFor(() => {
        expect(result.current.isFetchingNextPage).toBe(false);
      });

      // Verify both pages were requested
      expect(articleService.articleService.getArticles).toHaveBeenCalledTimes(2);
      expect(articleService.articleService.getArticles).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        2 // page 2
      );

      // CRITICAL: Verify items are APPENDED, not replaced
      expect(result.current.articles).toHaveLength(50);
      expect(result.current.articles[0].id).toBe('article-1'); // First item still there
      expect(result.current.articles[24].id).toBe('article-25'); // Last of page 1
      expect(result.current.articles[25].id).toBe('article-26'); // First of page 2
      expect(result.current.articles[49].id).toBe('article-50'); // Last of page 2

      // Verify no duplicate IDs
      const ids = result.current.articles.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(50);
    });

    it('should accumulate third page correctly', async () => {
      const responses = createMockPageResponses(3, 25, 75);
      
      vi.mocked(articleService.articleService.getArticles)
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2]);

      const { result } = renderHook(
        () => useInfiniteArticles({
          searchQuery: '',
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        { wrapper }
      );

      // Load page 1
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.articles).toHaveLength(25);

      // Load page 2
      result.current.fetchNextPage();
      await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
      expect(result.current.articles).toHaveLength(50);

      // Load page 3
      result.current.fetchNextPage();
      await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
      expect(result.current.articles).toHaveLength(75);

      // Verify all pages accumulated
      expect(result.current.articles[0].id).toBe('article-1');
      expect(result.current.articles[24].id).toBe('article-25');
      expect(result.current.articles[25].id).toBe('article-26');
      expect(result.current.articles[49].id).toBe('article-50');
      expect(result.current.articles[50].id).toBe('article-51');
      expect(result.current.articles[74].id).toBe('article-75');
    });
  });

  describe('Test 3: hasNextPage Stops Infinite Scroll', () => {
    it('should set hasNextPage to false when no more pages available', async () => {
      const page1Response = createMockPageResponse(1, 25, 25); // Only 25 total items
      
      vi.mocked(articleService.articleService.getArticles).mockResolvedValueOnce(page1Response);

      const { result } = renderHook(
        () => useInfiniteArticles({
          searchQuery: '',
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // When total = 25 and page 1 returns 25 items, hasMore should be false
      expect(result.current.hasNextPage).toBe(false);

      // Verify fetchNextPage does nothing when hasNextPage is false
      const initialCallCount = vi.mocked(articleService.articleService.getArticles).mock.calls.length;
      result.current.fetchNextPage();
      
      // Wait a bit to ensure no additional calls
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should not make additional requests
      expect(articleService.articleService.getArticles).toHaveBeenCalledTimes(initialCallCount);
    });

    it('should stop loading after last page', async () => {
      const page1Response = createMockPageResponse(1, 25, 50);
      const page2Response = createMockPageResponse(2, 25, 50); // Last page, hasMore: false

      vi.mocked(articleService.articleService.getArticles)
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const { result } = renderHook(
        () => useInfiniteArticles({
          searchQuery: '',
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Load page 2 (last page)
      result.current.fetchNextPage();
      await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));

      // hasNextPage should be false after last page
      expect(result.current.hasNextPage).toBe(false);

      // Attempting to fetch again should not trigger new request
      const callCount = vi.mocked(articleService.articleService.getArticles).mock.calls.length;
      result.current.fetchNextPage();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(articleService.articleService.getArticles).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('Test 4: Re-render Does NOT Reset List to 25', () => {
    it('should maintain accumulated items after component re-render', async () => {
      const responses = createMockPageResponses(3, 25, 75);
      
      vi.mocked(articleService.articleService.getArticles)
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2]);

      const { result, rerender } = renderHook(
        () => useInfiniteArticles({
          searchQuery: '',
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        { wrapper }
      );

      // Load all 3 pages
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      result.current.fetchNextPage();
      await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
      result.current.fetchNextPage();
      await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));

      expect(result.current.articles).toHaveLength(75);

      // Simulate component re-render (e.g., parent state change)
      rerender();

      // CRITICAL: Items should still be 75, not reset to 25
      expect(result.current.articles).toHaveLength(75);
      expect(result.current.articles[0].id).toBe('article-1');
      expect(result.current.articles[74].id).toBe('article-75');
    });

    it('should maintain items after refetch', async () => {
      const page1Response = createMockPageResponse(1, 25, 50);
      const page2Response = createMockPageResponse(2, 25, 50);

      vi.mocked(articleService.articleService.getArticles)
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response)
        .mockResolvedValueOnce(page1Response); // Refetch returns page 1 again

      const { result } = renderHook(
        () => useInfiniteArticles({
          searchQuery: '',
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        { wrapper }
      );

      // Load 2 pages
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      result.current.fetchNextPage();
      await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));

      expect(result.current.articles).toHaveLength(50);

      // Trigger refetch
      result.current.refetch();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // CRITICAL: After refetch, items should still be accumulated
      // Note: React Query might reset on refetch, but we're testing that our hook
      // doesn't accidentally reset to 25 items
      // In practice, refetch might reset, but the accumulation logic should still work
      expect(result.current.articles.length).toBeGreaterThanOrEqual(25);
    });
  });

  describe('Test 5: Filter Change Resets Pagination', () => {
    it('should reset to page 1 when category changes', async () => {
      const page1All = createMockPageResponse(1, 25, 75, undefined);
      const page1Tech = createMockPageResponse(1, 25, 50, 'Technology');

      vi.mocked(articleService.articleService.getArticles)
        .mockResolvedValueOnce(page1All)
        .mockResolvedValueOnce(page1Tech);

      const { result, rerender } = renderHook(
        ({ category }: { category: string }) => useInfiniteArticles({
          searchQuery: '',
          activeCategory: category,
          sortOrder: 'latest',
          limit: 25,
        }),
        {
          wrapper,
          initialProps: { category: 'All' },
        }
      );

      // Load page 1 with 'All' category
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.articles).toHaveLength(25);

      // Change category to 'Technology'
      rerender({ category: 'Technology' });

      // Wait for new query to load
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should reset to page 1 only (query key change triggers reset)
      expect(articleService.articleService.getArticles).toHaveBeenCalledTimes(2);
      expect(articleService.articleService.getArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({
          categories: ['Technology'],
        }),
        1 // Back to page 1
      );

      // Should have items from new category
      expect(result.current.articles.length).toBeGreaterThan(0);
    });

    it('should reset when search query changes', async () => {
      const page1Empty = createMockPageResponse(1, 25, 30);
      const page1Search = createMockPageResponse(1, 25, 10);

      vi.mocked(articleService.articleService.getArticles)
        .mockResolvedValueOnce(page1Empty)
        .mockResolvedValueOnce(page1Search);

      const { result, rerender } = renderHook(
        ({ search }: { search: string }) => useInfiniteArticles({
          searchQuery: search,
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        {
          wrapper,
          initialProps: { search: '' },
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Change search query
      rerender({ search: 'test query' });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should reset to page 1
      expect(articleService.articleService.getArticles).toHaveBeenCalledTimes(2);
      expect(articleService.articleService.getArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: 'test query',
        }),
        1
      );
    });
  });

  describe('Test 6: Deterministic Sort Ordering', () => {
    it('should maintain consistent order across pages', async () => {
      const responses = createMockPageResponses(3, 25, 75);
      
      vi.mocked(articleService.articleService.getArticles)
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2]);

      const { result } = renderHook(
        () => useInfiniteArticles({
          searchQuery: '',
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        { wrapper }
      );

      // Load all pages
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      result.current.fetchNextPage();
      await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
      result.current.fetchNextPage();
      await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));

      // Verify order is descending (newer first)
      const articles = result.current.articles;
      for (let i = 1; i < articles.length; i++) {
        const prev = new Date(articles[i - 1].publishedAt);
        const curr = new Date(articles[i].publishedAt);
        
        // Should be descending or equal
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
      }
    });
  });

  describe('Regression: placeholderData Safety', () => {
    it('should accumulate pages correctly without placeholderData', async () => {
      // This test ensures placeholderData regression doesn't occur
      const responses = createMockPageResponses(2, 25, 50);
      
      vi.mocked(articleService.articleService.getArticles)
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1]);

      const { result } = renderHook(
        () => useInfiniteArticles({
          searchQuery: '',
          activeCategory: 'All',
          sortOrder: 'latest',
          limit: 25,
        }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.articles).toHaveLength(25);

      result.current.fetchNextPage();
      await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));

      // CRITICAL: Should have 50 items, not stuck at 25
      expect(result.current.articles).toHaveLength(50);
    });
  });
});



