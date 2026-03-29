import { AdminContactMessage } from '../types/admin';
import { apiClient } from '@/services/apiClient';
import { mapContactToAdminContact, RawContactMessage } from './adminApiMappers';

type ContactFilter = 'new' | 'read' | 'replied' | 'archived' | 'all';

class AdminContactService {
  async listMessages(filter: ContactFilter): Promise<AdminContactMessage[]> {
    const params = new URLSearchParams();
    if (filter !== 'all') {
      params.append('status', filter);
    }

    const response = await apiClient.get<{ data: RawContactMessage[] } | RawContactMessage[]>(
      `/contact?${params.toString()}`, undefined, 'adminContactService.listMessages'
    );

    const messages = Array.isArray(response) ? response : (response.data || []);

    if (!Array.isArray(messages)) {
      console.error('Expected contact messages array but got:', typeof messages);
      return [];
    }

    return messages.map(mapContactToAdminContact);
  }

  async updateStatus(id: string, status: 'new' | 'read' | 'replied' | 'archived'): Promise<void> {
    await apiClient.patch(`/contact/${id}/status`, { status });
  }

  async deleteMessage(id: string): Promise<void> {
    await apiClient.delete(`/contact/${id}`);
  }
}

export const adminContactService = new AdminContactService();
