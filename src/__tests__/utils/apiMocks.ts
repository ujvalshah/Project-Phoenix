/**
 * API Mock Utilities
 * 
 * Provides mock implementations for API client and article service
 */

import { vi } from 'vitest';
import { PaginatedArticlesResponse } from '@/services/articleService';
import { createMockPageResponse } from './mockArticles';

/**
 * Create a mock API client that returns paginated responses
 * 
 * @param responses - Map of page numbers to responses (or a function that generates responses)
 */
export function createMockApiClient(
  responses: Map<number, PaginatedArticlesResponse> | ((page: number) => PaginatedArticlesResponse)
) {
  const requestLog: Array<{ url: string; page: number }> = [];

  const mockGet = vi.fn((url: string) => {
    // Extract page parameter from URL
    const urlObj = new URL(url, 'http://localhost');
    const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
    
    requestLog.push({ url, page });

    // Get response from map or function
    const response = typeof responses === 'function'
      ? responses(page)
      : responses.get(page) || createMockPageResponse(page, 25, 0, undefined);

    return Promise.resolve(response);
  });

  return {
    mockGet,
    requestLog,
    // Helper to get all requested pages
    getRequestedPages: () => requestLog.map(r => r.page),
    // Helper to verify page was requested
    wasPageRequested: (page: number) => requestLog.some(r => r.page === page),
    // Helper to clear log
    clearLog: () => requestLog.length = 0,
  };
}

/**
 * Create a mock articleService.getArticles function
 */
export function createMockArticleService(
  responses: Map<number, PaginatedArticlesResponse> | ((page: number) => PaginatedArticlesResponse)
) {
  const callLog: Array<{ page: number; filters: any }> = [];

  const mockGetArticles = vi.fn(async (filters: any, page: number) => {
    callLog.push({ page, filters });

    const response = typeof responses === 'function'
      ? responses(page)
      : responses.get(page) || createMockPageResponse(page, 25, 0, undefined);

    return response;
  });

  return {
    mockGetArticles,
    callLog,
    getRequestedPages: () => callLog.map(c => c.page),
    wasPageRequested: (page: number) => callLog.some(c => c.page === page),
    clearLog: () => callLog.length = 0,
  };
}



