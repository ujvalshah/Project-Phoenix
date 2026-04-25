
import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { User as LegacyUser } from '@/types';
import { User as ModularUser } from '@/types/user';
import { LoginPayload, SignupPayload, AuthProvider as AuthProviderType } from '@/types/auth';
import { authService } from '@/services/authService';
import { apiClient } from '@/services/apiClient';
import { FeatureFlags, SignupConfig } from '@/admin/types/admin';
import { adminConfigService } from '@/admin/services/adminConfigService';
import { isTransientAuthMeError } from '@/utils/authBootstrapErrors';
import { getSafeUsernameHandle } from '@/utils/userIdentity';
import { captureException } from '@/utils/sentry';
import { shallowEqual } from '@/utils/shallowEqual';
import { clearCsrfToken } from '@/utils/csrf';
import { SEARCH_COHORT_STORAGE_KEY } from '@/utils/searchMode';

export const shallowEqualAuth = shallowEqual;

interface AuthContextType {
  user: LegacyUser | null; // Backward compatibility
  modularUser: ModularUser | null; // New Schema
  isAuthenticated: boolean;
  isLoading: boolean;
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

interface AuthStore {
  getSnapshot: () => AuthContextType;
  subscribe: (listener: () => void) => () => void;
}

const AuthContext = createContext<AuthStore | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modularUser, setModularUser] = useState<ModularUser | null>(null);
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
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(SEARCH_COHORT_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
    });
  }, []);

  const syncSearchCohortStorage = useCallback((user: ModularUser | null) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const cohort = user?.appState?.searchCohort?.trim();
      if (cohort) {
        window.localStorage.setItem(SEARCH_COHORT_STORAGE_KEY, cohort);
      } else {
        window.localStorage.removeItem(SEARCH_COHORT_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Hydrate session from HttpOnly cookies via GET /auth/me
  useEffect(() => {
    const init = async () => {
      try {
        // 1) Validate session first. This gates auth UX, so do it on the
        // critical path and unblock UI as soon as it settles.
        try {
          const freshUser = await authService.getCurrentUser();
          setModularUser(freshUser);
          syncSearchCohortStorage(freshUser);
        } catch (bootstrapErr: unknown) {
          if (isTransientAuthMeError(bootstrapErr)) {
            // Network/server error — don't clear session, user may still be authenticated
          } else {
            // 401 or other auth error — user is not authenticated
            setModularUser(null);
            syncSearchCohortStorage(null);
          }
        }
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), {
          route: 'AuthContext/init',
        });
      }

      // 2) Load config before unblocking UI so consumers (AuthModal signup
      // fields, feature-flag gates) never see a null → resolved flicker.
      try {
        const [flags, sConf] = await Promise.all([
          adminConfigService.getFeatureFlags(),
          adminConfigService.getSignupConfig(),
        ]);
        setFeatureFlags(flags);
        setSignupConfig(sConf);
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), {
          route: 'AuthContext/configInit',
        });
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [syncSearchCohortStorage]);

  // --- ADAPTER: Modular -> Legacy ---
  const legacyUser: LegacyUser | null = useMemo(() => {
    if (!modularUser) return null;
    return {
      id: modularUser.id,
      name: modularUser.profile.displayName,
      username: getSafeUsernameHandle({
        username: modularUser.profile.username,
        displayName: modularUser.profile.displayName,
        userId: modularUser.id,
      }),
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

  const openAuthModal = useCallback((view: 'login' | 'signup' = 'login') => {
      setAuthModalView(view);
      setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
      setIsAuthModalOpen(false);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await authService.loginWithEmail(payload);
    // Backend sets HttpOnly cookies; we just store user state in memory
    setModularUser(response.user);
    syncSearchCohortStorage(response.user);
    closeAuthModal();
  }, [closeAuthModal, syncSearchCohortStorage]);

  const signup = useCallback(async (payload: SignupPayload): Promise<{ needsVerification: boolean }> => {
    const response = await authService.signupWithEmail(payload);
    // Anti-enumeration: backend returns 201 without tokens when email already exists
    if (!response.token && !response.accessToken) {
      closeAuthModal();
      return { needsVerification: false };
    }
    if (response.user) {
      setModularUser(response.user);
      syncSearchCohortStorage(response.user);
    }
    closeAuthModal();
    // If email verification is enabled and the user is an email-provider
    // signup whose email is not yet verified, surface that to the caller so
    // the UI can prompt. Otherwise the user is immediately fully active.
    const needsVerification =
      !!response.user &&
      response.user.auth?.provider === 'email' &&
      response.user.auth?.emailVerified === false;
    return { needsVerification };
  }, [closeAuthModal, syncSearchCohortStorage]);

  const socialLogin = useCallback(async (provider: AuthProviderType) => {
    const response = await authService.loginWithProvider(provider);
    setModularUser(response.user);
    syncSearchCohortStorage(response.user);
    closeAuthModal();
  }, [closeAuthModal, syncSearchCohortStorage]);

  const logout = useCallback(async () => {
    // Call backend to invalidate tokens and clear HttpOnly cookies. We must
    // NOT silently swallow errors: HttpOnly cookies can only be cleared by
    // the server (Set-Cookie with Max-Age=0), so if this fails the browser
    // still holds the session and the next page load will auto-sign the
    // user back in. Surface the error to the caller so the UI can respond.
    try {
      await authService.logoutApi();
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), {
        route: 'AuthContext/logout',
      });
      throw e;
    }
    // Clear client-readable CSRF cookie defensively. HttpOnly access/refresh
    // cookies are cleared by the server response; this one we can nuke here
    // to guarantee no stale double-submit value carries into the next login.
    if (typeof document !== 'undefined') {
      document.cookie = 'csrf_token=; Path=/; Max-Age=0; SameSite=Strict';
    }
    // Drop the in-memory/sessionStorage CSRF cache so the next login starts
    // with a clean slate and doesn't replay a stale token against a new session.
    clearCsrfToken();
    setModularUser(null);
    syncSearchCohortStorage(null);
  }, [syncSearchCohortStorage]);

  const contextValue = useMemo<AuthContextType>(() => ({
      user: legacyUser, // Expose adapted legacy user
      modularUser,      // Expose new schema
      isAuthenticated: !!modularUser,
      isLoading,
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
  }), [
    legacyUser,
    modularUser,
    isLoading,
    featureFlags,
    signupConfig,
    login,
    signup,
    socialLogin,
    logout,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    authModalView,
  ]);

  const snapshotRef = useRef(contextValue);
  const listenersRef = useRef(new Set<() => void>());
  useLayoutEffect(() => {
    snapshotRef.current = contextValue;
    listenersRef.current.forEach((listener) => listener());
  }, [contextValue]);

  const store = useMemo<AuthStore>(
    () => ({
      getSnapshot: () => snapshotRef.current,
      subscribe: (listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    }),
    [],
  );

  return (
    <AuthContext.Provider value={store}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuthSelector<T>(
  selector: (state: AuthContextType) => T,
  isEqual: (prev: T, next: T) => boolean = Object.is,
): T {
  const store = useContext(AuthContext);
  if (!store) throw new Error('useAuthSelector must be used within AuthProvider');

  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);
  selectorRef.current = selector;
  isEqualRef.current = isEqual;

  const selectionRef = useRef<{ value: T } | null>(null);

  const getSelection = () => {
    const next = selectorRef.current(store.getSnapshot());
    const prev = selectionRef.current;
    if (prev && isEqualRef.current(prev.value, next)) {
      return prev.value;
    }
    selectionRef.current = { value: next };
    return next;
  };

  // getServerSnapshot returns the same selection as getSnapshot — the app is
  // an SPA with no SSR, but React requires the arg to be defined to avoid a
  // hydration warning if a server renderer is ever introduced.
  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}

/**
 * Read the full auth context. Uses shallow equality so legacy callers
 * (useAuth) only re-render when an actual field changes — not on every
 * provider commit.
 */
export const useAuthContext = (): AuthContextType => {
  return useAuthSelector((state) => state, shallowEqual);
};
