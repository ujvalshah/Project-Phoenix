import React from 'react';
import { FolderPlus, MoreVertical, Flag, Trash2, Edit2, Globe, Lock } from 'lucide-react';
import { ShareMenu } from '@/components/shared/ShareMenu';
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
}) => {
  // PHASE 2: Consistent 8-pt aligned action buttons (w-8 = 32px, h-8 = 32px)
  const isFeed = variant === 'feed';
  const buttonSize = isFeed ? 'w-9 h-9' : 'w-8 h-8';
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
            shareUrl: `${window.location.origin}/#/article/${articleId}`,
          }}
          meta={{
            author: authorName,
            text: articleExcerpt,
          }}
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
          title="Add to Collection"
        >
          <FolderPlus size={iconSize} />
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
          title="More options"
        >
          <MoreVertical size={iconSize} />
        </button>
        {showMenu && (
          <div className="absolute right-0 bottom-full mb-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-20 overflow-hidden">
            {isOwner || isAdmin ? (
              onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Edit2 size={12} /> Edit
                </button>
              )
            ) : null}

            {isOwner && onToggleVisibility && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                {visibility === 'private' ? (
                  <>
                    <Globe size={12} className="text-blue-500" /> Make Public
                  </>
                ) : (
                  <>
                    <Lock size={12} className="text-amber-500" /> Make Private
                  </>
                )}
              </button>
            )}

            {onReport && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReport();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Flag size={12} /> Report
              </button>
            )}

            {(isOwner || isAdmin) && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

