import { AdminTag, AdminTagRequest } from '../types/admin';
import { apiClient } from '@/services/apiClient';
import { mapTagToAdminTag, RawTag } from './adminApiMappers';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

class AdminTagsService {
  // In-flight request guard to prevent duplicate concurrent stats requests
  private inFlightStatsRequest: Promise<{ total: number; totalTags: number; pending: number }> | null = null;

  async listTags(query?: string): Promise<AdminTag[]> {
    try {
      // Get all tags with format=full to get paginated response with full tag objects
      // Request high limit (100) to get all tags for admin panel
      const endpoint = query 
        ? `/categories?format=full&q=${encodeURIComponent(query)}&limit=100` 
        : '/categories?format=full&limit=100';
      const response = await apiClient.get<PaginatedResponse<RawTag>>(endpoint, undefined, 'adminTagsService.listTags');
      
      // Backend always returns paginated response format { data: [...], total, ... }
      const tags = response?.data || [];
      
      if (!Array.isArray(tags)) {
        console.error('[AdminTagsService.listTags] Expected tags array but got:', typeof tags, response);
        return [];
      }
      
      // Include all tags (active, deprecated) but filter out pending (those are in requests)
      const filtered = tags.filter(t => t.status !== 'pending');
      
      return filtered.map(mapTagToAdminTag).sort((a, b) => b.usageCount - a.usageCount);
    } catch (error: any) {
      console.error('[AdminTagsService.listTags] Error fetching tags:', error);
      throw error;
    }
  }

  async listRequests(): Promise<AdminTagRequest[]> {
    try {
      // Get all tags with format=full and filter for pending
      // Request high limit (100) to get all tags
      const response = await apiClient.get<PaginatedResponse<RawTag>>('/categories?format=full&limit=100');
      const tags = response?.data || [];
      
      if (!Array.isArray(tags)) {
        console.error('[AdminTagsService.listRequests] Expected tags array but got:', typeof tags, response);
        return [];
      }
      
      const pending = tags.filter(t => t.status === 'pending');
      
      return pending.map(tag => ({
        id: tag.id,
        name: tag.rawName || tag.name || '',
        requestedBy: {
          id: 'u-unknown', // Backend doesn't track requester
          name: tag.requestedBy || 'Unknown User'
        },
        requestedAt: new Date().toISOString(), // Backend doesn't track request date
        status: 'pending'
      }));
    } catch (error: any) {
      console.error('[AdminTagsService.listRequests] Error fetching tag requests:', error);
      throw error;
    }
  }

  async getStats(): Promise<{ total: number; totalTags: number; pending: number }> {
    // Reuse in-flight request if one exists (prevents duplicate concurrent fetches)
    if (this.inFlightStatsRequest) {
      return this.inFlightStatsRequest;
    }

    // Create and store the in-flight request
    this.inFlightStatsRequest = (async () => {
      try {
        // Request high limit (100) with format=full to get accurate stats
        const response = await apiClient.get<PaginatedResponse<RawTag>>('/categories?format=full&limit=100', undefined, 'adminTagsService.getStats');
        const tags = response?.data || [];
        
        if (!Array.isArray(tags)) {
          console.error('[AdminTagsService.getStats] Expected tags array but got:', typeof tags, response);
          return { total: 0, totalTags: 0, pending: 0 };
        }
        
        return {
          total: response?.total || tags.length,
          totalTags: tags.filter(t => t.status !== 'pending').length,
          pending: tags.filter(t => t.status === 'pending').length
        };
      } catch (error: any) {
        console.error('[AdminTagsService.getStats] Error fetching stats:', error);
        throw error;
      } finally {
        // Clear in-flight request when done (success or error)
        this.inFlightStatsRequest = null;
      }
    })();

    return this.inFlightStatsRequest;
  }

  async toggleOfficialStatus(id: string): Promise<void> {
    try {
      // Get current tag with format=full
      const response = await apiClient.get<PaginatedResponse<RawTag>>('/categories?format=full&limit=100');
      const tags = response?.data || [];
      
      if (!Array.isArray(tags)) {
        throw new Error('Failed to fetch tags');
      }
      
      const tag = tags.find(t => t.id === id);
      if (!tag) throw new Error('Tag not found');
      
      // Backend doesn't support updating isOfficial or type
      // This would need backend support
      throw new Error('Toggle official status not supported by backend');
    } catch (error: any) {
      console.error('[AdminTagsService.toggleOfficialStatus] Error:', error);
      throw error;
    }
  }

  async updateTag(id: string, updates: Partial<AdminTag>): Promise<void> {
    const payload: any = {};
    
    if (updates.name !== undefined) {
      payload.name = updates.name;
    }
    // Type field removed - all tags are treated as 'tag' type
    if (updates.status !== undefined) {
      payload.status = updates.status;
    }
    if (updates.isOfficial !== undefined) {
      payload.isOfficial = updates.isOfficial;
    }
    
    await apiClient.put(`/categories/${id}`, payload, 'adminTagsService.updateTag');
  }

  async renameTag(id: string, newName: string): Promise<void> {
    try {
      const response = await apiClient.put(`/categories/${id}`, { name: newName }, 'adminTagsService.renameTag');
      
      return response;
    } catch (error: any) {
      console.error('[AdminTagsService.renameTag] Rename failed:', error);
      throw error;
    }
  }

  async deleteTag(id: string): Promise<void> {
    try {
      // Get tag name first with format=full
      const response = await apiClient.get<PaginatedResponse<RawTag>>('/categories?format=full&limit=100');
      const tags = response?.data || [];
      
      if (!Array.isArray(tags)) {
        throw new Error('Failed to fetch tags');
      }
      
      const tag = tags.find(t => t.id === id);
      if (!tag) throw new Error('Tag not found');
      
      const tagName = tag.rawName || tag.name || '';
      if (!tagName) {
        throw new Error('Tag name not found');
      }
      
      await apiClient.delete(`/categories/${encodeURIComponent(tagName)}`);
    } catch (error: any) {
      console.error('[AdminTagsService.deleteTag] Error:', error);
      throw error;
    }
  }

  async approveRequest(id: string): Promise<void> {
    try {
      // Get tag and update status with format=full
      const response = await apiClient.get<PaginatedResponse<RawTag>>('/categories?format=full&limit=100');
      const tags = response?.data || [];
      
      if (!Array.isArray(tags)) {
        throw new Error('Failed to fetch tags');
      }
      
      const tag = tags.find(t => t.id === id);
      if (!tag) throw new Error('Tag not found');
      
      // Backend doesn't support updating tag status
      // This would need backend support
      throw new Error('Tag approval not supported by backend');
    } catch (error: any) {
      console.error('[AdminTagsService.approveRequest] Error:', error);
      throw error;
    }
  }

  async rejectRequest(id: string): Promise<void> {
    // Delete the pending tag
    await this.deleteTag(id);
  }

  async mergeTags(sourceIds: string[], targetName: string): Promise<void> {
    // Backend doesn't support tag merging
    // This would need backend support
    throw new Error('Tag merging not supported by backend');
  }

  async createTag(name: string): Promise<AdminTag> {
    try {
      // Payload only includes name and status - no legacy fields
      const response = await apiClient.post<RawTag>('/tags', { 
        name: name.trim(),
        status: 'active'
      }, 'adminTagsService.createTag');
      return mapTagToAdminTag(response);
    } catch (error: any) {
      console.error('[AdminTagsService.createTag] Error:', error);
      throw error;
    }
  }
}

export const adminTagsService = new AdminTagsService();
