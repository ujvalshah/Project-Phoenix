import { storageService } from './storageService';
import { PaginatedArticlesResponse } from './adapters/IAdapter';
import { Article, FilterState, SortOrder } from '@/types';

export type { PaginatedArticlesResponse };

export const articleService = {
  getArticles: async (filters: FilterState, page: number = 1): Promise<PaginatedArticlesResponse> => {
    // Backend pagination is the single source of truth
    // CATEGORY PHASE-OUT: Backend now supports tags instead of categories
    // Backend supports: q (search), category (converted to tags), sort, page, limit
    // Note: category query param is converted to tags filter on backend
    
    const limit = filters.limit || 25;
    
    // CATEGORY PHASE-OUT: Extract tag from categories filter (single-select: use first tag if available)
    // filters.categories now represents tags for backward compatibility
    const category = filters.categories && filters.categories.length > 0 
      ? filters.categories[0] 
      : undefined;
    
    // Map sort order (frontend → backend)
    const sortMap: Record<SortOrder, string> = {
      latest: 'latest',
      oldest: 'oldest',
    };
    const sort = sortMap[filters.sort ?? 'latest'] ?? 'latest';
    
    // Use type-safe interface method - no casting required
    // If adapter doesn't support pagination, it will throw a clear error
    try {
      // Trim search query to prevent issues with leading/trailing spaces
      const trimmedQuery = filters.query?.trim() || undefined;
      return await storageService.getArticlesPaginated({
        q: trimmedQuery || undefined,
        searchMode: filters.searchMode || undefined,
        category: category,
        categories: filters.categories && filters.categories.length > 1 ? filters.categories : undefined,
        tag: filters.tag || undefined,
        sort: sort,
        collectionId: filters.collectionId || undefined,
        favorites: filters.favorites || undefined,
        unread: filters.unread || undefined,
        formats: filters.formats && filters.formats.length > 0 ? filters.formats : undefined,
        timeRange: filters.timeRange && filters.timeRange !== 'all' ? filters.timeRange : undefined,
        formatTagIds: filters.formatTagIds && filters.formatTagIds.length > 0 ? filters.formatTagIds : undefined,
        domainTagIds: filters.domainTagIds && filters.domainTagIds.length > 0 ? filters.domainTagIds : undefined,
        subtopicTagIds: filters.subtopicTagIds && filters.subtopicTagIds.length > 0 ? filters.subtopicTagIds : undefined,
        contentStream: filters.contentStream || undefined,
        page,
        limit
      });
    } catch (error: any) {
      // Re-throw with context if it's an adapter capability error
      if (error.message && error.message.includes('not supported')) {
        throw new Error(`Pagination not available: ${error.message}`);
      }
      // Propagate API errors as-is
      throw error;
    }
  },

  getArticleById: async (id: string): Promise<Article | undefined> => {
    return storageService.getArticleById(id);
  }
};


