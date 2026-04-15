import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Bookmark, BookmarkCheck, Trash2, FolderOpen, Loader2 } from 'lucide-react';
import { useToggleBookmark } from '@/hooks/useBookmarks';
import { useToast } from '@/hooks/useToast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
import type { BookmarkItemType } from '@/services/bookmarkService';
import { bookmarkService } from '@/services/bookmarkService';
import { twMerge } from 'tailwind-merge';
import { CollectionSelector } from './CollectionSelector';
import { DropdownPortal } from '@/components/UI/DropdownPortal';

/**
 * BookmarkButton Component
 *
 * YouTube x Instagram style bookmark button.
 * Features:
 * - Single tap to save/unsave
 * - Micro-animation on click
 * - Optimistic UI updates
 * - Toast with "Change" action for folder selection
 *
 * State: localStorage seeds first paint; when logged in, GET /bookmarks/status hydrates
 * and wins (also on tab focus / visibility) so icons stay aligned with the server.
 */

interface BookmarkButtonProps {
  itemId: string;
  itemType?: BookmarkItemType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  onToggle?: (bookmarked: boolean, bookmarkId?: string) => void;
  onChangeCollection?: (bookmarkId: string) => void;
}

function getBookmarkErrorMessage(_error: unknown, fallback: string): string {
  return fallback;
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5', // 14px
  md: 'w-4 h-4',     // 16px - matches CardActions iconSize
  lg: 'w-5 h-5'      // 20px
};

const buttonSizeClasses = {
  sm: 'p-1',
  md: 'p-1.5',
  lg: 'p-2'
};

