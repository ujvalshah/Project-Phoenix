
export interface UserPreferences {
  defaultVisibility: 'public' | 'private';
  compactMode: boolean;
  richMediaPreviews: boolean;
  autoFollowCollections: boolean;
}

export interface ProfileFormData {
  displayName: string;
  username: string;
  bio: string;
  phoneNumber: string;
  avatarColor?: string;
  // Future fields
  location?: string;
  website?: string;
}

export type AvatarColor = 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'teal' | 'indigo' | 'slate';

export const AVATAR_COLORS: { [key in AvatarColor]: string } = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
  slate: 'bg-slate-500',
};
