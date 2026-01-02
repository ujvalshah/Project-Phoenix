import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { articleService, PaginatedArticlesResponse } from '@/services/articleService';
import { FilterState, SortOrder, Article } from '@/types';

interface UseArticlesOptions {
  searchQuery: string;
  selectedCategories: string[];
  selectedTag: string | null;
  sortOrder: SortOrder;
  userId?: string;
  limit?: number;
  page?: number;
}

/**
 * useArticles Hook Return Shape
 * 
 * Returns explicit properties to avoid ambiguity:
 * - articles: Article[] - The articles array (extracted from paginated response)
 * - pagination: Pagination metadata (page, limit, total, hasMore)
 * - query: Full TanStack Query object for advanced usage
 */
export interface UseArticlesResult {
  articles: Article[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  } | null;
  query: UseQueryResult<PaginatedArticlesResponse>;
}

export const useArticles = ({
  searchQuery,
  selectedCategories,
  selectedTag,
  sortOrder,
  limit,
  page = 1
}: UseArticlesOptions): UseArticlesResult => {
  const query = useQuery<PaginatedArticlesResponse>({
    queryKey: ['articles', 'discover', searchQuery, selectedCategories, selectedTag, sortOrder, limit, page],
    queryFn: async () => {
      // Backend pagination - categories/tag filters ignored (backend limitation)
      const filters: FilterState = {
        query: searchQuery,
        categories: selectedCategories, // Ignored by backend
        tag: selectedTag, // Ignored by backend
        sort: sortOrder, // Backend always sorts by latest
        limit
      };
      return articleService.getArticles(filters, page);
    },
    // Keep previous data to avoid flickering
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 30, // 30 seconds - reduced to allow faster updates after batch creation
  });

  // Return explicit, non-ambiguous shape
  return {
    articles: query.data?.data || [],
    pagination: query.data ? {
      page: query.data.page,
      limit: query.data.limit,
      total: query.data.total,
      hasMore: query.data.hasMore
    } : null,
    query
  };
};


