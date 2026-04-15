import type { User as LegacyUser } from '@/types';
import type { User as ModularUser } from '@/types/user';

export type ProfilePageUser = LegacyUser | ModularUser;

function isModularUser(user: ProfilePageUser): user is ModularUser {
  return 'profile' in user && user.profile !== undefined && typeof user.profile === 'object';
}

export function getWorkspaceDisplayName(user: ProfilePageUser): string {
  if (isModularUser(user)) {
    return user.profile.displayName?.trim() || 'Member';
  }
  return user.name?.trim() || 'Member';
}

export function getWorkspaceHandle(user: ProfilePageUser): string | null {
  if (isModularUser(user)) {
    const u = user.profile.username?.trim();
    return u ? `@${u}` : null;
  }
  const legacy = user as LegacyUser;
  const u = legacy.username?.trim();
  return u ? `@${u}` : null;
}

export function getWorkspaceRoleLine(user: ProfilePageUser): string | null {
  if (isModularUser(user)) {
    const title = user.profile.title?.trim();
    const company = user.profile.company?.trim();
    if (title && company) return `${title} · ${company}`;
    if (title) return title;
    if (company) return company;
    return user.profile.bio?.trim() || null;
  }
  const legacy = user as LegacyUser;
  return legacy.bio?.trim() || null;
}

export function getWorkspaceAvatarUrl(user: ProfilePageUser): string | undefined {
  if (isModularUser(user)) {
    return user.profile.avatarUrl;
  }
  return (user as LegacyUser).avatarUrl;
}

export function getWorkspaceJoinedLabel(user: ProfilePageUser): string | null {
  try {
    let iso: string | undefined;
    if (isModularUser(user)) {
      iso = user.auth.createdAt;
    } else {
      iso = (user as LegacyUser).joinedAt;
    }
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `Joined ${d.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
  } catch {
    return null;
  }
}

export function getWorkspaceAccountRole(user: ProfilePageUser): string {
  return user.role === 'admin' ? 'Admin' : 'Editor';
}
