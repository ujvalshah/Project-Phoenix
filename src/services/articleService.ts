import { storageService } from './storageService';
import { PaginatedArticlesResponse } from './adapters/IAdapter';
import { Article, FilterState } from '@/types';

export type { PaginatedArticlesResponse };

export const articleService = {
  getArticles: async (filters: FilterState, page: number = 1): Promise<PaginatedArticlesResponse> => {
    // Backend pagination is the single source of truth
    // Backend supports: q (search), category, sort, page, limit
    // Backend does NOT support: tag filter (still ignored)
    // Note: Only first category is sent (single-select pattern)
    
    const limit = filters.limit || 25;
    
    // Extract category (single-select: use first category if available)
    const category = filters.categories && filters.categories.length > 0 
      ? filters.categories[0] 
      : undefined;
    
    // Map sort order (frontend → backend)
    const sortMap: Record<string, string> = {
      'latest': 'latest',
      'oldest': 'oldest',
      'title': 'title'
    };
    const sort = sortMap[filters.sort || 'latest'] || 'latest';
    
    // Use type-safe interface method - no casting required
    // If adapter doesn't support pagination, it will throw a clear error
    try {
      // Trim search query to prevent issues with leading/trailing spaces
      const trimmedQuery = filters.query?.trim() || undefined;
      return await storageService.getArticlesPaginated({
        q: trimmedQuery || undefined,
        category: category,
        sort: sort,
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


