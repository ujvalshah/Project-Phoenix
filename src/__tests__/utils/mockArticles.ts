/**
 * Test Utilities for Mock Articles
 * 
 * Generates predictable mock articles with sequential IDs and timestamps
 * for testing pagination and infinite scroll behavior.
 */

import { Article } from '@/types';
import { PaginatedArticlesResponse } from '@/services/articleService';

/**
 * Generate a single mock article with predictable data
 * 
 * @param id - Article ID (will be used in title, content, etc.)
 * @param publishedAt - ISO timestamp (defaults to sequential dates)
 * @param category - Category name (default: 'Technology')
 */
export function createMockArticle(
  id: number,
  publishedAt?: string,
  category: string = 'Technology'
): Article {
  const baseDate = new Date('2024-01-01T00:00:00Z');
  const articleDate = publishedAt 
    ? new Date(publishedAt)
    : new Date(baseDate.getTime() - id * 24 * 60 * 60 * 1000); // Each article 1 day earlier

  return {
    id: `article-${id}`,
    title: `Test Article ${id}`,
    excerpt: `This is the excerpt for article ${id}`,
    content: `This is the full content for article ${id}. It contains multiple sentences to test rendering.`,
    author: {
      id: `user-${id % 10}`, // Cycle through 10 users
      name: `Author ${id % 10}`,
      avatar_url: `https://example.com/avatar-${id % 10}.jpg`,
    },
    publishedAt: articleDate.toISOString(),
    categories: [category],
    tags: [`tag-${id % 5}`, `tag-${(id + 1) % 5}`], // Cycle through 5 tags
    readTime: Math.ceil(id / 10), // Varying read times
    visibility: 'public',
    primaryMedia: id % 3 === 0 ? {
      type: 'image',
      url: `https://example.com/image-${id}.jpg`,
      thumbnail: `https://example.com/thumb-${id}.jpg`,
    } : null,
  };
}

/**
 * Generate an array of mock articles
 * 
 * @param count - Number of articles to generate
 * @param startId - Starting ID (default: 1)
 * @param category - Category name (default: 'Technology')
 */
export function createMockArticles(
  count: number,
  startId: number = 1,
  category: string = 'Technology'
): Article[] {
  return Array.from({ length: count }, (_, i) => 
    createMockArticle(startId + i, undefined, category)
  );
}

/**
 * Generate a paginated API response
 * 
 * @param page - Page number (1-indexed)
 * @param limit - Items per page (default: 25)
 * @param total - Total items available (default: 75)
 * @param category - Category filter (optional)
 */
export function createMockPageResponse(
  page: number,
  limit: number = 25,
  total: number = 75,
  category?: string
): PaginatedArticlesResponse {
  const startId = (page - 1) * limit + 1;
  const endId = Math.min(page * limit, total);
  const itemsInPage = endId - startId + 1;
  
  const articles = createMockArticles(itemsInPage, startId, category);
  
  return {
    data: articles,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}

/**
 * Generate mock responses for multiple pages
 * Useful for testing page accumulation
 * 
 * @param pages - Number of pages to generate
 * @param limit - Items per page (default: 25)
 * @param total - Total items (default: pages * limit)
 */
export function createMockPageResponses(
  pages: number,
  limit: number = 25,
  total?: number
): PaginatedArticlesResponse[] {
  const totalItems = total ?? pages * limit;
  
  return Array.from({ length: pages }, (_, i) => 
    createMockPageResponse(i + 1, limit, totalItems)
  );
}

/**
 * Verify that articles are in correct order (by publishedAt descending)
 * Used to test sorting determinism
 */
export function verifyArticleOrder(articles: Article[]): boolean {
  for (let i = 1; i < articles.length; i++) {
    const prev = new Date(articles[i - 1].publishedAt);
    const curr = new Date(articles[i].publishedAt);
    
    // Should be descending (newer first)
    if (prev < curr) {
      return false;
    }
    
    // If dates are equal, check ID for secondary sort
    if (prev.getTime() === curr.getTime()) {
      const prevId = parseInt(articles[i - 1].id.split('-')[1]);
      const currId = parseInt(articles[i].id.split('-')[1]);
      if (prevId < currId) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Verify no duplicate article IDs in the list
 */
export function verifyNoDuplicates(articles: Article[]): boolean {
  const ids = new Set(articles.map(a => a.id));
  return ids.size === articles.length;
}



