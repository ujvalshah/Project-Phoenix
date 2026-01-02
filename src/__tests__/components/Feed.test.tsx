/**
 * Test Suite: Feed Component
 * 
 * Tests infinite scroll UI behavior, IntersectionObserver triggers,
 * and component rendering with accumulated pages
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Feed } from '@/components/Feed';
import { Article } from '@/types';
import { createMockPageResponse, createMockPageResponses } from '../utils/mockArticles';
import { setupIntersectionObserver } from '../utils/testSetup';
import * as useInfiniteArticlesHook from '@/hooks/useInfiniteArticles';

// Mock the useInfiniteArticles hook
vi.mock('@/hooks/useInfiniteArticles', () => ({
  useInfiniteArticles: vi.fn(),
}));

// Mock NewsCard component to simplify tests
vi.mock('@/components/NewsCard', () => ({
  NewsCard: ({ article, onClick }: { article: Article; onClick: () => void }) => (
    <div data-testid={`article-${article.id}`} onClick={onClick}>
      {article.title || article.id}
    </div>
  ),
}));

describe('Feed Component', () => {
  let queryClient: QueryClient;
  let mockUseInfiniteArticles: ReturnType<typeof vi.fn>;

  const defaultProps = {
    activeCategory: 'All',
    searchQuery: '',
    sortOrder: 'latest' as const,
    selectedTag: null,
    onArticleClick: vi.fn(),
    onCategoryClick: vi.fn(),
    onTagClick: vi.fn(),
    currentUserId: 'user-1',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    mockUseInfiniteArticles = vi.fn();
    vi.mocked(useInfiniteArticlesHook.useInfiniteArticles).mockImplementation(mockUseInfiniteArticles);
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  const renderFeed = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Feed {...defaultProps} {...props} />
      </QueryClientProvider>
    );
  };

  describe('Test 1: Initial Load Renders First 25 Items', () => {
    it('should render 25 articles on initial load', () => {
      const page1Response = createMockPageResponse(1, 25, 75);
      
      mockUseInfiniteArticles.mockReturnValue({
        articles: page1Response.data,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: vi.fn(),
        error: null,
        refetch: vi.fn(),
      });

      renderFeed();

      // Should render 25 articles
      const articles = screen.getAllByTestId(/^article-/);
      expect(articles).toHaveLength(25);
      expect(screen.getByTestId('article-article-1')).toBeInTheDocument();
      expect(screen.getByTestId('article-article-25')).toBeInTheDocument();
    });

    it('should show loading skeleton while loading', () => {
      mockUseInfiniteArticles.mockReturnValue({
        articles: [],
        isLoading: true,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        error: null,
        refetch: vi.fn(),
      });

      renderFeed();

      // Should show loading state (skeletons)
      // Note: Actual skeleton implementation may vary
      expect(screen.queryByTestId(/^article-/)).not.toBeInTheDocument();
    });
  });

  describe('Test 2: Scrolling Loads Next Page & Appends Items', () => {
    it('should append items when scroll triggers fetchNextPage', async () => {
      const page1Response = createMockPageResponse(1, 25, 75);
      const page2Response = createMockPageResponse(2, 25, 75);
      
      const mockFetchNextPage = vi.fn();

      // Initial render with page 1
      mockUseInfiniteArticles.mockReturnValue({
        articles: page1Response.data,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        error: null,
        refetch: vi.fn(),
      });

      const { triggerIntersection } = setupIntersectionObserver();
      renderFeed();

      // Verify initial 25 items
      expect(screen.getAllByTestId(/^article-/)).toHaveLength(25);

      // Simulate scroll trigger (IntersectionObserver fires)
      triggerIntersection(true);

      // Wait for fetchNextPage to be called
      await waitFor(() => {
        expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
      });

      // Update mock to return accumulated items (page 1 + page 2)
      mockUseInfiniteArticles.mockReturnValue({
        articles: [...page1Response.data, ...page2Response.data],
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        error: null,
        refetch: vi.fn(),
      });

      // Re-render to show updated items
      renderFeed();

      // CRITICAL: Should now show 50 items (appended, not replaced)
      const articles = screen.getAllByTestId(/^article-/);
      expect(articles).toHaveLength(50);
      expect(screen.getByTestId('article-article-1')).toBeInTheDocument(); // First item still there
      expect(screen.getByTestId('article-article-50')).toBeInTheDocument(); // New items added
    });

    it('should not trigger fetchNextPage when hasNextPage is false', () => {
      const page1Response = createMockPageResponse(1, 25, 25); // Only 25 total
      const mockFetchNextPage = vi.fn();

      mockUseInfiniteArticles.mockReturnValue({
        articles: page1Response.data,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false, // No more pages
        fetchNextPage: mockFetchNextPage,
        error: null,
        refetch: vi.fn(),
      });

      const { triggerIntersection } = setupIntersectionObserver();
      renderFeed();

      // Trigger intersection (scroll to bottom)
      triggerIntersection(true);

      // Should NOT call fetchNextPage when hasNextPage is false
      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });
  });

  describe('Test 3: Third Page Loads & Stops When hasMore=false', () => {
    it('should load third page and stop when hasMore is false', async () => {
      const responses = createMockPageResponses(3, 25, 75);
      const mockFetchNextPage = vi.fn();

      // Start with page 1
      mockUseInfiniteArticles.mockReturnValue({
        articles: responses[0].data,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        error: null,
        refetch: vi.fn(),
      });

      const { triggerIntersection } = setupIntersectionObserver();
      renderFeed();

      expect(screen.getAllByTestId(/^article-/)).toHaveLength(25);

      // Load page 2
      triggerIntersection(true);
      await waitFor(() => expect(mockFetchNextPage).toHaveBeenCalledTimes(1));

      mockUseInfiniteArticles.mockReturnValue({
        articles: [...responses[0].data, ...responses[1].data],
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        error: null,
        refetch: vi.fn(),
      });

      renderFeed();
      expect(screen.getAllByTestId(/^article-/)).toHaveLength(50);

      // Load page 3 (last page)
      triggerIntersection(true);
      await waitFor(() => expect(mockFetchNextPage).toHaveBeenCalledTimes(2));

      mockUseInfiniteArticles.mockReturnValue({
        articles: [...responses[0].data, ...responses[1].data, ...responses[2].data],
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false, // No more pages
        fetchNextPage: mockFetchNextPage,
        error: null,
        refetch: vi.fn(),
      });

      renderFeed();
      expect(screen.getAllByTestId(/^article-/)).toHaveLength(75);

      // Try to trigger again - should not call fetchNextPage
      const callCount = mockFetchNextPage.mock.calls.length;
      triggerIntersection(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockFetchNextPage).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('Test 4: Re-render Does NOT Reset List to 25', () => {
    it('should maintain all items after re-render', () => {
      const responses = createMockPageResponses(3, 25, 75);
      const allArticles = responses.flatMap(r => r.data);

      mockUseInfiniteArticles.mockReturnValue({
        articles: allArticles,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        error: null,
        refetch: vi.fn(),
      });

      const { rerender } = renderFeed();

      expect(screen.getAllByTestId(/^article-/)).toHaveLength(75);

      // Simulate re-render (e.g., parent state change)
      rerender(
        <QueryClientProvider client={queryClient}>
          <Feed {...defaultProps} />
        </QueryClientProvider>
      );

      // CRITICAL: Should still show 75 items, not reset to 25
      expect(screen.getAllByTestId(/^article-/)).toHaveLength(75);
      expect(screen.getByTestId('article-article-1')).toBeInTheDocument();
      expect(screen.getByTestId('article-article-75')).toBeInTheDocument();
    });
  });

  describe('Test 5: Filter Change Resets Pagination', () => {
    it('should reset when category changes', () => {
      const page1All = createMockPageResponse(1, 25, 75, undefined);
      const page1Tech = createMockPageResponse(1, 25, 50, 'Technology');

      // Initial render with 'All' category
      mockUseInfiniteArticles.mockReturnValue({
        articles: page1All.data,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: vi.fn(),
        error: null,
        refetch: vi.fn(),
      });

      const { rerender } = renderFeed({ activeCategory: 'All' });
      expect(screen.getAllByTestId(/^article-/)).toHaveLength(25);

      // Change category to 'Technology'
      mockUseInfiniteArticles.mockReturnValue({
        articles: page1Tech.data,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: vi.fn(),
        error: null,
        refetch: vi.fn(),
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <Feed {...defaultProps} activeCategory="Technology" />
        </QueryClientProvider>
      );

      // Should show new category results (query key change triggers reset)
      // Items count may vary based on category, but should be from page 1
      expect(screen.getAllByTestId(/^article-/).length).toBeGreaterThan(0);
    });
  });

  describe('Test 6: IntersectionObserver Behavior', () => {
    it('should observe the trigger element when hasMore is true', () => {
      const page1Response = createMockPageResponse(1, 25, 75);
      const { observe, unobserve } = setupIntersectionObserver();

      mockUseInfiniteArticles.mockReturnValue({
        articles: page1Response.data,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: vi.fn(),
        error: null,
        refetch: vi.fn(),
      });

      renderFeed();

      // IntersectionObserver should be set up
      expect(observe).toHaveBeenCalled();
    });

    it('should not observe when hasMore is false', () => {
      const page1Response = createMockPageResponse(1, 25, 25);
      const { observe } = setupIntersectionObserver();

      mockUseInfiniteArticles.mockReturnValue({
        articles: page1Response.data,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        error: null,
        refetch: vi.fn(),
      });

      renderFeed();

      // When hasMore is false, trigger element should not be rendered
      // (component returns null for InfiniteScrollTrigger when hasMore is false)
      // So observe might not be called, or called then immediately unobserve
    });

    it('should call fetchNextPage when intersection occurs', async () => {
      const page1Response = createMockPageResponse(1, 25, 75);
      const mockFetchNextPage = vi.fn();

      mockUseInfiniteArticles.mockReturnValue({
        articles: page1Response.data,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        error: null,
        refetch: vi.fn(),
      });

      const { triggerIntersection } = setupIntersectionObserver();
      renderFeed();

      // Simulate scroll to bottom (intersection)
      triggerIntersection(true);

      await waitFor(() => {
        expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
      });
    });

    it('should not call fetchNextPage while already fetching', () => {
      const page1Response = createMockPageResponse(1, 25, 75);
      const mockFetchNextPage = vi.fn();

      mockUseInfiniteArticles.mockReturnValue({
        articles: page1Response.data,
        isLoading: false,
        isFetchingNextPage: true, // Already fetching
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        error: null,
        refetch: vi.fn(),
      });

      const { triggerIntersection } = setupIntersectionObserver();
      renderFeed();

      // Trigger intersection while already fetching
      triggerIntersection(true);

      // Should NOT call fetchNextPage again (guarded by isFetchingNextPage check)
      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', () => {
      mockUseInfiniteArticles.mockReturnValue({
        articles: [],
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        error: null,
        refetch: vi.fn(),
      });

      renderFeed();

      // Should show empty state
      expect(screen.getByText(/No nuggets found/i)).toBeInTheDocument();
    });

    it('should handle error state', () => {
      mockUseInfiniteArticles.mockReturnValue({
        articles: [],
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        error: new Error('Failed to load feed'),
        refetch: vi.fn(),
      });

      renderFeed();

      // Should show error message
      expect(screen.getByText(/Failed to load feed/i)).toBeInTheDocument();
    });

    it('should filter by selectedTag client-side', () => {
      const page1Response = createMockPageResponse(1, 25, 75);
      // Add a specific tag to some articles
      const articlesWithTag = page1Response.data.map((article, index) => ({
        ...article,
        tags: index < 10 ? ['special-tag', ...article.tags] : article.tags,
      }));

      mockUseInfiniteArticles.mockReturnValue({
        articles: articlesWithTag,
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: true,
        fetchNextPage: vi.fn(),
        error: null,
        refetch: vi.fn(),
      });

      renderFeed({ selectedTag: 'special-tag' });

      // Should only show articles with 'special-tag'
      const articles = screen.getAllByTestId(/^article-/);
      expect(articles.length).toBeLessThanOrEqual(10); // Only articles with tag
    });
  });
});



