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

  async listCollections(query?: string): Promise<AdminCollection[]> {
    try {
      // Request high limit (100) to get all collections for admin panel
      const endpoint = query 
        ? `/collections?q=${encodeURIComponent(query)}&limit=100` 
        : '/collections?limit=100';
      const response = await apiClient.get<PaginatedResponse<Collection>>(endpoint, undefined, 'adminCollectionsService.listCollections');
      
      // Backend always returns paginated response format { data: [...], total, ... }
      const collections = response?.data || [];
      
      if (!Array.isArray(collections)) {
        console.error('[AdminCollectionsService.listCollections] Expected collections array but got:', typeof collections, response);
        return [];
      }
      
      return collections.map(mapCollectionToAdminCollection);
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
    
    await apiClient.put(`/collections/${id}`, payload, 'adminCollectionsService.updateCollection');
  }

  async updateCollectionStatus(_id: string, _status: 'active' | 'hidden'): Promise<void> {
    // Backend doesn't have status field for collections
    // This would need backend support
    throw new Error('Collection status update not supported by backend');
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
