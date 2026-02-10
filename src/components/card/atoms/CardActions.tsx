import React from 'react';
import { FolderPlus, MoreVertical, Flag, Trash2, Edit2, Globe, Lock } from 'lucide-react';
import { ShareMenu } from '@/components/shared/ShareMenu';
import { BookmarkButton } from '@/components/bookmarks';
import { twMerge } from 'tailwind-merge';

interface CardActionsProps {
  articleId: string;
  articleTitle: string;
  articleExcerpt: string;
  authorName: string;
  isOwner: boolean;
  isAdmin: boolean;
  visibility?: 'public' | 'private';
  onAddToCollection?: () => void;
  onReport?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
  showMenu: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  isPreview?: boolean; // Add preview flag to hide ShareMenu
  variant?: 'grid' | 'feed' | 'masonry' | 'utility'; // Variant for feed-specific styling
  onBookmarkChangeCollection?: (bookmarkId: string) => void; // Callback when user wants to change folder
}

export const CardActions: React.FC<CardActionsProps> = ({
  articleId,
  articleTitle,
  articleExcerpt,
  authorName,
  isOwner,
  isAdmin,
  visibility,
  onAddToCollection,
  onReport,
  onEdit,
  onDelete,
  onToggleVisibility,
  showMenu,
  onToggleMenu,
  menuRef,
  className,
  isPreview = false,
  variant = 'grid',
  onBookmarkChangeCollection,
}) => {
  // Mobile UX: Minimum 44px tap targets for better touch ergonomics
  const buttonSize = 'min-h-[44px] min-w-[44px]';
  const iconSize = 16;
  const textColor = 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300';
  const hoverBg = 'hover:bg-slate-100 dark:hover:bg-slate-800';
  const transitionClass = 'transition-colors duration-150';

  return (
    // PHASE 2: 8-pt gap between action buttons
    <div className={twMerge('flex items-center gap-0.5', className)}>
      {/* Hide ShareMenu in preview mode (preview IDs are invalid) */}
      {!isPreview && (
        <ShareMenu
          data={{
            type: 'nugget',
            id: articleId,
            title: articleTitle,
            shareUrl: `${window.location.origin}/article/${articleId}`,
          }}
          meta={{
            author: authorName,
            text: articleExcerpt,
          }}
        />
      )}

      {/* Bookmark Button - Personal save feature */}
      {!isPreview && (
        <BookmarkButton
          itemId={articleId}
          itemType="nugget"
          size="md"
          onChangeCollection={onBookmarkChangeCollection}
          className={twMerge(
            buttonSize,
            'flex items-center justify-center rounded-full',
            hoverBg,
            transitionClass
          )}
        />
      )}

      {onAddToCollection && (
        <button
          onClick={onAddToCollection}
          className={twMerge(
            buttonSize,
            'flex items-center justify-center rounded-full',
            hoverBg,
            textColor,
            transitionClass
          )}
          aria-label="Add to collection"
          title="Add to collection"
        >
          <FolderPlus size={iconSize} aria-hidden="true" />
        </button>
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu(e);
          }}
          className={twMerge(
            buttonSize,
            'flex items-center justify-center rounded-full',
            hoverBg,
            textColor,
            transitionClass
          )}
          aria-label="More options"
          aria-expanded={showMenu}
          aria-haspopup="menu"
          title="More options"
        >
          <MoreVertical size={iconSize} aria-hidden="true" />
        </button>
        {showMenu && (
          <div
            role="menu"
            aria-label="Article actions"
            className="absolute right-0 bottom-full mb-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-20 overflow-hidden"
          >
            {isOwner || isAdmin ? (
              onEdit && (
                <button
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Edit2 size={12} aria-hidden="true" /> Edit
                </button>
              )
            ) : null}

            {isOwner && onToggleVisibility && (
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                aria-label={visibility === 'private' ? 'Make article public' : 'Make article private'}
              >
                {visibility === 'private' ? (
                  <>
                    <Globe size={12} className="text-blue-500" aria-hidden="true" /> Make Public
                  </>
                ) : (
                  <>
                    <Lock size={12} className="text-amber-500" aria-hidden="true" /> Make Private
                  </>
                )}
              </button>
            )}

            {onReport && (
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  onReport();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Flag size={12} aria-hidden="true" /> Report
              </button>
            )}

            {(isOwner || isAdmin) && onDelete && (
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <Trash2 size={12} aria-hidden="true" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

