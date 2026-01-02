import { AdminUser, AdminUserStatus, AdminRole } from '../types/admin';
import { apiClient } from '@/services/apiClient';
import { mapUserToAdminUser } from './adminApiMappers';
import { User } from '@/types/user';

class AdminUsersService {
  async listUsers(query?: string): Promise<AdminUser[]> {
    // Use query param for backend filtering if available, otherwise client-side filter
    const endpoint = query ? `/users?q=${encodeURIComponent(query)}` : '/users';
    const response = await apiClient.get<{ data: User[] } | User[]>(endpoint, undefined, 'adminUsersService.listUsers');
    
    // Handle paginated response format { data: [...], total, ... } or direct array
    const users = Array.isArray(response) ? response : (response.data || []);
    
    // Map to AdminUser format
    return users.map(user => mapUserToAdminUser(user));
  }

  async getUserDetails(id: string): Promise<AdminUser | undefined> {
    const user = await apiClient.get<User>(`/users/${id}`).catch(() => undefined);
    if (!user) return undefined;
    return mapUserToAdminUser(user);
  }

  async getStats(): Promise<{ total: number; active: number; newToday: number; admins: number }> {
    const response = await apiClient.get<{ data: User[]; total?: number } | User[]>('/users', undefined, 'adminUsersService.getStats');
    
    // Handle paginated response format { data: [...], total, ... } or direct array
    const users = Array.isArray(response) ? response : (response.data || []);
    
    // Ensure users is an array
    if (!Array.isArray(users)) {
      console.error('Expected users array but got:', typeof users, users);
      return { total: 0, active: 0, newToday: 0, admins: 0 };
    }
    
    const now = new Date();
    const todayStr = now.toDateString();
    
    // Compute stats from users
    const total = users.length;
    const active = users.length; // Backend doesn't track status, assume all active
    const newToday = users.filter(u => {
      const createdAt = u.auth?.createdAt;
      if (!createdAt) return false;
      const joinedDate = new Date(createdAt).toDateString();
      return joinedDate === todayStr;
    }).length;
    const admins = users.filter(u => u.role === 'admin').length;
    
    return { total, active, newToday, admins };
  }

  async updateUserStatus(id: string, status: AdminUserStatus): Promise<void> {
    // Backend doesn't have status field, this would need backend support
    // For now, we can't update status via API
    throw new Error('User status update not supported by backend');
  }

  async updateUserRole(id: string, role: AdminRole): Promise<void> {
    await apiClient.put(`/users/${id}`, { role });
  }

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  }
}

export const adminUsersService = new AdminUsersService();
