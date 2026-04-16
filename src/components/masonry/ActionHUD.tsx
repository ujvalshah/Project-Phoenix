import React from 'react';
import { Article } from '@/types';
import { ExternalLink, MoreVertical, Flag, Edit2, Trash2, FolderPlus } from 'lucide-react';
import { DropdownPortal } from '@/components/UI/DropdownPortal';

type SourceLinkLabel = 'Link' | 'Source';

interface ActionHUDProps {
  article: Article;
  onAddToCollection?: (e: React.MouseEvent) => void;
  onMore: (e: React.MouseEvent) => void;
  sourceLink?: { url: string; label: SourceLinkLabel } | null;
  showMenuButton?: boolean;
  showMoreMenu?: boolean;
  moreMenuRef?: React.RefObject<HTMLDivElement | null>;
  /** Called when the portaled more-menu should close (outside click / Escape). */
  onMenuClose?: () => void;
  isOwner?: boolean;
  isAdmin?: boolean;
  onReport?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * ActionHUD: Hover-triggered action icons
 *
 * The “more” menu is portaled to #dropdown-root (opens above the anchor) so it is not
 * clipped by masonry overflow/transform stacking.
 */
export const ActionHUD: React.FC<ActionHUDProps> = ({
  article: _article,
  onAddToCollection,
  onMore,
  sourceLink = null,
  showMenuButton = true,
  showMoreMenu = false,
  moreMenuRef,
  onMenuClose,
  isOwner = false,
  isAdmin = false,
  onReport,
  onEdit,
  onDelete,
}) => {
  return (
    <div
      className="absolute top-2 right-2 flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-slate-200/50 dark:border-slate-700/50 z-10"
      onClick={(e) => e.stopPropagation()}
    >
      {sourceLink && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.open(sourceLink.url, '_blank', 'noopener,noreferrer');
          }}
          className="flex items-center gap-1 p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded"
          title="Open source in new tab"
          aria-label="Open source in new tab"
        >
          <ExternalLink size={14} />
          <span className="text-[10px] font-bold leading-none">{sourceLink.label}</span>
        </button>
      )}

      {showMenuButton && (
        <>
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={onMore}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded"
              title="More options"
              aria-expanded={showMoreMenu}
              aria-haspopup="menu"
            >
              <MoreVertical size={14} />
            </button>
          </div>
          {moreMenuRef && onMenuClose && (
            <DropdownPortal
              isOpen={showMoreMenu}
              anchorRef={moreMenuRef}
              placement="above"
              align="right"
              offsetY={4}
              onClickOutside={onMenuClose}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150"
            >
              <div
                role="menu"
                className="w-40 max-h-[min(70vh,320px)] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1"
              >
                {(isOwner || isAdmin) && onEdit && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                      onMenuClose();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                )}

                {isAdmin && onAddToCollection && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCollection(e);
                      onMenuClose();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    aria-label="Add to collection"
                  >
                    <FolderPlus size={12} /> Add to collection
                  </button>
                )}
                {onReport && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReport();
                      onMenuClose();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Flag size={12} /> Report
                  </button>
                )}
                {(isOwner || isAdmin) && onDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                      onMenuClose();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </DropdownPortal>
          )}
        </>
      )}
    </div>
  );
};
