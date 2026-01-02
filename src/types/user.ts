
export type UserRole = 'admin' | 'user';
export type ThemePreference = 'light' | 'dark' | 'system';
export type Visibility = 'public' | 'private';
export type AvatarColor = 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'teal' | 'indigo' | 'slate';

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

export interface UserPreferences {
  // General
  theme: ThemePreference;
  defaultVisibility: Visibility;
  
  // Feed & Content
  interestedCategories: string[];
  compactMode: boolean;
  richMediaPreviews: boolean;
  autoFollowCollections: boolean;
  
  // Notifications
  notifications: {
    emailDigest: boolean;
    productUpdates: boolean;
    newFollowers: boolean;
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
  
  auth: UserAuth;
  profile: UserProfile;
  security: UserSecurity;
  preferences: UserPreferences;
  appState: UserAppState;
}
