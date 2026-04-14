
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User as LegacyUser } from '@/types';
import { User as ModularUser } from '@/types/user';
import { LoginPayload, SignupPayload, AuthProvider as AuthProviderType } from '@/types/auth';
import { authService } from '@/services/authService';
import { apiClient } from '@/services/apiClient';
import { FeatureFlags, SignupConfig } from '@/admin/types/admin';
import { adminConfigService } from '@/admin/services/adminConfigService';
import { isTransientAuthMeError } from '@/utils/authBootstrapErrors';

interface AuthContextType {
  user: LegacyUser | null; // Backward compatibility
  modularUser: ModularUser | null; // New Schema
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  featureFlags: FeatureFlags | null;
  signupConfig: SignupConfig | null;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<{ needsVerification: boolean }>;
  socialLogin: (provider: AuthProviderType) => Promise<void>;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: (view?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  authModalView: 'login' | 'signup';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modularUser, setModularUser] = useState<ModularUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [signupConfig, setSignupConfig] = useState<SignupConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'login' | 'signup'>('login');

  // Clear legacy localStorage data from previous versions
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('nuggets_auth_data_v2');
      }
    } catch {
      // Ignore
    }
  }, []);

  // Register session-expired callback with apiClient
  useEffect(() => {
    apiClient.onSessionExpired(() => {
      setModularUser(null);
      setToken(null);
    });
  }, []);

  // Hydrate session from HttpOnly cookies via GET /auth/me
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Validate session — HttpOnly cookie sent automatically via credentials: 'include'
        try {
          const freshUser = await authService.getCurrentUser();
          setModularUser(freshUser);
          setToken('cookie'); // Sentinel value — actual token is in HttpOnly cookie
        } catch (bootstrapErr: unknown) {
          if (isTransientAuthMeError(bootstrapErr)) {
            // Network/server error — don't clear session, user may still be authenticated
          } else {
            // 401 or other auth error — user is not authenticated
            setModularUser(null);
            setToken(null);
          }
        }

        // 2. Load Global Config
        const [flags, sConf] = await Promise.all([
          adminConfigService.getFeatureFlags(),
          adminConfigService.getSignupConfig(),
        ]);
        setFeatureFlags(flags);
        setSignupConfig(sConf);
      } catch (e) {
        console.error('Initialization failed', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // --- ADAPTER: Modular -> Legacy ---
  const legacyUser: LegacyUser | null = useMemo(() => {
    if (!modularUser) return null;
    return {
      id: modularUser.id,
      name: modularUser.profile.displayName,
      username: modularUser.profile.username,
      email: modularUser.auth.email,
      role: modularUser.role,
      status: 'active', // Default
      joinedAt: modularUser.auth.createdAt,
      authProvider: modularUser.auth.provider,
      emailVerified: modularUser.auth.emailVerified,
      phoneNumber: modularUser.profile.phoneNumber,
      avatarUrl: modularUser.profile.avatarUrl,
      preferences: {
        interestedCategories: modularUser.preferences.interestedCategories
      },
      lastFeedVisit: modularUser.appState.lastLoginAt
    };
  }, [modularUser]);

  const login = async (payload: LoginPayload) => {
    const response = await authService.loginWithEmail(payload);
    // Backend sets HttpOnly cookies; we just store user state in memory
    setModularUser(response.user);
    setToken('cookie');
    closeAuthModal();
  };

  const signup = async (payload: SignupPayload): Promise<{ needsVerification: boolean }> => {
    const response = await authService.signupWithEmail(payload);
    // Anti-enumeration: backend returns 201 without tokens when email already exists
    if (!response.token && !response.accessToken) {
      closeAuthModal();
      return { needsVerification: false };
    }
    if (response.user) {
      setModularUser(response.user);
      setToken('cookie');
    }
    closeAuthModal();
    return { needsVerification: false };
  };

  const socialLogin = async (provider: AuthProviderType) => {
    const response = await authService.loginWithProvider(provider);
    setModularUser(response.user);
    setToken('cookie');
    closeAuthModal();
  };

  const logout = async () => {
    // Call backend to invalidate tokens and clear HttpOnly cookies
    try {
      await authService.logoutApi();
    } catch (e) {
      console.error('Logout API failed', e);
    }
    setModularUser(null);
    setToken(null);
  };

  const openAuthModal = useCallback((view: 'login' | 'signup' = 'login') => {
      setAuthModalView(view);
      setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
      setIsAuthModalOpen(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user: legacyUser, // Expose adapted legacy user
      modularUser,      // Expose new schema
      isAuthenticated: !!modularUser,
      isLoading,
      token,
      featureFlags,
      signupConfig,
      login,
      signup,
      socialLogin,
      logout,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      authModalView
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within AuthProvider");
  return context;
};
