
import { 
  User, UserAuth, UserProfile, UserPreferences, UserSecurity, UserAppState 
} from '../types/user';

// Helper type for deep partial overrides
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export const createDefaultUserAuth = (overrides?: Partial<UserAuth>): UserAuth => ({
  email: '',
  emailVerified: false,
  provider: 'email',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createDefaultUserProfile = (overrides?: Partial<UserProfile>): UserProfile => ({
  displayName: 'New User',
  username: '',
  avatarColor: 'blue',
  ...overrides,
});

export const createDefaultUserSecurity = (overrides?: Partial<UserSecurity>): UserSecurity => ({
  mfaEnabled: false,
  ...overrides,
});

export const createDefaultUserPreferences = (overrides?: DeepPartial<UserPreferences>): UserPreferences => {
  const { notifications, ...rest } = overrides || {};

  return {
    theme: 'system',
    defaultVisibility: 'public',
    interestedCategories: [],
    compactMode: false,
    richMediaPreviews: true,
    autoFollowCollections: true,
    ...rest as any,
    notifications: {
      emailDigest: true,
      productUpdates: false,
      newFollowers: true,
      ...notifications,
    },
  };
};

export const createDefaultUserAppState = (overrides?: Partial<UserAppState>): UserAppState => ({
  onboardingCompleted: false,
  ...overrides,
});

export const createDefaultUser = (
  id: string, 
  email: string, 
  overrides?: DeepPartial<User>
): User => {
  return {
    id,
    role: overrides?.role || 'user',
    auth: createDefaultUserAuth({ email, ...overrides?.auth }),
    profile: createDefaultUserProfile(overrides?.profile),
    security: createDefaultUserSecurity(overrides?.security),
    preferences: createDefaultUserPreferences(overrides?.preferences),
    appState: createDefaultUserAppState(overrides?.appState),
  };
};
