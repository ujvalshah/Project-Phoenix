
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User as LegacyUser } from '@/types';
import { User as ModularUser } from '@/types/user';
import { LoginPayload, SignupPayload, AuthProvider as AuthProviderType } from '@/types/auth';
import { authService } from '@/services/authService';
import { FeatureFlags, SignupConfig } from '@/admin/types/admin';
import { adminConfigService } from '@/admin/services/adminConfigService';

interface AuthContextType {
  user: LegacyUser | null; // Backward compatibility
  modularUser: ModularUser | null; // New Schema
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  featureFlags: FeatureFlags | null;
  signupConfig: SignupConfig | null;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  socialLogin: (provider: AuthProviderType) => Promise<void>;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: (view?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  authModalView: 'login' | 'signup';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'nuggets_auth_data_v2'; // Bumped version for schema change

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modularUser, setModularUser] = useState<ModularUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags | null>(null);
  const [signupConfig, setSignupConfig] = useState<SignupConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'login' | 'signup'>('login');

  // Hydrate from storage & Load Flags
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Load Auth
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const stored = localStorage.getItem(AUTH_STORAGE_KEY);
            if (stored) {
              const { user: storedUser, token: storedToken } = JSON.parse(stored);
              setModularUser(storedUser);
              setToken(storedToken);
            }
          } catch (e) {
            console.warn("Failed to load auth from storage", e);
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.removeItem(AUTH_STORAGE_KEY);
            }
          }
        }
        
        // 2. Load Global Config
        const [flags, sConf] = await Promise.all([
            adminConfigService.getFeatureFlags(),
            adminConfigService.getSignupConfig()
        ]);
        setFeatureFlags(flags);
        setSignupConfig(sConf);

      } catch (e) {
        console.error("Initialization failed", e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const persistAuth = (u: ModularUser, t: string) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: u, token: t }));
      }
    } catch (e) {
      console.warn('Failed to persist auth to storage:', e);
    }
    setModularUser(u);
    setToken(t);
  };

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
    persistAuth(response.user, response.token);
    closeAuthModal();
  };

  const signup = async (payload: SignupPayload) => {
    const response = await authService.signupWithEmail(payload);
    persistAuth(response.user, response.token);
    closeAuthModal();
  };

  const socialLogin = async (provider: AuthProviderType) => {
    const response = await authService.loginWithProvider(provider);
    persistAuth(response.user, response.token);
    closeAuthModal();
  };

  const logout = async () => {
    try {
        await authService.logoutApi();
    } catch (e) {
        console.error("Logout API failed", e);
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to remove auth from storage:', e);
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
