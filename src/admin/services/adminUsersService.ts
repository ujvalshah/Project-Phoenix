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

  /**
   * Manually verify a user's email (admin action)
   * @param userId - The ID of the user to verify
   * @returns The updated user data with verification status
   */
  async verifyUserEmail(userId: string): Promise<{ message: string; user: AdminUser }> {
    const response = await apiClient.patch<{ message: string; user: any }>(
      `/admin/users/${userId}/verify-email`,
      {}
    );

    // Map the returned user to AdminUser format
    const mappedUser: AdminUser = {
      id: response.user.id,
      name: response.user.profile?.displayName || '',
      fullName: response.user.profile?.displayName || '',
      username: response.user.profile?.username || '',
      email: response.user.auth?.email || '',
      emailVerified: response.user.auth?.emailVerified ?? false,
      authProvider: response.user.auth?.provider ?? 'email',
      role: response.user.role === 'admin' ? 'admin' : 'user',
      status: 'active',
      avatarUrl: response.user.profile?.avatarUrl,
      joinedAt: response.user.auth?.createdAt || '',
      lastLoginAt: response.user.appState?.lastLoginAt,
      stats: {
        nuggets: 0,
        nuggetsPublic: 0,
        nuggetsPrivate: 0,
        collections: 0,
        collectionsFollowing: 0,
        reports: 0
      }
    };

    return {
      message: response.message,
      user: mappedUser
    };
  }
}

export const adminUsersService = new AdminUsersService();
