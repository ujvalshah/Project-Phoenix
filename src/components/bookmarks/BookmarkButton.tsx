import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
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
 * - Toast with "Change" action for collection selection
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
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
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

  // Sync with localStorage when itemId changes (e.g., navigating between items)
  useEffect(() => {
    setIsBookmarked(bookmarkService.isLocallyBookmarked(itemId));
  }, [itemId]);

  // Toggle mutation
  const toggleMutation = useToggleBookmark();

  // Handler to open collection selector
  const handleOpenCollectionSelector = useCallback(() => {
    setShowCollectionSelector(true);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't proceed if not logged in
      if (!user) {
        withAuth(() => {})();
        return;
      }

      // Trigger animation
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);

      // Optimistic update
      const previousState = isBookmarked;
      setIsBookmarked(!isBookmarked);

      // Perform toggle
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
                  handleOpenCollectionSelector();
                },
                duration: 4000
              });
            } else {
              toast.info('Removed from Bookmarks', {
                duration: 2000
              });
            }
          },
          onError: () => {
            // Rollback optimistic update
            setIsBookmarked(previousState);
            toast.error('Failed to update bookmark');
          }
        }
      );
    },
    [itemId, itemType, isBookmarked, toggleMutation, withAuth, user, onToggle, toast, handleOpenCollectionSelector]
  );

  const Icon = isBookmarked ? BookmarkCheck : Bookmark;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        disabled={toggleMutation.isPending}
        className={twMerge(
          'inline-flex items-center gap-1.5 rounded-md transition-all duration-200',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
            'transition-all duration-200',
            isBookmarked
              ? 'fill-blue-500 text-blue-500'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            isAnimating && 'scale-110'
          )}
        />
        {showLabel && (
          <span
            className={twMerge(
              'text-sm font-medium',
              isBookmarked
                ? 'text-blue-500'
                : 'text-gray-600 dark:text-gray-300'
            )}
          >
            {isBookmarked ? 'Saved' : 'Save'}
          </span>
        )}
      </button>

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
        'inline-flex items-center gap-1.5 rounded-md transition-all duration-200',
        'hover:bg-gray-100 dark:hover:bg-gray-800',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
          'transition-all duration-200',
          isBookmarked
            ? 'fill-blue-500 text-blue-500'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          isAnimating && 'scale-110'
        )}
      />
      {showLabel && (
        <span
          className={twMerge(
            'text-sm font-medium',
            isBookmarked
              ? 'text-blue-500'
              : 'text-gray-600 dark:text-gray-300'
          )}
        >
          {isBookmarked ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  );
}

export const ControlledBookmarkButton = memo(ControlledBookmarkButtonInner);
