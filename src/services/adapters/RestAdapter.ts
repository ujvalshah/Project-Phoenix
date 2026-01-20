import { IAdapter, PaginatedArticlesResponse, ArticleCountsResponse } from './IAdapter';
import { Article, User, Collection } from '@/types';
import { apiClient } from '@/services/apiClient';

/**
 * Calculate SHA256 hash of images array for deduplication drift detection
 * Returns hex-encoded hash string
 */
async function calculateImagesHash(images: string[] | undefined): Promise<string | undefined> {
  if (!images || images.length === 0) {
    return undefined;
  }
  
  try {
    // Sort images for consistent hashing (order-independent)
    const sortedImages = [...images].sort();
    const imagesString = JSON.stringify(sortedImages);
    
    // Use Web Crypto API for SHA256 hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(imagesString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.warn('[RestAdapter] Failed to calculate images hash:', error);
    return undefined;
  }
}

export class RestAdapter implements IAdapter {
  // --- Articles ---
  getAllArticles(params?: { q?: string; page?: number; limit?: number }): Promise<Article[]> {
    const queryParams = new URLSearchParams();
    if (params?.q) queryParams.set('q', params.q);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    
    const endpoint = queryParams.toString() ? `/articles?${queryParams}` : '/articles';
    return apiClient.get<PaginatedArticlesResponse>(endpoint)
      .then(response => response.data);
  }

  // Paginated articles method - returns full pagination metadata
  getArticlesPaginated(params: { q?: string; page: number; limit: number; category?: string; sort?: string }): Promise<PaginatedArticlesResponse> {
    const queryParams = new URLSearchParams();
    if (params.q) queryParams.set('q', params.q);
    if (params.category) queryParams.set('category', params.category);
    if (params.sort) queryParams.set('sort', params.sort);
    queryParams.set('page', params.page.toString());
    queryParams.set('limit', params.limit.toString());
    
    return apiClient.get<PaginatedArticlesResponse>(`/articles?${queryParams}`);
  }

  getArticleById(id: string): Promise<Article | undefined> {
    return apiClient.get<Article>(`/articles/${id}`).catch(() => undefined);
  }

  getArticlesByAuthor(authorId: string): Promise<Article[]> {
    return apiClient.get<PaginatedArticlesResponse>(`/articles?authorId=${authorId}`)
      .then(response => {
        if (!Array.isArray(response.data)) {
          throw new Error('Expected Article[] from getArticlesByAuthor, but received non-array data');
        }
        return response.data;
      });
  }

  getMyArticleCounts(): Promise<ArticleCountsResponse> {
    return apiClient.get<ArticleCountsResponse>('/articles/my/counts');
  }

