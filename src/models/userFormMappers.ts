
import { User, UserProfile, UserPreferences } from '../types/user';
import { ProfileFormValues, PreferencesFormValues } from '../types/userSettingsForms';

// --- PROFILE ---

export const userToProfileForm = (user: User): ProfileFormValues => ({
  displayName: user.profile.displayName,
  username: user.profile.username,
  bio: user.profile.bio || '',
  phoneNumber: user.profile.phoneNumber || '',
  avatarColor: user.profile.avatarColor || 'blue',
  location: user.profile.city ? `${user.profile.city}, ${user.profile.country}` : (user.profile.location || ''),
  website: user.profile.website || '',
});

export const profileFormToUpdatePayload = (form: ProfileFormValues): Partial<UserProfile> => ({
  displayName: form.displayName,
  username: form.username,
  bio: form.bio,
  phoneNumber: form.phoneNumber,
  avatarColor: form.avatarColor,
  location: form.location,
  website: form.website,
});

// --- PREFERENCES ---

export const userToPreferencesForm = (user: User): PreferencesFormValues => ({
  theme: user.preferences.theme,
  defaultVisibility: user.preferences.defaultVisibility,
  compactMode: user.preferences.compactMode,
  richMediaPreviews: user.preferences.richMediaPreviews,
  autoFollowCollections: user.preferences.autoFollowCollections,
});

export const preferencesFormToUpdatePayload = (form: PreferencesFormValues): Partial<UserPreferences> => ({
  ...form
});
