import { AdminUser, AdminUserStatus, AdminRole } from '../types/admin';
import { apiClient } from '@/services/apiClient';
import { mapUserToAdminUser } from './adminApiMappers';
import { User } from '@/types/user';

/**
 * Subset of profile fields editable from the admin drawer (PR10 / P1.8).
 * Intentionally narrow: PII (phoneNumber, dateOfBirth, gender, pincode, city,
 * country) is excluded — admins see the public-allowlist projection, not
 * the raw user record. Anything that needs to flow through here must pass
 * the same validation as a self-edit (`updateUserSchema` on the backend).
 */
export interface AdminProfileEdits {
  displayName?: string;
  bio?: string;
  title?: string;
  company?: string;
  location?: string;
  website?: string;
  twitter?: string;
  linkedin?: string;
}

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

  async getStats(): Promise<{ total: number; active: number; suspended: number; banned: number; newToday: number; admins: number }> {
    // PR10 / P1.7 — read the canonical stats from the dedicated admin endpoint
    // instead of reconstructing them from the user list. Reconstruction lied
    // about active vs suspended (the field didn't exist), and any pagination
    // capped the totals to whatever fit in the first page.
    type StatsResponse = {
      users?: {
        total?: number;
        active?: number;
        suspended?: number;
        banned?: number;
        newToday?: number;
        admins?: number;
      };
    };

    try {
      const response = await apiClient.get<StatsResponse>('/admin/stats', undefined, 'adminUsersService.getStats');
      const u = response.users ?? {};
      return {
        total: u.total ?? 0,
        active: u.active ?? 0,
        suspended: u.suspended ?? 0,
        banned: u.banned ?? 0,
        newToday: u.newToday ?? 0,
        admins: u.admins ?? 0,
      };
    } catch (err) {
      throw new Error('Failed to load canonical admin stats', { cause: err });
    }
  }

  async updateUserRole(id: string, role: AdminRole): Promise<void> {
    await apiClient.put(`/users/${id}`, { role });
  }

  /**
   * PR10 / P1.8 — persisted profile edit from the admin drawer. PUT /api/users/:id
   * already runs the updateUserSchema and the field-tier check that rejects
   * non-admin role changes (PR8); we pass through only the documented edit
   * subset. The backend resolves nested writes via `profile.*`.
   */
  async updateUserProfile(id: string, edits: AdminProfileEdits): Promise<User> {
    // The PUT endpoint accepts a flat `name` (mapped to profile.displayName
    // for legacy callers) and a nested `profile` object. We use the nested
    // form for everything except displayName so the schema validates
    // cleanly and the audit log captures field-level diffs.
    const body: Record<string, unknown> = {};
    if (edits.displayName !== undefined) {
      body.name = edits.displayName;
    }
    const profile: Record<string, unknown> = {};
    if (edits.bio !== undefined) profile.bio = edits.bio;
    if (edits.title !== undefined) profile.title = edits.title;
    if (edits.company !== undefined) profile.company = edits.company;
    if (edits.location !== undefined) profile.location = edits.location;
    if (edits.website !== undefined) profile.website = edits.website;
    if (edits.twitter !== undefined) profile.twitter = edits.twitter;
    if (edits.linkedin !== undefined) profile.linkedin = edits.linkedin;
    if (Object.keys(profile).length > 0) body.profile = profile;

    return apiClient.put<User>(`/users/${id}`, body);
  }

  // ── Lifecycle (PR7b backend, re-enabled in the UI by PR10) ────────────────
  // Each call is idempotent on the backend (a no-op transition still returns
  // 200 + writes an audit row with wasAlreadyInState: true).
  async suspendUser(id: string, reason?: string): Promise<{ status: AdminUserStatus; sessionsRevoked: boolean; auditPersisted?: boolean; revocationFailureReason?: string }> {
    return apiClient.post<{ status: AdminUserStatus; sessionsRevoked: boolean; auditPersisted?: boolean; revocationFailureReason?: string }>(
      `/admin/users/${id}/suspend`,
      reason ? { reason } : {},
    );
  }

  async banUser(id: string, reason?: string): Promise<{ status: AdminUserStatus; sessionsRevoked: boolean; auditPersisted?: boolean; revocationFailureReason?: string }> {
    return apiClient.post<{ status: AdminUserStatus; sessionsRevoked: boolean; auditPersisted?: boolean; revocationFailureReason?: string }>(
      `/admin/users/${id}/ban`,
      reason ? { reason } : {},
    );
  }

  async activateUser(id: string, reason?: string): Promise<{ status: AdminUserStatus; sessionsRevoked: boolean; auditPersisted?: boolean; revocationFailureReason?: string }> {
    return apiClient.post<{ status: AdminUserStatus; sessionsRevoked: boolean; auditPersisted?: boolean; revocationFailureReason?: string }>(
      `/admin/users/${id}/activate`,
      reason ? { reason } : {},
    );
  }

  async revokeUserSessions(id: string, reason?: string): Promise<{ tokenVersion: number; refreshTokensRevoked: boolean; auditPersisted?: boolean; revocationFailureReason?: string }> {
    return apiClient.post<{ tokenVersion: number; refreshTokensRevoked: boolean; auditPersisted?: boolean; revocationFailureReason?: string }>(
      `/admin/users/${id}/revoke-sessions`,
      reason ? { reason } : {},
    );
  }

  async updateUserSearchCohort(
    id: string,
    searchCohort: string | null,
  ): Promise<{ message: string; searchCohort: string | null; auditPersisted?: boolean }> {
    return apiClient.patch<{ message: string; searchCohort: string | null; auditPersisted?: boolean }>(
      `/admin/users/${id}/search-cohort`,
      { searchCohort },
    );
  }

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  }
}

export const adminUsersService = new AdminUsersService();