  async createArticle(article: Omit<Article, 'id' | 'publishedAt'>): Promise<Article> {
    // Transform frontend format to server API format
    
    /**
     * PHASE 4: Tag Data Contract Enforcement
     * 
     * Backend validation requires:
     * - tags: string[] (non-empty, all elements must be non-empty strings)
     * 
     * This adapter normalizes and validates tags before sending to backend:
     * 1. Ensures tags is always an array
     * 2. Filters out invalid entries (null, undefined, empty strings)
     * 3. Rejects early if no valid tags remain (prevents backend validation error)
     */
    const tags = Array.isArray(article.tags) 
      ? article.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [];
    
    // PHASE 5: Defensive validation - reject early if tags are empty
    // This prevents sending invalid payloads to backend and provides clearer error messages
    if (tags.length === 0) {
      return Promise.reject(new Error('At least one tag is required to create a nugget'));
    }
    
    // CATEGORY PHASE-OUT: categoryIds is never sent - silently ignored if present in article object
    const { categoryIds, ...articleWithoutCategoryIds } = article as any;
    
    const payload: any = {
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      authorId: article.author?.id || '',
      // CRITICAL: Include mediaIds if present (Cloudinary-uploaded media)
      mediaIds: article.mediaIds,
      authorName: article.author?.name || '',
      // CATEGORY PHASE-OUT: Removed category, categories, and categoryIds fields
      // Tags are now the only classification field
      tags: tags, // Use validated tags array
      readTime: article.readTime,
      visibility: article.visibility || 'public',
      publishedAt: new Date().toISOString(), // Generate timestamp for new articles
      // Include additional fields that might be in the Article type
      ...(article.images && article.images.length > 0 && { images: article.images }),
      ...(article.documents && article.documents.length > 0 && { documents: article.documents }),
      // Always include media if it exists (even if null, to explicitly clear it)
      ...(article.media !== undefined && { media: article.media }),
      // CRITICAL: Include mediaIds for Cloudinary-uploaded media
      ...(article.mediaIds && article.mediaIds.length > 0 && { mediaIds: article.mediaIds }),
      // CRITICAL: Include primaryMedia and supportingMedia for Masonry layout
      ...(article.primaryMedia !== undefined && { primaryMedia: article.primaryMedia }),
      ...(article.supportingMedia && article.supportingMedia.length > 0 && { supportingMedia: article.supportingMedia }),
      ...(article.source_type && { source_type: article.source_type }),
      ...(article.displayAuthor && { displayAuthor: article.displayAuthor }),
      // Admin-only: Custom creation date (if provided)
      ...((article as any).customCreatedAt && { customCreatedAt: (article as any).customCreatedAt }),
      // External links for card "Link" button (separate from media URLs)
      ...((article as any).externalLinks && { externalLinks: (article as any).externalLinks }),
      // Layout visibility configuration
      ...((article as any).layoutVisibility && { layoutVisibility: (article as any).layoutVisibility }),
    };
    
    // TEMPORARY DEBUG: Stage 3 - Payload sent to API (RestAdapter)
    const primaryUrl = article.media?.url || article.primaryMedia?.url || null;
    console.log('[CONTENT_TRACE] Stage 3 - Payload sent to API (RestAdapter)', {
      mode: 'create',
      hasMedia: !!payload.media,
      source_type: payload.source_type,
      primaryUrl,
      contentLength: payload.content?.length || 0,
      contentPreview: payload.content?.substring(0, 120) || '',
      mediaType: payload.media?.type,
      mediaUrl: payload.media?.url,
    });
    
    // IMAGE DEDUPLICATION MIGRATION: Add x-images-hash header for drift detection
    // Frontend is canonical deduplication pass - backend will compute but not mutate
    const imagesHash = await calculateImagesHash(payload.images);
    const headers: HeadersInit = imagesHash ? { 'x-images-hash': imagesHash } : {};
    
    return apiClient.post('/articles', payload, headers);
  }

  async updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
    // Transform Article format to backend API format
    const payload: any = {};
    
    // CATEGORY PHASE-OUT: Remove categoryIds and categories from updates (silently ignored)
    const { categoryIds, categories, ...updatesWithoutCategoryIds } = updates as any;
    
    // Map editable fields
    if (updatesWithoutCategoryIds.title !== undefined) payload.title = updatesWithoutCategoryIds.title;
    if (updatesWithoutCategoryIds.content !== undefined) payload.content = updatesWithoutCategoryIds.content;
    if (updatesWithoutCategoryIds.excerpt !== undefined) payload.excerpt = updatesWithoutCategoryIds.excerpt;
    
