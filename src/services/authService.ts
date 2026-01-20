
import { User as LegacyUser } from '../types';
import { User as ModularUser } from '../types/user';
import { LoginPayload, SignupPayload, AuthProvider } from '../types/auth';
import { apiClient } from './apiClient';
import { createDefaultUser } from '../models/userDefaults';
import { mapAuthError } from '../utils/errorMessages';

// Helper: Map Backend User Data (Legacy format) -> Frontend Modular Schema
const mapLegacyToModular = (legacy: LegacyUser): ModularUser => {
  return createDefaultUser(legacy.id, legacy.email, {
    role: legacy.role,
    auth: {
      createdAt: legacy.joinedAt,
      emailVerified: legacy.emailVerified || false,
      provider: legacy.authProvider || 'email',
    },
    profile: {
      displayName: legacy.name,
      username: legacy.username || legacy.email.split('@')[0],
      phoneNumber: legacy.phoneNumber,
      avatarUrl: legacy.avatarUrl,
      pincode: legacy.pincode,
      city: legacy.city,
      country: legacy.country,
      gender: legacy.gender,
      dateOfBirth: legacy.dateOfBirth,
      website: legacy.website,
      bio: legacy.bio,
      location: legacy.location,
    },
    preferences: {
      interestedCategories: legacy.preferences?.interestedCategories || [],
    },
    appState: {
      lastLoginAt: legacy.lastFeedVisit
    }
  });
};

// Helper: Check if user data is in modular format (new backend) or legacy format
const isModularUser = (user: any): user is ModularUser => {
  return user && user.auth && user.profile && user.preferences && user.appState;
};

// Helper: Normalize user data from backend (handles both legacy and modular formats)
const normalizeUserFromBackend = (user: any): ModularUser => {
  // If already in modular format, return as-is (with id field)
  if (isModularUser(user)) {
    return {
      ...user,
      id: user.id || (user as any)._id?.toString() || ''
    };
  }
  
  // Otherwise, map from legacy format
  return mapLegacyToModular(user as LegacyUser);
};

/**
 * Auth response from backend with new token structure
 */
interface AuthResponse {
  user: any;
  token: string; // Legacy field (access token)
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number; // Seconds until access token expires
}

class AuthService {
  async loginWithEmail(payload: LoginPayload): Promise<{
    user: ModularUser;
    token: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    try {
      // Call real backend API - backend now returns modular User structure with tokens
      const response = await apiClient.post<AuthResponse>('/auth/login', payload);

      // Normalize backend user to frontend ModularUser format
      const modularUser = normalizeUserFromBackend(response.user);

      return {
        user: modularUser,
        token: response.accessToken || response.token,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn,
      };
    } catch (error: any) {
      // Map backend error to user-friendly message
      const userMessage = mapAuthError(error, 'login');
      throw new Error(userMessage);
    }
  }

  async signupWithEmail(payload: SignupPayload): Promise<{
    user: ModularUser;
    token: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    try {
      // Call real backend API - backend now returns modular User structure with tokens
      const response = await apiClient.post<AuthResponse>('/auth/signup', payload);

      // Normalize backend user to frontend ModularUser format
      const modularUser = normalizeUserFromBackend(response.user);

      return {
        user: modularUser,
        token: response.accessToken || response.token,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn,
      };
    } catch (error: any) {
      // Map backend error to user-friendly message
      const userMessage = mapAuthError(error, 'signup');
      throw new Error(userMessage);
    }
  }

  async loginWithProvider(provider: AuthProvider): Promise<{ user: ModularUser; token: string }> {
    // Deferred feature — backend support pending
    // TODO: Implement social login when backend endpoints are ready
    // For now, throw an error indicating it's not implemented
    throw new Error(`Social login with ${provider} is not yet implemented`);
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      await apiClient.post('/auth/forgot-password', { email });
    } catch (error: any) {
      // Backend always returns success to prevent enumeration
      // Only throw if it's a real error (network, 5xx)
      if (error?.response?.status >= 500) {
        throw new Error('Unable to process your request. Please try again later.');
      }
      // Ignore other errors - treat as success
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post('/auth/reset-password', { token, password: newPassword });
    } catch (error: any) {
      const userMessage = mapAuthError(error, 'password_reset');
      throw new Error(userMessage);
    }
  }

  async changePassword(current: string, next: string): Promise<void> {
    // Deferred feature — backend support pending
    // TODO: Implement when backend endpoint is ready
    throw new Error('Change password is not yet implemented');
  }

  async verifyEmail(token: string): Promise<void> {
    await apiClient.get('/auth/verify-email', { params: { token } });
  }

  async resendVerification(email: string): Promise<void> {
    await apiClient.post('/auth/resend-verification', { email });
  }

  async logoutApi(refreshToken?: string): Promise<void> {
    try {
      // Call backend to invalidate tokens (blacklist access token, revoke refresh token)
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore logout errors - we'll clear local state regardless
    }
  }

  async logoutAllDevices(): Promise<void> {
    try {
      // Call backend to logout from all devices
      await apiClient.post('/auth/logout-all', {});
    } catch {
      // Ignore errors - we'll clear local state regardless
    }
  }

  async getSessions(): Promise<any[]> {
    try {
      const response = await apiClient.get<{ sessions: any[]; count: number }>('/auth/sessions');
      return response.sessions || [];
    } catch {
      return [];
    }
  }
}

export const authService = new AuthService();
