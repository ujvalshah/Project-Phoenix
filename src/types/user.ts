
export type UserRole = 'admin' | 'user';
export type ThemePreference = 'light' | 'dark' | 'system';
export type Visibility = 'public' | 'private';
export type AvatarColor = 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'teal' | 'indigo' | 'slate';
/**
 * Account lifecycle, mirrored from the backend's User.status enum (PR7b).
 * `active` is the default for legacy docs that predate the migration; the
 * admin lifecycle endpoints (suspend/ban/activate) are the only sanctioned
 * write path.
 */
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface UserAuth {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly provider: 'email' | 'google' | 'linkedin';
  readonly createdAt: string; // ISO Date
  updatedAt?: string; // ISO Date
}

export interface UserProfile {
  displayName: string;
  username: string;
  bio?: string;
  avatarUrl?: string; // Custom image
  avatarColor?: AvatarColor; // Fallback color
  phoneNumber?: string;
  location?: string; // Legacy/Display
  // New Fields
  pincode?: string;
  city?: string;
  country?: string;
  gender?: string;
  dateOfBirth?: string;
  website?: string;
  // Professional fields
  title?: string;
  company?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  instagram?: string;
  facebook?: string;
}

export interface UserSecurity {
  lastPasswordChangeAt?: string; // ISO Date
  mfaEnabled: boolean;
}

export type NotificationFrequency = 'instant' | 'daily' | 'weekly' | 'none';

export interface UserPreferences {
  theme: ThemePreference;
  interestedCategories: string[];
  notifications: {
    emailDigest: boolean;
    productUpdates: boolean;
    newFollowers: boolean;
    pushEnabled: boolean;
    frequency: NotificationFrequency;
    categoryFilter: string[];
    quietHoursStart?: string;
    quietHoursEnd?: string;
  };
}

export interface UserAppState {
  lastLoginAt?: string;
  onboardingCompleted: boolean;
  featureFlags?: Record<string, boolean>;
}

// The Modular User Aggregate
export interface User {
  readonly id: string;
  readonly role: UserRole; // Critical for routing
  /**
   * Lifecycle state. Optional because legacy docs predate PR7b's migration
   * and read back without the field; treat undefined as 'active'.
   */
  status?: UserStatus;

  auth: UserAuth;
  profile: UserProfile;
  security: UserSecurity;
  preferences: UserPreferences;
  appState: UserAppState;
}
