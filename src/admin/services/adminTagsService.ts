import { apiClient } from '@/services/apiClient';

interface RawTag {
  id: string;
  status?: 'active' | 'deprecated' | 'pending';
}

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

  async getStats(): Promise<{ total: number; totalTags: number; pending: number }> {
    // Reuse in-flight request if one exists (prevents duplicate concurrent fetches)
    if (this.inFlightStatsRequest) {
      return this.inFlightStatsRequest;
    }

    // Create and store the in-flight request
    this.inFlightStatsRequest = (async () => {
      try {
        const response = await apiClient.get<PaginatedResponse<RawTag>>('/categories?format=full&limit=100', undefined, 'adminTagsService.getStats');
        const tags = response?.data || [];

        if (!Array.isArray(tags)) {
          return { total: 0, totalTags: 0, pending: 0 };
        }

        return {
          total: response?.total || tags.length,
          totalTags: tags.filter(t => t.status !== 'pending').length,
          pending: tags.filter(t => t.status === 'pending').length
        };
      } catch (error: unknown) {
        throw error;
      } finally {
        this.inFlightStatsRequest = null;
      }
    })();

    return this.inFlightStatsRequest;
  }

  /**
   * Reorder dimension tags in the toolbar.
   * @param dimension - 'format' or 'domain'
   * @param options.tagIds - Ordered array of tag IDs (custom mode)
   * @param options.mode - Auto-sort mode: 'a-z', 'most-nuggets', 'latest'
   */
  async reorderToolbarTags(dimension: 'format' | 'domain', options: { tagIds?: string[]; mode?: string }): Promise<void> {
    const payload: Record<string, unknown> = { dimension };
    if (options.tagIds) payload.tagIds = options.tagIds;
    if (options.mode) payload.mode = options.mode;
    await apiClient.post('/categories/taxonomy/reorder', payload);
  }
}

export const adminTagsService = new AdminTagsService();
