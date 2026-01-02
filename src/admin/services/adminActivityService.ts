import { AdminActivityEvent } from '../types/admin';

class AdminActivityService {
  /**
   * Activity log is not supported by backend.
   * This service computes activity from other data sources.
   */
  async listActivityEvents(limit: number = 50): Promise<AdminActivityEvent[]> {
    // Backend doesn't have activity log endpoint
    // Return empty array for now
    // In future, could compute from:
    // - User logins (from user.lastLoginAt)
    // - Article creations (from articles)
    // - Report resolutions (from reports)
    // - Collection creations (from collections)
    
    return [];
  }

  async addEvent(event: Omit<AdminActivityEvent, 'id' | 'timestamp'>): Promise<void> {
    // Backend doesn't support activity logging
    // This is a no-op for now
    console.warn('Activity logging not supported by backend');
  }
}

export const adminActivityService = new AdminActivityService();
