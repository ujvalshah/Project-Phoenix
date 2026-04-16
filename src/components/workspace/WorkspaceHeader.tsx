import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Plus, SquareCheck } from 'lucide-react';
import { CompactAccountBadge } from './CompactAccountBadge';
import type { ProfilePageUser } from './workspaceUserDisplay';

interface WorkspaceHeaderProps {
  title: string;
  tagline: string;
  isOwner: boolean;
  selectionMode: boolean;
  onToggleSelect: () => void;
  user: ProfilePageUser;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  title,
  tagline,
  isOwner,
  selectionMode,
  onToggleSelect,
  user,
}) => {
  const navigate = useNavigate();

  const openCreateNugget = () => {
    window.dispatchEvent(new CustomEvent('nuggets:open-create-modal'));
  };

  return (
    <header className="flex flex-col gap-3 sm:gap-2 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-slate-900 dark:text-slate-50 sm:text-[1.55rem]">
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{tagline}</p>
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
        {isOwner && (
          <>
            <button
              type="button"
              onClick={openCreateNugget}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[13px] font-semibold text-white transition-all hover:bg-slate-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Plus className="h-[15px] w-[15px] shrink-0" aria-hidden />
              New nugget
            </button>
            <button
              type="button"
              onClick={() => navigate('/collections')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FolderPlus className="h-[15px] w-[15px] shrink-0" aria-hidden />
              New collection
            </button>
            <button
              type="button"
              onClick={onToggleSelect}
              aria-pressed={selectionMode}
              className={[
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                selectionMode
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                  : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              <SquareCheck className="h-[15px] w-[15px] shrink-0" aria-hidden />
              {selectionMode ? 'Selecting' : 'Select'}
            </button>
          </>
        )}
        <CompactAccountBadge user={user} isOwner={isOwner} />
      </div>
    </header>
  );
};