function BookmarkButtonInner({
  itemId,
  itemType = 'nugget',
  size = 'md',
  showLabel = false,
  className,
  onToggle,
  onChangeCollection
}: BookmarkButtonProps) {
  const toast = useToast();
  const { withAuth } = useRequireAuth();
  const { user } = useAuthSelector(
    (a) => ({ user: a.user }),
    shallowEqualAuth,
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Initialize from localStorage for instant state (no API call)
  const [isBookmarked, setIsBookmarked] = useState(() =>
    bookmarkService.isLocallyBookmarked(itemId)
  );
  const [bookmarkId, setBookmarkId] = useState<string | undefined>(undefined);
  /** All private folder (BookmarkCollection) ids for this bookmark — passed to folder picker */
  const [folderIds, setFolderIds] = useState<string[]>([]);

  // Private folder picker (portaled to modal layer)
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);

  // Mini-menu state (for already-bookmarked items)
  const [showBookmarkMenu, setShowBookmarkMenu] = useState(false);
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);

  // Sync with localStorage when itemId changes (e.g., navigating between items)
  useEffect(() => {
    setIsBookmarked(bookmarkService.isLocallyBookmarked(itemId));
    setBookmarkId(undefined);
    setFolderIds([]);
  }, [itemId]);

  // Hydrate from server when authenticated (server wins over localStorage)
  useEffect(() => {
    if (!user?.id) {
      setIsBookmarked(bookmarkService.isLocallyBookmarked(itemId));
      return;
    }

    let cancelled = false;
    const hydrate = async () => {
      try {
        const status = await bookmarkService.getStatus(itemId, itemType);
        if (cancelled) return;
        setIsBookmarked(status.isBookmarked);
        bookmarkService.syncLocalFromServer(itemId, status.isBookmarked);
        if (status.isBookmarked && status.bookmarkId) {
          setBookmarkId(status.bookmarkId);
          setFolderIds(status.collectionIds);
        } else {
          setBookmarkId(undefined);
          setFolderIds([]);
        }
      } catch {
        // Keep current UI if status fetch fails
      }
    };

    void hydrate();

    const onReconcile = () => {
      if (document.visibilityState === 'visible') {
        void hydrate();
      }
    };
    document.addEventListener('visibilitychange', onReconcile);
    window.addEventListener('focus', onReconcile);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onReconcile);
      window.removeEventListener('focus', onReconcile);
    };
  }, [user?.id, itemId, itemType]);

  // Toggle mutation
  const toggleMutation = useToggleBookmark();

  // Handler to open folder picker (refresh membership from server first)
  const handleOpenCollectionSelector = useCallback(async () => {
    setIsFetchingStatus(true);
    try {
      const status = await bookmarkService.getStatus(itemId, itemType);
      if (status.isBookmarked && status.bookmarkId) {
        setBookmarkId(status.bookmarkId);
        setFolderIds(status.collectionIds);
        setIsBookmarked(true);
        bookmarkService.syncLocalFromServer(itemId, true);
        setShowBookmarkMenu(false);
        setShowCollectionSelector(true);
      } else {
        toast.error('Bookmark not found');
      }
    } catch {
      toast.error('Failed to load bookmark info');
    } finally {
      setIsFetchingStatus(false);
    }
  }, [itemId, itemType, toast]);

  // Handler to remove bookmark
  const handleRemoveBookmark = useCallback(() => {
    setShowBookmarkMenu(false);

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    // Optimistic update
    setIsBookmarked(false);

    // Perform toggle (remove)
    toggleMutation.mutate(
      { itemId, itemType },
      {
        onSuccess: (data) => {
          setIsBookmarked(data.bookmarked);
          setBookmarkId(undefined);
          setFolderIds([]);
          bookmarkService.syncLocalFromServer(itemId, data.bookmarked);
          onToggle?.(data.bookmarked, undefined);
          toast.info('Removed from Bookmarks', { duration: 2000 });
        },
        onError: (error) => {
          setIsBookmarked(true);
          toast.error(getBookmarkErrorMessage(error, 'Failed to remove bookmark'));
        }
      }
    );
  }, [itemId, itemType, toggleMutation, onToggle, toast]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't proceed if not logged in
      if (!user) {
        withAuth(() => {})();
        return;
      }

      // If already bookmarked, show menu instead of toggling
      if (isBookmarked) {
        setShowBookmarkMenu(true);
        return;
      }

      // Trigger animation
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);

      // Optimistic update
      setIsBookmarked(true);

      // Perform toggle (add bookmark)
      toggleMutation.mutate(
        { itemId, itemType },
        {
          onSuccess: (data) => {
            setIsBookmarked(data.bookmarked);
            setBookmarkId(data.bookmarkId);
            const nextFolders = data.defaultCollectionId ? [data.defaultCollectionId] : [];
            setFolderIds(nextFolders);
            bookmarkService.syncLocalFromServer(itemId, data.bookmarked);

            // Notify parent
            onToggle?.(data.bookmarked, data.bookmarkId);

            // Show toast with action
            if (data.bookmarked) {
              toast.success('Added to Bookmarks', {
                actionLabel: 'Folders',
                onAction: () => {
                  setShowCollectionSelector(true);
                },
                duration: 4000
              });
            }
          },
          onError: (error) => {
            // Rollback optimistic update
            setIsBookmarked(false);
            toast.error(getBookmarkErrorMessage(error, 'Failed to add bookmark'));
          }
        }
      );
    },
    [itemId, itemType, isBookmarked, toggleMutation, withAuth, user, onToggle, toast]
  );

  const Icon = isBookmarked ? BookmarkCheck : Bookmark;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid="bookmark-button"
        onClick={handleClick}
        disabled={toggleMutation.isPending || isFetchingStatus}
        className={twMerge(
          'inline-flex items-center justify-center transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          buttonSizeClasses[size],
          isAnimating && 'scale-125',
          className
        )}
        aria-label={isBookmarked ? 'Bookmark options' : 'Add bookmark'}
        aria-pressed={isBookmarked}
        aria-haspopup={isBookmarked ? 'menu' : undefined}
      >
        <Icon
          className={twMerge(
            sizeClasses[size],
            'transition-colors duration-150',
            isBookmarked
              ? 'text-primary-600 dark:text-primary-500'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
            isAnimating && 'scale-110'
          )}
          fill="none"
          strokeWidth={1.5}
        />
        {showLabel && (
          <span
            className={twMerge(
              'text-sm font-medium',
              isBookmarked
                ? 'text-primary-600 dark:text-primary-500'
                : 'text-slate-600 dark:text-slate-300'
            )}
          >
            {isBookmarked ? 'Saved' : 'Save'}
          </span>
        )}
      </button>

      {/* Bookmark Menu (for already-bookmarked items) */}
      <BookmarkMenu
        isOpen={showBookmarkMenu}
        onClose={() => setShowBookmarkMenu(false)}
        onRemove={handleRemoveBookmark}
        onChangeCollection={handleOpenCollectionSelector}
        isLoading={isFetchingStatus}
        anchorRef={buttonRef}
      />

      {/* Folder picker — portaled to #modal-root (above card overflow) */}
      {bookmarkId && (
        <CollectionSelector
          bookmarkId={bookmarkId}
          itemId={itemId}
          initialCollectionIds={folderIds}
          isOpen={showCollectionSelector}
          onClose={() => setShowCollectionSelector(false)}
          onCollectionChange={(nextFolderIds) => {
            setFolderIds(nextFolderIds);
            onChangeCollection?.(bookmarkId);
          }}
          anchorRef={buttonRef}
        />
      )}
    </>
  );
}

