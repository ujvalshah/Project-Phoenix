import { AdminCollection } from '../types/admin';
import { apiClient } from '@/services/apiClient';
import { mapCollectionToAdminCollection } from './adminApiMappers';
import { Collection } from '@/types';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

class AdminCollectionsService {
  // In-flight request guard to prevent duplicate concurrent stats requests
  private inFlightStatsRequest: Promise<{ totalCommunity: number; totalNuggetsInCommunity: number }> | null = null;
  private static readonly PAGE_LIMIT = 100;

  async listCollections(options?: string | { query?: string; parentId?: string; rootOnly?: boolean }): Promise<AdminCollection[]> {
    try {
      const query = typeof options === 'string' ? options : options?.query;
      const parentId = typeof options === 'string' ? undefined : options?.parentId;
      const rootOnly = typeof options === 'string' ? undefined : options?.rootOnly;

      const allCollections: Collection[] = [];
      let page = 1;
      let total = Number.POSITIVE_INFINITY;

      while (allCollections.length < total) {
        const params = new URLSearchParams();
        params.set('limit', String(AdminCollectionsService.PAGE_LIMIT));
        params.set('page', String(page));
        if (query) params.set('q', query);
        if (parentId) params.set('parentId', parentId);
        if (rootOnly) params.set('rootOnly', 'true');

        const endpoint = `/collections?${params.toString()}`;
        const response = await apiClient.get<PaginatedResponse<Collection>>(endpoint, undefined, `adminCollectionsService.listCollections.page.${page}`);
        const pageData = response?.data || [];

        if (!Array.isArray(pageData)) {
          console.error('[AdminCollectionsService.listCollections] Expected collections array but got:', typeof pageData, response);
          return [];
        }

        total = typeof response?.total === 'number' ? response.total : pageData.length;
        allCollections.push(...pageData);

        if (pageData.length === 0 || allCollections.length >= total) {
          break;
        }
        page += 1;
      }

      const uniqueCollections = Array.from(new Map(allCollections.map((c) => [c.id, c])).values());
      return uniqueCollections.map(mapCollectionToAdminCollection);
    } catch (error: any) {
      console.error('[AdminCollectionsService.listCollections] Error fetching collections:', error);
      throw error;
    }
  }

  async getCollectionDetails(id: string): Promise<AdminCollection | undefined> {
    const collection = await apiClient.get<Collection>(`/collections/${id}`).catch(() => undefined);
    if (!collection) return undefined;
    return mapCollectionToAdminCollection(collection);
  }

  async getStats(): Promise<{ totalCommunity: number; totalNuggetsInCommunity: number }> {
    // Reuse in-flight request if one exists (prevents duplicate concurrent fetches)
    if (this.inFlightStatsRequest) {
      return this.inFlightStatsRequest;
    }

    // Create and store the in-flight request
    this.inFlightStatsRequest = (async () => {
      try {
        // Use backend count for community collections (public only)
        // Request high limit (100) to get accurate stats
        const response = await apiClient.get<PaginatedResponse<Collection>>(
          '/collections?type=public&limit=100', 
          undefined, 
          'adminCollectionsService.getStats'
        );
        
        // Backend always returns paginated response format { data: [...], total, ... }
        const collections = response?.data || [];
        const totalCommunity = response?.total || collections.length;
        
        if (!Array.isArray(collections)) {
          console.error('[AdminCollectionsService.getStats] Expected collections array but got:', typeof collections, response);
          return { totalCommunity: 0, totalNuggetsInCommunity: 0 };
        }
        
        // All collections returned are public (filtered by type=public query param)
        return {
          totalCommunity: totalCommunity, // Use backend total count
          totalNuggetsInCommunity: collections.reduce((acc, c) => acc + (c.validEntriesCount ?? c.entries?.length ?? 0), 0)
        };
      } catch (error: any) {
        console.error('[AdminCollectionsService.getStats] Error fetching stats:', error);
        throw error;
      } finally {
        // Clear in-flight request when done (success or error)
        this.inFlightStatsRequest = null;
      }
    })();

    return this.inFlightStatsRequest;
  }

  async updateCollection(id: string, updates: Partial<AdminCollection>): Promise<void> {
    const payload: any = {};
    
    if (updates.name !== undefined) {
      payload.name = updates.name;
    }
    if (updates.description !== undefined) {
      payload.description = updates.description;
    }
    if (updates.type !== undefined) {
      payload.type = updates.type;
    }
    if (updates.parentId !== undefined) {
      payload.parentId = updates.parentId;
    }
    
    await apiClient.put(`/collections/${id}`, payload, 'adminCollectionsService.updateCollection');
  }

  async createCollection(input: {
    name: string;
    description?: string;
    type?: 'public' | 'private';
    parentId?: string | null;
  }): Promise<AdminCollection> {
    const response = await apiClient.post<Collection>('/collections', {
      name: input.name,
      description: input.description || '',
      type: input.type || 'public',
      parentId: input.parentId ?? null,
    });
    return mapCollectionToAdminCollection(response);
  }

  async addNuggetsToCollection(collectionId: string, articleIds: string[]): Promise<void> {
    await apiClient.post(`/collections/${collectionId}/entries/batch`, { articleIds }, undefined, 'adminCollectionsService.addNuggetsToCollection');
  }

  async updateCollectionStatus(_id: string, _status: 'active' | 'hidden'): Promise<void> {
    // Backend doesn't have status field for collections
    // This would need backend support
    throw new Error('Collection status update not supported by backend');
  }

  async setFeatured(id: string, isFeatured: boolean, featuredOrder?: number): Promise<void> {
    const body: Record<string, unknown> = { isFeatured };
    if (featuredOrder !== undefined) body.featuredOrder = featuredOrder;
    await apiClient.patch(`/collections/${id}/featured`, body, undefined, 'adminCollectionsService.setFeatured');
  }

  async reorderFeatured(orderedIds: string[]): Promise<void> {
    await apiClient.patch('/collections/featured/reorder', { orderedIds }, undefined, 'adminCollectionsService.reorderFeatured');
  }

  async deleteCollection(id: string): Promise<void> {
    try {
      await apiClient.delete(`/collections/${id}`, undefined, 'adminCollectionsService.deleteCollection');
    } catch (error: any) {
      console.error('[AdminCollectionsService.deleteCollection] Error:', error);
      // Re-throw with better context
      const errorMessage = error?.message || 'Failed to delete collection';
      const enhancedError: any = new Error(errorMessage);
      enhancedError.response = error?.response;
      enhancedError.status = error?.status;
      enhancedError.requestId = error?.requestId;
      throw enhancedError;
    }
  }
}

export const adminCollectionsService = new AdminCollectionsService();
