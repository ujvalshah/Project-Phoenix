import React, { useState } from 'react';
import { Check, ChevronRight, Clock3, Folder, Layers, Lock, Plus, Users } from 'lucide-react';
import type { Collection } from '@/types';
import { ShareMenu } from '@/components/shared/ShareMenu';
import { useAuth } from '@/hooks/useAuth';
import { storageService } from '@/services/storageService';
import { useToast } from '@/hooks/useToast';
import { formatDate } from '@/utils/formatters';

export interface CollectionBrowseRowProps {
  collection: Collection;
  onClick: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onCollectionUpdate?: (updatedCollection: Collection) => void;
  taxonomyLabel?: string;
}

/**
 * Secondary line priority for scan-first browse:
 * 1) taxonomy path, 2) creator display name, 3) short description excerpt (no placeholder copy).
 */
function browseRowSubtitle(collection: Collection, taxonomyLabel?: string): string | undefined {
  const tax = taxonomyLabel?.trim();
  if (tax) return tax;
  const creatorName = collection.creator?.name?.trim();
  if (creatorName) return creatorName;
  const raw = collection.description?.trim();
  if (!raw) return undefined;
  return raw.length > 140 ? `${raw.slice(0, 137)}…` : raw;
}

export const CollectionBrowseRow: React.FC<CollectionBrowseRowProps> = ({
  collection,
  onClick,
  selectionMode,
  isSelected,
  onSelect,
  onCollectionUpdate,
  taxonomyLabel,
}) => {
  const { currentUserId } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const isFollowing = currentUserId ? (collection.followers || []).includes(currentUserId) : false;
  const isPrivate = collection.type === 'private';
  const subtitle = browseRowSubtitle(collection, taxonomyLabel);
  const nuggetCount = collection.validEntriesCount ?? collection.entries?.length ?? 0;
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
        const updatedCollection = await storageService.getCollectionById(collection.id);
        if (updatedCollection && onCollectionUpdate) {
          onCollectionUpdate(updatedCollection);
        }
      } catch (refetchError: unknown) {
        console.warn('Failed to refetch collection after follow/unfollow:', refetchError);
      }
    } catch (error: unknown) {
      onCollectionUpdate?.(collection);
      const errorMessage =
        error && typeof error === 'object' && 'requestId' in error
          ? `Failed to ${wasFollowing ? 'unfollow' : 'follow'} collection (Request ID: ${String((error as { requestId?: string }).requestId)})`
          : `Failed to ${wasFollowing ? 'unfollow' : 'follow'} collection`;
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowActivate = () => {
    if (selectionMode && onSelect) {
      onSelect(collection.id);
    } else if (!selectionMode) {
      onClick();
    }
  };

  const handleRowClick = () => {
    handleRowActivate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowActivate();
    }
  };

  const reserveRightPad = selectionMode
    ? !isPrivate
      ? 'pr-14'
      : 'pr-3'
    : !isPrivate && currentUserId
      ? 'pr-[7.5rem] sm:pr-36'
      : !isPrivate
        ? 'pr-14'
        : 'pr-3';

  return (
    <li
      className={[
        'relative list-none border-b border-slate-100 bg-white last:border-b-0 dark:border-slate-800 dark:bg-slate-900',
        isSelected ? 'ring-2 ring-inset ring-primary-500 dark:ring-primary-400' : '',
      ].join(' ')}
    >
      <div className="relative flex min-h-[4.5rem] items-stretch">
        <button
          type="button"
          onClick={handleRowClick}
          onKeyDown={handleKeyDown}
          aria-pressed={selectionMode ? isSelected : undefined}
          className={[
            'flex w-full min-w-0 flex-1 items-center gap-3 py-2.5 text-left transition-colors',
            'cursor-pointer hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 dark:hover:bg-slate-800/60 dark:focus-visible:ring-primary-400',
            'pl-3',
            reserveRightPad,
          ].join(' ')}
        >
          {selectionMode ? (
            <div className="flex shrink-0 items-center justify-center" aria-hidden>
              <div
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm transition-colors',
                  isSelected
                    ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900/80',
                ].join(' ')}
              >
                {isSelected && <Check size={14} strokeWidth={3} />}
              </div>
            </div>
          ) : null}

          <div
            className={[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              isPrivate
                ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                : 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/60 dark:bg-primary-900/20 dark:text-primary-300',
            ].join(' ')}
            aria-hidden
          >
            {isPrivate ? <Lock size={16} strokeWidth={2} /> : <Layers size={16} strokeWidth={2} />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-[0.9375rem] font-semibold leading-snug text-slate-900 dark:text-slate-50">
              {collection.name}
            </p>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-slate-500 dark:text-slate-400" title={subtitle}>
                {subtitle}
              </p>
            ) : null}
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
              <span className="inline-flex shrink-0 items-center gap-1" title="Nuggets">
                <Folder size={12} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                {nuggetCount}
              </span>
              {!isPrivate && (
                <>
                  <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                    ·
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1" title="Followers">
                    <Users size={12} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                    {collection.followersCount ?? 0}
                  </span>
                </>
              )}
              <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                ·
              </span>
              <span className="inline-flex min-w-0 items-center gap-1 truncate" title="Updated">
                <Clock3 size={12} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                <span className="truncate">{updatedLabel}</span>
              </span>
            </p>
          </div>

          <ChevronRight
            size={18}
            className="shrink-0 self-center text-slate-400 dark:text-slate-500"
            aria-hidden
          />
        </button>

        {!selectionMode && (
          <div className="pointer-events-auto absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {!isPrivate && currentUserId ? (
              <button
                type="button"
                onClick={handleFollow}
                disabled={isLoading}
                className={[
                  'inline-flex h-10 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors sm:min-w-[5.5rem]',
                  isFollowing
                    ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-900/25 dark:text-green-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                  isLoading ? 'cursor-not-allowed opacity-50' : '',
                ].join(' ')}
                aria-label={isFollowing ? 'Unfollow collection' : 'Follow collection'}
              >
                {isFollowing ? (
                  <Check size={16} strokeWidth={2.5} />
                ) : (
                  <Plus size={16} strokeWidth={2.5} />
                )}
                <span className="hidden sm:inline">{isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            ) : null}
            {!isPrivate && (
              <ShareMenu
                data={{
                  type: 'collection',
                  id: collection.id,
                  title: collection.name,
                  shareUrl: `${window.location.origin}/collections/${collection.id}`,
                }}
                meta={{ text: collection.description }}
                className="rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                iconSize={16}
              />
            )}
          </div>
        )}

        {selectionMode && !isPrivate && (
          <div className="pointer-events-auto absolute right-2 top-1/2 flex -translate-y-1/2 items-center opacity-70">
            <ShareMenu
              data={{
                type: 'collection',
                id: collection.id,
                title: collection.name,
                shareUrl: `${window.location.origin}/collections/${collection.id}`,
              }}
              meta={{ text: collection.description }}
              className="rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              iconSize={16}
            />
          </div>
        )}
      </div>
    </li>
  );
};
