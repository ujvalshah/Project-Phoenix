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
    <header className="border-b border-slate-200/60 pb-5 dark:border-slate-800/80">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 md:text-[1.75rem] md:leading-tight">
            {title}
          </h1>
          <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">{tagline}</p>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 lg:pb-0.5">
          {isOwner && (
            <>
              <button
                type="button"
                onClick={openCreateNugget}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white motion-safe:transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:focus-visible:outline-slate-100"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                New nugget
              </button>
              <button
                type="button"
                onClick={() => navigate('/collections')}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200/90 bg-white px-3 text-sm font-medium text-slate-800 motion-safe:transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 dark:focus-visible:outline-slate-200"
              >
                <FolderPlus className="h-4 w-4 shrink-0" aria-hidden />
                New collection
              </button>
              <button
                type="button"
                onClick={onToggleSelect}
                aria-pressed={selectionMode}
                className={[
                  'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-slate-200',
                  selectionMode
                    ? 'border-slate-800 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200/90 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900',
                ].join(' ')}
              >
                <SquareCheck className="h-4 w-4 shrink-0" aria-hidden />
                {selectionMode ? 'Selecting' : 'Select'}
              </button>
            </>
          )}
          <CompactAccountBadge user={user} isOwner={isOwner} />
        </div>
      </div>
    </header>
  );
};
