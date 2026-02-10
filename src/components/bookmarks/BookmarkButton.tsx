import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkCheck, Trash2, FolderOpen, Loader2 } from 'lucide-react';
import { useToggleBookmark } from '@/hooks/useBookmarks';
import { useToast } from '@/hooks/useToast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/hooks/useAuth';
import type { BookmarkItemType } from '@/services/bookmarkService';
import { bookmarkService } from '@/services/bookmarkService';
import { twMerge } from 'tailwind-merge';
import { CollectionSelector } from './CollectionSelector';

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
 * HYBRID APPROACH:
 * - Uses localStorage for instant initial state (no API call on mount)
 * - Server is source of truth (synced on toggle)
 * - Avoids N+1 API calls while maintaining state across sessions
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
  const { user } = useAuth();
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Initialize from localStorage for instant state (no API call)
  const [isBookmarked, setIsBookmarked] = useState(() =>
    bookmarkService.isLocallyBookmarked(itemId)
  );
  const [bookmarkId, setBookmarkId] = useState<string | undefined>(undefined);
  const [defaultCollectionId, setDefaultCollectionId] = useState<string | undefined>(undefined);

  // Collection selector state
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);

  // Mini-menu state (for already-bookmarked items)
  const [showBookmarkMenu, setShowBookmarkMenu] = useState(false);
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);

  // Sync with localStorage when itemId changes (e.g., navigating between items)
  useEffect(() => {
    setIsBookmarked(bookmarkService.isLocallyBookmarked(itemId));
    // Reset bookmarkId when itemId changes
    setBookmarkId(undefined);
  }, [itemId]);

  // Toggle mutation
  const toggleMutation = useToggleBookmark();

  // Fetch bookmark status to get bookmarkId (for already-bookmarked items)
  const fetchBookmarkStatus = useCallback(async () => {
    if (bookmarkId) return bookmarkId; // Already have it

    setIsFetchingStatus(true);
    try {
      const status = await bookmarkService.getStatus(itemId, itemType);
      if (status.isBookmarked && status.bookmarkId) {
        setBookmarkId(status.bookmarkId);
        if (status.collectionIds.length > 0) {
          setDefaultCollectionId(status.collectionIds[0]);
        }
        return status.bookmarkId;
      }
    } catch (error) {
      toast.error('Failed to load bookmark info');
    } finally {
      setIsFetchingStatus(false);
    }
    return undefined;
  }, [itemId, itemType, bookmarkId, toast]);

  // Handler to open collection selector
  const handleOpenCollectionSelector = useCallback(async () => {
    // Ensure we have bookmarkId before opening
    const id = await fetchBookmarkStatus();
    if (id) {
      setShowBookmarkMenu(false);
      setShowCollectionSelector(true);
    }
  }, [fetchBookmarkStatus]);

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
          setDefaultCollectionId(undefined);
          onToggle?.(data.bookmarked, undefined);
          toast.info('Removed from Bookmarks', { duration: 2000 });
        },
        onError: () => {
          setIsBookmarked(true);
          toast.error('Failed to remove bookmark');
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
            setDefaultCollectionId(data.defaultCollectionId);

            // Notify parent
            onToggle?.(data.bookmarked, data.bookmarkId);

            // Show toast with action
            if (data.bookmarked) {
              toast.success('Added to Bookmarks', {
                actionLabel: 'Change',
                onAction: () => {
                  // Open collection selector
                  setShowCollectionSelector(true);
                },
                duration: 4000
              });
            }
          },
          onError: () => {
            // Rollback optimistic update
            setIsBookmarked(false);
            toast.error('Failed to add bookmark');
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

      {/* Collection Selector Modal - renders via portal */}
      {bookmarkId && (
        <CollectionSelector
          bookmarkId={bookmarkId}
          itemId={itemId}
          currentCollectionIds={defaultCollectionId ? [defaultCollectionId] : []}
          isOpen={showCollectionSelector}
          onClose={() => setShowCollectionSelector(false)}
          onCollectionChange={() => {
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
  anchorRef
}: BookmarkMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    // Small delay to prevent immediate close from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate position
  const getPosition = useCallback(() => {
    if (!anchorRef?.current) {
      return { top: 100, left: 100 };
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const menuWidth = 180;

    let left = rect.right - menuWidth;
    let top = rect.bottom + 4;

    // Ensure it doesn't go off-screen on the left
    if (left < 8) {
      left = 8;
    }

    // Ensure it doesn't go off-screen on the right
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }

    // If not enough space below, position above
    const menuHeight = 100;
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - 4;
      if (top < 8) {
        top = 8;
      }
    }

    return { top, left };
  }, [anchorRef]);

  if (!isOpen) return null;

  const position = getPosition();

  return createPortal(
    <>
      {/* Backdrop (transparent, just for click handling) */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu */}
      <div
        ref={menuRef}
        className={twMerge(
          'fixed z-50 w-44 bg-white dark:bg-gray-900 rounded-lg shadow-xl',
          'border border-gray-200 dark:border-gray-700',
          'animate-in fade-in-0 zoom-in-95 duration-150',
          'py-1'
        )}
        style={{
          top: position.top,
          left: position.left
        }}
        role="menu"
        aria-label="Bookmark options"
      >
        {/* Change Folder option */}
        <button
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
            'disabled:opacity-50 disabled:cursor-not-allowed'
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

        {/* Divider */}
        <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

        {/* Remove option */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={twMerge(
            'w-full flex items-center gap-2.5 px-3 py-2.5 text-left',
            'text-sm text-red-600 dark:text-red-400',
            'hover:bg-red-50 dark:hover:bg-red-900/20',
            'transition-colors duration-150'
          )}
          role="menuitem"
        >
          <Trash2 className="w-4 h-4" />
          <span>Remove Bookmark</span>
        </button>
      </div>
    </>,
    document.body
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
