import { AdminFeedback } from '../types/admin';
import { apiClient } from '@/services/apiClient';
import { mapFeedbackToAdminFeedback, RawFeedback } from './adminApiMappers';

interface SubmitFeedbackPayload {
  content: string;
  type?: 'bug' | 'feature' | 'general';
  user?: {
    id: string;
    name: string;
    fullName?: string;
    username?: string;
    avatar?: string;
  };
  email?: string;
}

class AdminFeedbackService {
  async listFeedback(filter: 'new' | 'read' | 'archived' | 'all'): Promise<AdminFeedback[]> {
    const params = new URLSearchParams();
    // Only append status param if not 'all'
    if (filter !== 'all') {
      params.append('status', filter);
    }
    
    const response = await apiClient.get<{ data: RawFeedback[] } | RawFeedback[]>(`/feedback?${params.toString()}`, undefined, 'adminFeedbackService.listFeedback');
    
    // Handle paginated response format { data: [...], total, ... } or direct array
    const feedback = Array.isArray(response) ? response : (response.data || []);
    
    if (!Array.isArray(feedback)) {
      console.error('Expected feedback array but got:', typeof feedback);
      return [];
    }
    
    return feedback.map(mapFeedbackToAdminFeedback);
  }

  async updateStatus(id: string, status: 'new' | 'read' | 'archived'): Promise<void> {
    await apiClient.patch(`/feedback/${id}/status`, { status });
  }

  async getStats(): Promise<{ total: number }> {
    // Get all feedback to compute total
    const response = await apiClient.get<{ data: RawFeedback[] } | RawFeedback[]>('/feedback', undefined, 'adminFeedbackService.getStats');
    
    // Handle paginated response format { data: [...], total, ... } or direct array
    const allFeedback = Array.isArray(response) ? response : (response.data || []);
    
    if (!Array.isArray(allFeedback)) {
      console.error('Expected feedback array but got:', typeof allFeedback);
      return { total: 0 };
    }
    
    return {
      total: allFeedback.length
    };
  }

  async submitFeedback(
    content: string,
    type: 'bug' | 'feature' | 'general' = 'general',
    user?: { id: string; name: string; email?: string; avatarUrl?: string },
    email?: string
  ): Promise<void> {
    const payload: SubmitFeedbackPayload = {
      content,
      type,
      email: email || user?.email,
    };

    // Include user object if provided
    if (user) {
      payload.user = {
        id: user.id,
        name: user.name,
        avatar: user.avatarUrl,
      };
    }

    await apiClient.post('/feedback', payload);
  }
}

export const adminFeedbackService = new AdminFeedbackService();
