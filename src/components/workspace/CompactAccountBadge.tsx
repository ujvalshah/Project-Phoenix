import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/shared/Avatar';
import {
  getWorkspaceAccountRole,
  getWorkspaceAvatarUrl,
  getWorkspaceDisplayName,
  type ProfilePageUser,
} from './workspaceUserDisplay';

interface CompactAccountBadgeProps {
  user: ProfilePageUser;
  isOwner: boolean;
}

export const CompactAccountBadge: React.FC<CompactAccountBadgeProps> = ({ user, isOwner }) => {
  const name = getWorkspaceDisplayName(user);
  const avatarUrl = getWorkspaceAvatarUrl(user);
  const role = getWorkspaceAccountRole(user);

  const inner = (
    <div className="flex min-w-0 max-w-[200px] items-center gap-2 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/60">
      <Avatar name={name} src={avatarUrl} size="sm" className="shrink-0 ring-1 ring-slate-200/60 dark:ring-slate-700" />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{name}</p>
        <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{role}</p>
      </div>
    </div>
  );

  if (isOwner) {
    return (
      <Link
        to="/account"
        className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-slate-200"
        title="Account settings"
      >
        {inner}
      </Link>
    );
  }

  return <div className="shrink-0">{inner}</div>;
};
