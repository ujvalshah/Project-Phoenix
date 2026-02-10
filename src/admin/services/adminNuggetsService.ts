import { AdminNugget, AdminNuggetStatus } from '../types/admin';
import { apiClient } from '@/services/apiClient';
import { mapArticleToAdminNugget, RawReport } from './adminApiMappers';
import { Article } from '@/types';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

class AdminNuggetsService {
  // In-flight request guard to prevent duplicate concurrent stats requests
  private inFlightStatsRequest: Promise<{ total: number; flagged: number; createdToday: number; public: number; private: number }> | null = null;

  async listNuggets(filter?: 'all' | 'flagged' | 'hidden'): Promise<AdminNugget[]> {
    try {
      // Fetch articles and reports in parallel for better performance
      // Request high limit (100) to get all items for admin panel
      const [articlesResponse, reportsResponse] = await Promise.all([
        apiClient.get<PaginatedResponse<Article>>('/articles?limit=100'),
        apiClient.get<PaginatedResponse<RawReport>>('/moderation/reports')
      ]);
      
      // Backend always returns paginated response format { data: [...], total, ... }
      // Handle case where response might be null/undefined or missing data property
      if (!articlesResponse) {
        console.error('[AdminNuggetsService.listNuggets] Articles response is null/undefined');
        return [];
      }
      if (!reportsResponse) {
        console.error('[AdminNuggetsService.listNuggets] Reports response is null/undefined');
        return [];
      }
      
      // Handle paginated response format { data: [...], total, ... }
      // Also handle backward compatibility if response is already an array (shouldn't happen)
      const articles = Array.isArray(articlesResponse) 
        ? articlesResponse 
        : (articlesResponse.data || []);
      const reports = Array.isArray(reportsResponse)
        ? reportsResponse
        : (reportsResponse.data || []);
      
      // Ensure we have arrays
      if (!Array.isArray(articles)) {
        console.error('[AdminNuggetsService.listNuggets] Expected articles array but got:', typeof articles);
        return [];
      }
      if (!Array.isArray(reports)) {
        console.error('[AdminNuggetsService.listNuggets] Expected reports array but got:', typeof reports);
        return [];
      }
      
      // Filter out null/undefined/invalid articles before processing
      const validArticles = articles.filter(a => a != null && typeof a === 'object' && a.id != null);
      if (validArticles.length !== articles.length) {
        console.warn(`[AdminNuggetsService.listNuggets] Filtered out ${articles.length - validArticles.length} invalid articles`);
      }
      
      // Filter by visibility (only show public in admin list)
      let filtered = validArticles.filter(a => a && a.visibility === 'public');
      const flaggedArticleIds = new Set(
        reports
          .filter(r => r.targetType === 'nugget' && r.status === 'open')
          .map(r => r.targetId)
      );
      
      // Map articles to AdminNuggets with report counts
      // Add null check to prevent errors if article is somehow undefined
      const nuggets = filtered
        .filter(article => article != null && article.id != null) // Double-check for null/undefined
        .map(article => {
          try {
            const reportsCount = flaggedArticleIds.has(article.id) 
              ? reports.filter(r => r.targetId === article.id).length 
              : 0;
            return mapArticleToAdminNugget(article, reportsCount);
          } catch (error) {
            // Only log errors in development to prevent console spam
            if (process.env.NODE_ENV === 'development') {
              console.error('[AdminNuggetsService.listNuggets] Error mapping article:', article, error);
            }
            return null;
          }
        })
        .filter((nugget): nugget is AdminNugget => nugget != null); // Remove any null results from failed mappings
      
      // Apply filter
      if (filter === 'flagged') {
        return nuggets.filter(n => n.status === 'flagged');
      }
      if (filter === 'hidden') {
        return nuggets.filter(n => n.status === 'hidden');
      }
      
      return nuggets;
    } catch (error: any) {
      console.error('[AdminNuggetsService.listNuggets] Error fetching nuggets:', error);
      throw error;
    }
  }

  async getNuggetDetails(id: string): Promise<AdminNugget | undefined> {
    try {
      const article = await apiClient.get<Article>(`/articles/${id}`);
      
      // Get reports for this article
      const reportsResponse = await apiClient.get<PaginatedResponse<RawReport>>('/moderation/reports');
      const reports = Array.isArray(reportsResponse)
        ? reportsResponse
        : (reportsResponse?.data || []);
      
      if (!Array.isArray(reports)) {
        console.error('[AdminNuggetsService.getNuggetDetails] Expected reports array but got:', typeof reports, reportsResponse);
        return mapArticleToAdminNugget(article, 0);
      }
      
      const reportsCount = reports.filter(r => r.targetId === id && r.targetType === 'nugget').length;
      
      return mapArticleToAdminNugget(article, reportsCount);
    } catch (error: any) {
      console.error('[AdminNuggetsService.getNuggetDetails] Error fetching nugget details:', error);
      throw error;
    }
  }

  async getStats(): Promise<{ total: number; flagged: number; createdToday: number; public: number; private: number }> {
    // Reuse in-flight request if one exists (prevents duplicate concurrent fetches)
    if (this.inFlightStatsRequest) {
      return this.inFlightStatsRequest;
    }

    // Create and store the in-flight request
    this.inFlightStatsRequest = (async () => {
      try {
        // Use the optimized backend admin stats endpoint which uses MongoDB aggregation
        // This correctly counts ALL articles, not just the first 100
        const statsResponse = await apiClient.get<{
          nuggets: {
            total: number;
            public: number;
            private: number;
            createdToday: number;
            flagged: number;
            pendingModeration: number;
          };
        }>('/admin/stats', undefined, 'adminNuggetsService.getStats');
        
        if (!statsResponse || !statsResponse.nuggets) {
          console.error('[AdminNuggetsService.getStats] Invalid stats response:', statsResponse);
          return { total: 0, flagged: 0, createdToday: 0, public: 0, private: 0 };
        }
        
        return {
          total: statsResponse.nuggets.total || 0,
          flagged: statsResponse.nuggets.flagged || 0,
          createdToday: statsResponse.nuggets.createdToday || 0,
          public: statsResponse.nuggets.public || 0,
          private: statsResponse.nuggets.private || 0,
        };
      } catch (error: any) {
        console.error('[AdminNuggetsService.getStats] Error fetching stats:', error);
        throw error;
      } finally {
        // Clear in-flight request when done (success or error)
        this.inFlightStatsRequest = null;
      }
    })();

    return this.inFlightStatsRequest;
  }

  async updateNuggetStatus(id: string, status: AdminNuggetStatus): Promise<void> {
    // Backend doesn't have status field for articles
    // For 'hidden', we could delete the article, but that's destructive
    // For 'flagged', we rely on reports
    // This would need backend support for article status
    if (status === 'hidden') {
      // Option: Delete article (destructive) or add backend status field
      throw new Error('Hiding articles not supported by backend. Use delete instead.');
    }
    // For 'active' or 'flagged', status is determined by reports
  }

  async deleteNugget(id: string): Promise<void> {
    await apiClient.delete(`/articles/${id}`);
  }
}

export const adminNuggetsService = new AdminNuggetsService();
