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
  getArticlesPaginated(params: {
    q?: string;
    searchMode?: 'relevance' | 'latest';
    page: number;
    limit: number;
    category?: string;
    categories?: string[];
    tag?: string;
    sort?: string;
    collectionId?: string;
    favorites?: boolean;
    unread?: boolean;
    formats?: string[];
    timeRange?: string;
    youtubeOnly?: boolean;
    nonYoutubeOnly?: boolean;
    formatTagIds?: string[];
    domainTagIds?: string[];
    subtopicTagIds?: string[];
    contentStream?: string;
  }): Promise<PaginatedArticlesResponse> {
    const queryParams = new URLSearchParams();
    if (params.q) queryParams.set('q', params.q);
    if (params.searchMode) queryParams.set('searchMode', params.searchMode);
    if (params.category) queryParams.set('category', params.category);
    if (params.categories && params.categories.length > 0) {
      params.categories.forEach(c => queryParams.append('categories', c));
    }
    if (params.tag) queryParams.set('tag', params.tag);
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.collectionId) queryParams.set('collectionId', params.collectionId);
    if (params.favorites) queryParams.set('favorites', '1');
    if (params.unread) queryParams.set('unread', '1');
    if (params.formats && params.formats.length > 0) {
      params.formats.forEach(f => queryParams.append('formats', f));
    }
    if (params.timeRange && params.timeRange !== 'all') queryParams.set('timeRange', params.timeRange);
    if (params.youtubeOnly) queryParams.set('youtubeOnly', '1');
    if (params.nonYoutubeOnly) queryParams.set('nonYoutubeOnly', '1');
    // Dimension-based tag filtering
    if (params.formatTagIds && params.formatTagIds.length > 0) {
      params.formatTagIds.forEach(id => queryParams.append('formatTagIds', id));
    }
    if (params.domainTagIds && params.domainTagIds.length > 0) {
      params.domainTagIds.forEach(id => queryParams.append('domainTagIds', id));
    }
    if (params.subtopicTagIds && params.subtopicTagIds.length > 0) {
      params.subtopicTagIds.forEach(id => queryParams.append('subtopicTagIds', id));
    }
    if (params.contentStream) queryParams.set('contentStream', params.contentStream);
    queryParams.set('page', params.page.toString());
    queryParams.set('limit', params.limit.toString());

    return apiClient.get<PaginatedArticlesResponse>(`/articles?${queryParams}`, undefined, 'GET:articles-search');
  }

  getArticleById(id: string): Promise<Article | undefined> {
    return apiClient.get<Article>(`/articles/${id}`).catch(() => undefined);
  }

  getUnseenFeedCounts(): Promise<{ home: number; marketPulse: number }> {
    return apiClient.get<{ home: number; marketPulse: number }>('/articles/unseen-counts');
  }

  markFeedSeen(feed: 'home' | 'market-pulse'): Promise<void> {
    return apiClient.post<void>('/articles/mark-seen', { feed });
  }

  getPulseUnseenCount(): Promise<number> {
    return apiClient.get<{ count: number }>('/articles/pulse/unseen-count').then(r => r.count);
  }

  markPulseSeen(): Promise<void> {
    return apiClient.post<void>('/articles/pulse/mark-seen', {});
  }

  getStandardUnseenCount(): Promise<number> {
    return apiClient.get<{ count: number }>('/articles/standard/unseen-count').then(r => r.count);
  }

  markStandardSeen(): Promise<void> {
    return apiClient.post<void>('/articles/standard/mark-seen', {});
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
    
    // At least one classification tag (tagId) must be present
    const hasTagIds = Array.isArray(article.tagIds) && article.tagIds.length > 0;
    if (!hasTagIds) {
      return Promise.reject(new Error('At least one classification tag is required to create a nugget'));
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
      // tagIds is the sole classification field — free-form tags removed
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
      // Dimension tag IDs (format, domain, subtopic)
      ...(article.tagIds && article.tagIds.length > 0 && { tagIds: article.tagIds }),
      // Disclaimer fields
      ...((article as any).showDisclaimer !== undefined && { showDisclaimer: (article as any).showDisclaimer }),
      ...((article as any).disclaimerText !== undefined && { disclaimerText: (article as any).disclaimerText }),
      // Content stream routing
      ...(article.contentStream && { contentStream: article.contentStream }),
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
          showInGrid: updatesWithoutCategoryIds.media.showInGrid,
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
    // Dimension tag IDs (format, domain, subtopic)
    if (updatesWithoutCategoryIds.tagIds !== undefined) payload.tagIds = updatesWithoutCategoryIds.tagIds;
    // Disclaimer fields
    if (updatesWithoutCategoryIds.showDisclaimer !== undefined) payload.showDisclaimer = updatesWithoutCategoryIds.showDisclaimer;
    if (updatesWithoutCategoryIds.disclaimerText !== undefined) payload.disclaimerText = updatesWithoutCategoryIds.disclaimerText;
    // Content stream routing
    if (updatesWithoutCategoryIds.contentStream !== undefined) payload.contentStream = updatesWithoutCategoryIds.contentStream;

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
    return apiClient.get<User>(`/users/public/${id}`).catch(() => undefined);
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

  // Tag Taxonomy (two-axis: format + domain)
  async getTagTaxonomy(): Promise<import('@/types').TagTaxonomy> {
    return apiClient.get<import('@/types').TagTaxonomy>('/categories/taxonomy');
  }

  // --- Collections ---
  getCollections(params?: { 
    type?: 'public' | 'private'; 
    includeCount?: boolean;
    includeEntries?: boolean;
    summary?: boolean;
    // PHASE 5: Add backend sorting/searching support
    searchQuery?: string;
    sortField?: 'created' | 'updated' | 'followers' | 'nuggets' | 'name';
    sortDirection?: 'asc' | 'desc';
    creatorId?: string;
    page?: number;
    limit?: number;
    parentId?: string;
    rootOnly?: boolean;
  }): Promise<Collection[] | { data: Collection[]; count: number }> {
    // Use endpoint-specific cancel behavior (default in apiClient).
    // Do NOT use a single shared cancelKey here; different collection queries/pages
    // must be allowed to run concurrently (e.g., paginated aggregation in pickers).
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.set('type', params.type);
    if (params?.includeCount) queryParams.set('includeCount', 'true');
    if (params?.includeEntries === false) queryParams.set('includeEntries', 'false');
    if (params?.summary) queryParams.set('summary', 'true');
    // PHASE 5: Add search and sort parameters
    if (params?.searchQuery) queryParams.set('q', params.searchQuery);
    if (params?.sortField) queryParams.set('sortField', params.sortField);
    if (params?.sortDirection) queryParams.set('sortDirection', params.sortDirection);
    if (params?.creatorId) queryParams.set('creatorId', params.creatorId);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.parentId) queryParams.set('parentId', params.parentId);
    if (params?.rootOnly) queryParams.set('rootOnly', 'true');
    
    const endpoint = queryParams.toString() ? `/collections?${queryParams}` : '/collections';
    return apiClient.get<any>(endpoint)
      .then(response => {
        // Handle paginated response: { data: Collection[], total, page, limit, hasMore }
        if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
          if (params?.includeCount) {
            return {
              data: response.data,
              count: typeof response.total === 'number' ? response.total : response.data.length,
            };
          }
          return response.data;
        }
        // Handle legacy array response
        if (Array.isArray(response)) {
          if (params?.includeCount) {
            return { data: response, count: response.length };
          }
          return response;
        }
        return params?.includeCount ? { data: [], count: 0 } : [];
      });
  }

  getFeaturedCollections(): Promise<Collection[]> {
    return apiClient.get<Collection[]>('/collections/featured');
  }

  getCollectionArticles(collectionId: string, params: { q?: string; page: number; limit: number; sort?: string }): Promise<PaginatedArticlesResponse> {
    const queryParams = new URLSearchParams();
    if (params.q) queryParams.set('q', params.q);
    if (params.sort) queryParams.set('sort', params.sort);
    queryParams.set('page', params.page.toString());
    queryParams.set('limit', params.limit.toString());
    return apiClient.get<PaginatedArticlesResponse>(`/collections/${collectionId}/articles?${queryParams}`);
  }

  getCollectionById(id: string, options?: { includeEntries?: boolean }): Promise<Collection | undefined> {
    const query = options?.includeEntries === false ? '?includeEntries=false' : '';
    return apiClient.get<Collection>(`/collections/${id}${query}`).catch(() => undefined);
  }

  getCollectionsContainingArticle(articleId: string): Promise<Collection[]> {
    const enc = encodeURIComponent(articleId);
    return apiClient.get<Collection[]>(`/collections/containing-article/${enc}`);
  }

  createCollection(name: string, description: string, creatorId: string, type: 'public' | 'private', parentId?: string | null): Promise<Collection> {
    return apiClient.post('/collections', { name, description, creatorId, type, parentId });
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

  async addBatchEntriesToCollection(collectionId: string, articleIds: string[], userId: string): Promise<void> {
    await apiClient.post(`/collections/${collectionId}/entries/batch`, { articleIds, userId });
  }

  async removeBatchEntriesFromCollection(collectionId: string, articleIds: string[], userId: string): Promise<void> {
    await apiClient.post(`/collections/${collectionId}/entries/batch/remove`, { articleIds, userId });
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


