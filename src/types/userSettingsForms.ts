import { AvatarColor, Visibility, ThemePreference } from './user';

export interface ProfileFormValues {
  displayName: string;
  username: string;
  bio: string;
  phoneNumber: string;
  avatarColor: AvatarColor;
  location: string;
  website: string;
}

export interface PreferencesFormValues {
  theme: ThemePreference;
  defaultVisibility: Visibility;
  compactMode: boolean;
  richMediaPreviews: boolean;
  autoFollowCollections: boolean;
}

// Security form is often separate due to sensitive fields
export interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

