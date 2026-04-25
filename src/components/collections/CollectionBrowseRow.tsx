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
  /** Resolved parent name when this row is a sub-collection. Drives icon and subtitle. */
  parentName?: string;
}

/** Lowercase, trim, strip punctuation for duplicate / near-duplicate checks. */
function normalizeForCompare(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s*[/|]+\s*/g, ' ')
    .replace(/[\u2018\u2019'"]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRedundantVersusTitle(title: string, candidate: string | undefined): boolean {
  if (!candidate?.trim()) return true;
  const nt = normalizeForCompare(title);
  const nc = normalizeForCompare(candidate);
  if (!nt || !nc) return true;
  return nt === nc;
}

/** Long taxonomy labels that only extend the title slightly (truncation / shared heading) — taxonomy only. */
function isTaxonomyNearDuplicateOfTitle(title: string, taxonomy: string): boolean {
  if (isRedundantVersusTitle(title, taxonomy)) return true;
  const nt = normalizeForCompare(title);
  const ntx = normalizeForCompare(taxonomy);
  if (nt.length < 12 || ntx.length < 12) return false;
  if (ntx.startsWith(nt) && ntx.length - nt.length <= 28) return true;
  if (nt.startsWith(ntx) && nt.length - ntx.length <= 28) return true;
  return false;
}

/**
 * Taxonomy from page is `Parent / Child` or root label (often same as collection name).
 * When the leaf repeats the title, return only the parent segment if it adds new context.
 */
function refineTaxonomySubtitle(taxonomyLabel: string, collectionName: string): string | undefined {
  const tax = taxonomyLabel.trim();
  const name = collectionName.trim();
  if (!tax) return undefined;

  const sep = ' / ';
  const idx = tax.indexOf(sep);
  if (idx === -1) {
    if (isTaxonomyNearDuplicateOfTitle(name, tax)) return undefined;
    return tax;
  }

  const parent = tax.slice(0, idx).trim();
  const child = tax.slice(idx + sep.length).trim();
  if (isRedundantVersusTitle(name, child)) {
    if (!parent || isRedundantVersusTitle(name, parent)) return undefined;
    // Very long parent labels with ultra-short titles read as internal folder noise, not browse context
    if (name.length <= 6 && parent.length > 52) return undefined;
    return parent;
  }

  if (isTaxonomyNearDuplicateOfTitle(name, tax)) return undefined;
  return tax;
}

function clipDescription(raw: string): string {
  const t = raw.trim();
  if (t.length <= 120) return t;
  return `${t.slice(0, 117)}…`;
}

/**
 * Single scan-friendly secondary line. Priority: creator → short description → refined taxonomy.
 * Omits the line when it would duplicate the title or add no new context.
 */
function resolveBrowseRowSubtitle(
  collection: Collection,
  taxonomyLabel?: string,
): string | undefined {
  const title = collection.name.trim();
  const candidates: string[] = [];

  if (collection.type !== 'private') {
    const creator = collection.creator?.name?.trim();
    if (creator && !isRedundantVersusTitle(title, creator)) {
      candidates.push(creator);
    }
  }

  const rawDesc = collection.description?.trim();
  if (rawDesc && rawDesc.length >= 10 && !isRedundantVersusTitle(title, rawDesc)) {
    candidates.push(clipDescription(rawDesc));
  }

  const tax = taxonomyLabel?.trim();
  if (tax) {
    const refined = refineTaxonomySubtitle(tax, title);
    if (refined && !isRedundantVersusTitle(title, refined)) {
      candidates.push(refined);
    }
  }

  return candidates[0];
}

export const CollectionBrowseRow: React.FC<CollectionBrowseRowProps> = ({
  collection,
  onClick,
  selectionMode,
  isSelected,
  onSelect,
  onCollectionUpdate,
  taxonomyLabel,
  parentName,
}) => {
  const { currentUserId } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const isFollowing = currentUserId ? (collection.followers || []).includes(currentUserId) : false;
  const isPrivate = collection.type === 'private';
  const isSubCollection = Boolean(collection.parentId);
  const parentSubtitle = parentName?.trim() ? `Under ${parentName.trim()}` : undefined;
  const subtitle = parentSubtitle ?? resolveBrowseRowSubtitle(collection, taxonomyLabel);
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
      ? 'pr-16 sm:pr-36'
      : !isPrivate
        ? 'pr-12 sm:pr-14'
        : 'pr-3';

  return (
    <li
      className={[
        'relative list-none bg-white dark:bg-slate-900',
        isSelected ? 'ring-2 ring-inset ring-primary-500 dark:ring-primary-400' : '',
      ].join(' ')}
    >
      <div
        className={[
          'relative flex items-stretch',
          subtitle ? 'min-h-[4.75rem]' : 'min-h-[4.25rem]',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={handleRowClick}
          onKeyDown={handleKeyDown}
          aria-pressed={selectionMode ? isSelected : undefined}
          className={[
            'flex w-full min-w-0 flex-1 items-center gap-3 py-3 text-left transition-colors',
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
              isPrivate || isSubCollection
                ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                : 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/60 dark:bg-primary-900/20 dark:text-primary-300',
            ].join(' ')}
            aria-hidden
          >
            {isPrivate ? (
              <Lock size={16} strokeWidth={2} />
            ) : isSubCollection ? (
              <Folder size={16} strokeWidth={2} />
            ) : (
              <Layers size={16} strokeWidth={2} />
            )}
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
            <p
              className={[
                'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400',
                subtitle ? 'mt-1' : 'mt-0.5',
              ].join(' ')}
            >
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

          {!selectionMode && (
            <ChevronRight
              size={18}
              className="shrink-0 self-center text-slate-400 dark:text-slate-500"
              aria-hidden
            />
          )}
        </button>

        {!selectionMode && (
          <div className="pointer-events-auto absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {!isPrivate && currentUserId ? (
              <button
                type="button"
                onClick={handleFollow}
                disabled={isLoading}
                className={[
                  'inline-flex h-11 w-11 items-center justify-center gap-1 rounded-full border px-0 text-xs font-semibold transition-colors sm:h-10 sm:w-auto sm:min-w-[5.5rem] sm:rounded-lg sm:px-2.5',
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
              <div className="hidden sm:block">
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
        )}

        {selectionMode && !isPrivate && (
          <div className="pointer-events-auto absolute right-2 top-1/2 hidden -translate-y-1/2 items-center opacity-70 sm:flex">
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