// Memoize to prevent unnecessary re-renders
export const BookmarkButton = memo(BookmarkButtonInner);

/**
 * BookmarkMenu Component
 *
 * Mini-menu shown when clicking on an already-bookmarked item.
 * Options: Remove bookmark, Change folder
 */
interface BookmarkMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onRemove: () => void;
  onChangeCollection: () => void;
  isLoading?: boolean;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

function BookmarkMenu({
  isOpen,
  onClose,
  onRemove,
  onChangeCollection,
  isLoading = false,
  anchorRef,
}: BookmarkMenuProps) {
  if (!anchorRef) return null;

  return (
    <DropdownPortal
      isOpen={isOpen}
      anchorRef={anchorRef}
      align="right"
      host="popover"
      offsetY={4}
      onClickOutside={onClose}
      className={twMerge(
        'w-44 bg-white dark:bg-gray-900 rounded-lg shadow-xl',
        'border border-gray-200 dark:border-gray-700',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        'py-1 overflow-hidden',
      )}
    >
      <div role="menu" aria-label="Bookmark options">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChangeCollection();
          }}
          disabled={isLoading}
          className={twMerge(
            'w-full flex items-center gap-2.5 px-3 py-2.5 text-left',
            'text-sm text-gray-700 dark:text-gray-200',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            'transition-colors duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          role="menuitem"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          ) : (
            <FolderOpen className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
          <span>Change Folder</span>
        </button>

        <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={twMerge(
            'w-full flex items-center gap-2.5 px-3 py-2.5 text-left',
            'text-sm text-red-600 dark:text-red-400',
            'hover:bg-red-50 dark:hover:bg-red-900/20',
            'transition-colors duration-150',
          )}
          role="menuitem"
        >
          <Trash2 className="w-4 h-4" />
          <span>Remove Bookmark</span>
        </button>
      </div>
    </DropdownPortal>
  );
}

/**
 * Controlled BookmarkButton for when parent manages state.
 * Useful for optimistic updates in parent component.
 */
interface ControlledBookmarkButtonProps {
  isBookmarked: boolean;
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  onClick: (e: React.MouseEvent) => void;
}

function ControlledBookmarkButtonInner({
  isBookmarked,
  isLoading = false,
  size = 'md',
  showLabel = false,
  className,
  onClick
}: ControlledBookmarkButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Trigger animation
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);

      onClick(e);
    },
    [onClick]
  );

  const Icon = isBookmarked ? BookmarkCheck : Bookmark;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={twMerge(
        'inline-flex items-center justify-center transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        buttonSizeClasses[size],
        isAnimating && 'scale-125',
        className
      )}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      aria-pressed={isBookmarked}
    >
      <Icon
        className={twMerge(
          sizeClasses[size],
          'transition-colors duration-150',
          isBookmarked
            ? 'text-primary-600 dark:text-primary-500'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
          isAnimating && 'scale-110'
        )}
        fill="none"
        strokeWidth={1.5}
      />
      {showLabel && (
        <span
          className={twMerge(
            'text-sm font-medium',
            isBookmarked
              ? 'text-primary-600 dark:text-primary-500'
              : 'text-slate-600 dark:text-slate-300'
          )}
        >
          {isBookmarked ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  );
}

export const ControlledBookmarkButton = memo(ControlledBookmarkButtonInner);