    // CATEGORY PHASE-OUT: Removed category, categories, and categoryIds fields
    // Tags are now the only classification field
    if (updatesWithoutCategoryIds.visibility !== undefined) payload.visibility = updatesWithoutCategoryIds.visibility;
    if (updatesWithoutCategoryIds.tags !== undefined) payload.tags = updatesWithoutCategoryIds.tags;
    // CRITICAL: Preserve masonryTitle when updating media field
    // masonryTitle must flow through all layers to persist correctly
    if (updatesWithoutCategoryIds.media !== undefined) {
      payload.media = updatesWithoutCategoryIds.media;
      // Ensure masonryTitle is explicitly included (defensive against field dropping)
      if (updatesWithoutCategoryIds.media && typeof updatesWithoutCategoryIds.media === 'object' && 'masonryTitle' in updatesWithoutCategoryIds.media) {
        payload.media = {
          ...updatesWithoutCategoryIds.media,
          masonryTitle: updatesWithoutCategoryIds.media.masonryTitle, // Explicitly preserve masonryTitle
          showInMasonry: updatesWithoutCategoryIds.media.showInMasonry, // Explicitly preserve showInMasonry
        };
      }
    }
    if (updatesWithoutCategoryIds.images !== undefined) payload.images = updatesWithoutCategoryIds.images;
    if (updatesWithoutCategoryIds.documents !== undefined) payload.documents = updatesWithoutCategoryIds.documents;
    // CRITICAL: Include mediaIds for Cloudinary-uploaded media
    if (updatesWithoutCategoryIds.mediaIds !== undefined) payload.mediaIds = updatesWithoutCategoryIds.mediaIds;
    // CRITICAL: Include primaryMedia and supportingMedia for Masonry layout
    if (updatesWithoutCategoryIds.primaryMedia !== undefined) payload.primaryMedia = updatesWithoutCategoryIds.primaryMedia;
    if (updatesWithoutCategoryIds.supportingMedia !== undefined) payload.supportingMedia = updatesWithoutCategoryIds.supportingMedia;
    if (updatesWithoutCategoryIds.source_type !== undefined) payload.source_type = updatesWithoutCategoryIds.source_type;
    if (updatesWithoutCategoryIds.displayAuthor !== undefined) payload.displayAuthor = updatesWithoutCategoryIds.displayAuthor;
    // Admin-only: Custom creation date (if provided)
    if (updatesWithoutCategoryIds.customCreatedAt !== undefined) payload.customCreatedAt = updatesWithoutCategoryIds.customCreatedAt;
    // External links for card "Link" button (separate from media URLs)
    if (updatesWithoutCategoryIds.externalLinks !== undefined) payload.externalLinks = updatesWithoutCategoryIds.externalLinks;
    // Layout visibility configuration
    if (updatesWithoutCategoryIds.layoutVisibility !== undefined) payload.layoutVisibility = updatesWithoutCategoryIds.layoutVisibility;

    // IMAGE DEDUPLICATION MIGRATION: Add x-images-hash header for drift detection
    // Frontend is canonical deduplication pass - backend will compute but not mutate
    const imagesHash = await calculateImagesHash(payload.images);
    const headers: HeadersInit = imagesHash ? { 'x-images-hash': imagesHash } : {};
    
