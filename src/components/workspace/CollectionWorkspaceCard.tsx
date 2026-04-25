import React, { useState } from 'react';
import { ArrowRight, Check, Folder, Layers, Lock, Plus } from 'lucide-react';
import type { Collection } from '@/types';
import { formatDate } from '@/utils/formatters';
import { ShareMenu } from '@/components/shared/ShareMenu';
import { useAuth } from '@/hooks/useAuth';
import { storageService } from '@/services/storageService';
import { useToast } from '@/hooks/useToast';
import { buildCollectionShareUrl } from '@/sharing/urlBuilder';

interface CollectionWorkspaceCardProps {
  collection: Collection;
  onOpen: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onCollectionUpdate?: (updated: Collection) => void;
}

export const CollectionWorkspaceCard: React.FC<CollectionWorkspaceCardProps> = ({
  collection,
  onOpen,
  selectionMode,
  isSelected,
  onSelect,
  onCollectionUpdate,
}) => {
  const { currentUserId } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const isPrivate = collection.type === 'private';
  const isFollowing = currentUserId ? (collection.followers || []).includes(currentUserId) : false;
  const count = collection.validEntriesCount ?? collection.entries?.length ?? 0;
  const updatedLabel = formatDate(collection.updatedAt || collection.createdAt, false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId || isLoading || isPrivate) return;

    const wasFollowing = isFollowing;
    const previousFollowersCount = collection.followersCount;

    const optimisticCollection: Collection = {
      ...collection,
      followers: wasFollowing
        ? (collection.followers || []).filter((id) => id !== currentUserId)
        : [...(collection.followers || []), currentUserId],
      followersCount: wasFollowing ? Math.max(0, previousFollowersCount - 1) : previousFollowersCount + 1,
    };
    onCollectionUpdate?.(optimisticCollection);

    setIsLoading(true);
    try {
      if (wasFollowing) {
        await storageService.unfollowCollection(collection.id);
      } else {
        await storageService.followCollection(collection.id);
        window.dispatchEvent(new CustomEvent('nugget:collection-follow'));
      }
      try {
        const refetched = await storageService.getCollectionById(collection.id);
        if (refetched && onCollectionUpdate) onCollectionUpdate(refetched);
      } catch {
        /* keep optimistic */
      }
    } catch (error: unknown) {
      onCollectionUpdate?.(collection);
      const msg =
        error && typeof error === 'object' && 'requestId' in error
          ? `Could not update follow state (ref: ${String((error as { requestId?: string }).requestId)})`
          : 'Could not update follow state';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      e.preventDefault();
      onSelect(collection.id);
    } else {
      onOpen();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectionMode) onSelect(collection.id);
      else onOpen();
    }
  };

  return (
    <article
      className={[
        'relative flex h-full flex-col overflow-hidden rounded-md bg-slate-50/80 motion-safe:transition-colors dark:bg-slate-900/30',
        isSelected
          ? 'ring-1 ring-slate-900 ring-offset-2 ring-offset-slate-50 dark:ring-slate-100 dark:ring-offset-slate-950'
          : 'ring-1 ring-slate-200/50 hover:ring-slate-300/70 dark:ring-slate-800 dark:hover:ring-slate-600',
      ].join(' ')}
    >
      {selectionMode && (
        <div className="absolute right-2.5 top-2.5 z-10">
          <div
            className={[
              'flex h-5 w-5 items-center justify-center rounded border',
              isSelected
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-300 bg-white/90 dark:border-slate-600 dark:bg-slate-950/90',
            ].join(' ')}
            aria-hidden
          >
            {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
          </div>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-pressed={selectionMode ? isSelected : undefined}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        className="flex flex-1 flex-col p-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-200 dark:focus-visible:ring-offset-slate-950"
      >
        <div className="flex items-start gap-3">
          <div
            className="relative flex h-11 w-[3.25rem] shrink-0 items-center justify-center rounded-sm bg-slate-200/50 dark:bg-slate-800/80"
            aria-hidden
          >
            <div className="absolute left-1 top-1 h-5 w-7 rounded-[2px] bg-white/90 ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-600" />
            <div className="absolute left-1.5 top-1.5 h-5 w-7 rounded-[2px] bg-white ring-1 ring-slate-200/80 dark:bg-slate-700 dark:ring-slate-600" />
            <Folder className="relative z-[1] h-4 w-4 text-slate-600 dark:text-slate-300" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPrivate ? 'Folder' : 'Collection'}
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-slate-900 dark:text-slate-50">
              {collection.name}
            </h2>
          </div>
          {!selectionMode && !isPrivate && currentUserId && (
            <button
              type="button"
              onClick={handleFollow}
              disabled={isLoading}
              className="shrink-0 rounded border border-slate-200/80 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {isFollowing ? (
                'Following'
              ) : (
                <span className="inline-flex items-center gap-0.5">
                  <Plus className="h-3 w-3" aria-hidden />
                  Follow
                </span>
              )}
            </button>
          )}
        </div>

        {collection.description?.trim() && (
          <p className="mt-2 line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-400">
            {collection.description.trim()}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3 w-3" aria-hidden />
            {count} items
          </span>
          <span>Updated {updatedLabel}</span>
          {isPrivate && (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Lock className="h-3 w-3" aria-hidden />
              Private
            </span>
          )}
        </div>
      </div>

      {!selectionMode && (
        <div className="flex items-center justify-between border-t border-slate-200/40 px-2.5 py-1.5 dark:border-slate-800/60">
          <div>
            {!isPrivate && (
              <ShareMenu
                data={{
                  type: 'collection',
                  id: collection.id,
                  title: collection.name,
                  shareUrl: buildCollectionShareUrl(collection.id),
                }}
                surface="collection_workspace_card"
                meta={{ text: collection.description }}
                className="rounded p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                iconSize={15}
              />
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 dark:text-slate-300 dark:hover:text-slate-100 dark:focus-visible:outline-slate-200"
          >
            Open
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
      )}
    </article>
  );
};