    // Use PATCH for partial updates (more RESTful)
    return apiClient.patch<Article>(`/articles/${id}`, payload, headers);
  }

  deleteArticle(id: string): Promise<boolean> {
    return apiClient.delete(`/articles/${id}`).then(() => true);
  }

  // --- Users ---
  getUsers(): Promise<User[]> {
    return apiClient.get<{ data: User[] } | User[]>('/users')
      .then(response => Array.isArray(response) ? response : (response.data || []));
  }

  getUserById(id: string): Promise<User | undefined> {
    return apiClient.get<User>(`/users/${id}`).catch(() => undefined);
  }

  updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    return apiClient.put(`/users/${id}`, updates);
  }

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  }

  // --- Personalization ---
  async updateUserPreferences(userId: string, interestedCategories: string[]): Promise<void> {
    await this.updateUser(userId, { preferences: { interestedCategories } });
  }

  async updateLastFeedVisit(userId: string): Promise<void> {
    await this.updateUser(userId, { lastFeedVisit: new Date().toISOString() });
  }

  async getPersonalizedFeed(userId: string): Promise<{ articles: Article[], newCount: number }> {
    return apiClient.get(`/users/${userId}/feed`);
  }

  // --- Categories ---
  /**
   * Phase 2: Get full tag objects with IDs
   * Returns array of Tag objects for stable ID-based matching
   */
  async getCategoriesWithIds(): Promise<import('@/types').Tag[]> {
    try {
      const response = await apiClient.get<any>('/categories?format=full', undefined, 'restAdapter.getCategoriesWithIds');
      
      // Handle paginated response: extract data array
      if (response && typeof response === 'object' && 'data' in response) {
        return response.data || [];
      }
      
      // Legacy: handle plain array response
      if (Array.isArray(response)) {
        return response;
      }
      
      return [];
    } catch (error: any) {
      // Handle cancelled requests gracefully
      if (error?.message === 'Request cancelled') {
        return [];
      }
      throw error;
    }
  }

  /**
   * LEGACY: Get category names only (backward compatibility)
   * Use getCategoriesWithIds() for new code
   */
  async getCategories(): Promise<string[]> {
    // Backend returns paginated response: { data: string[], total, page, limit, hasMore }
    // Use ?format=simple to get array of tag names in data field
    // Add cancelKey to prevent duplicate simultaneous requests
    try {
      const response = await apiClient.get<any>('/categories?format=simple', undefined, 'restAdapter.getCategories');
      
      // Handle paginated response: extract data array
      if (response && typeof response === 'object' && 'data' in response) {
        const tags = response.data;
        // If backend returns Tag objects, extract names
        if (tags && tags.length > 0 && typeof tags[0] === 'object') {
          return tags.map((tag: any) => tag.name || tag);
        }
        return tags || [];
      }
      
      // Legacy: handle plain array response
      if (Array.isArray(response)) {
        if (response.length > 0 && typeof response[0] === 'object') {
          return response.map((tag: any) => tag.name || tag);
        }
        return response;
      }
      
      return [];
    } catch (error: any) {
      // Handle cancelled requests gracefully - return empty array instead of throwing
      if (error?.message === 'Request cancelled') {
        return [];
      }
      // Re-throw other errors
      throw error;
    }
  }

  async addCategory(category: string): Promise<void> {
    await apiClient.post('/categories', { name: category });
  }

  async deleteCategory(category: string): Promise<void> {
    await apiClient.delete(`/categories/${encodeURIComponent(category)}`);
  }

  // --- Collections ---
  getCollections(params?: { 
    type?: 'public' | 'private'; 
    includeCount?: boolean;
    // PHASE 5: Add backend sorting/searching support
    searchQuery?: string;
    sortField?: 'created' | 'updated' | 'followers' | 'nuggets' | 'name';
    sortDirection?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<Collection[]> {
    // Add cancelKey to prevent duplicate simultaneous requests
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.set('type', params.type);
    if (params?.includeCount) queryParams.set('includeCount', 'true');
    // PHASE 5: Add search and sort parameters
    if (params?.searchQuery) queryParams.set('q', params.searchQuery);
    if (params?.sortField) queryParams.set('sortField', params.sortField);
    if (params?.sortDirection) queryParams.set('sortDirection', params.sortDirection);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    
    const endpoint = queryParams.toString() ? `/collections?${queryParams}` : '/collections';
    return apiClient.get<any>(endpoint, undefined, 'restAdapter.getCollections')
      .then(response => {
        // Handle paginated response: { data: Collection[], total, page, limit, hasMore }
        if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
          return response.data;
        }
        // Handle legacy array response
        if (Array.isArray(response)) {
          return response;
        }
        return [];
      });
  }

  getCollectionById(id: string): Promise<Collection | undefined> {
    return apiClient.get<Collection>(`/collections/${id}`).catch(() => undefined);
  }

  createCollection(name: string, description: string, creatorId: string, type: 'public' | 'private'): Promise<Collection> {
    return apiClient.post('/collections', { name, description, creatorId, type });
  }

  async deleteCollection(id: string): Promise<void> {
    await apiClient.delete(`/collections/${id}`);
  }

  updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | null> {
    return apiClient.put(`/collections/${id}`, updates);
  }

  async addArticleToCollection(collectionId: string, articleId: string, userId: string): Promise<void> {
    await apiClient.post(`/collections/${collectionId}/entries`, { articleId, userId });
  }

  async removeArticleFromCollection(collectionId: string, articleId: string, userId: string): Promise<void> {
    await apiClient.delete(`/collections/${collectionId}/entries/${articleId}`);
  }

  async flagEntryAsIrrelevant(collectionId: string, articleId: string, userId: string): Promise<void> {
    await apiClient.post(`/collections/${collectionId}/entries/${articleId}/flag`, { userId });
  }

  async followCollection(collectionId: string): Promise<void> {
    await apiClient.post(`/collections/${collectionId}/follow`, {});
  }

  async unfollowCollection(collectionId: string): Promise<void> {
    await apiClient.post(`/collections/${collectionId}/unfollow`, {});
  }
}


