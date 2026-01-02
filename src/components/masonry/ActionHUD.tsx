import React from 'react';
import { Article } from '@/types';
import { MoreVertical, Flag, Edit2, Trash2 } from 'lucide-react';

interface ActionHUDProps {
  article: Article;
  onAddToCollection: (e: React.MouseEvent) => void;
  onMore: (e: React.MouseEvent) => void;
  showMoreMenu?: boolean;
  moreMenuRef?: React.RefObject<HTMLDivElement>;
  isOwner?: boolean;
  isAdmin?: boolean;
  onReport?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * ActionHUD: Hover-triggered action icons
 * 
 * Rules:
 * - Hidden by default
 * - Appears on hover (top-right)
 * - Semi-transparent, low contrast
 * - Never visually dominates content
 * - Icon clicks stop propagation
 */
export const ActionHUD: React.FC<ActionHUDProps> = ({
  article,
  onAddToCollection,
  onMore,
  showMoreMenu = false,
  moreMenuRef,
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
      {/* Add to Collection */}
      <button
        onClick={onAddToCollection}
        className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded"
        title="Add to collection"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </button>

      {/* More Menu */}
      <div className="relative" ref={moreMenuRef}>
        <button
          onClick={onMore}
          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded"
          title="More options"
        >
          <MoreVertical size={14} />
        </button>
        {showMoreMenu && (
          <div className="absolute right-0 bottom-full mb-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-20 overflow-hidden">
            {(isOwner || isAdmin) && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Edit2 size={12} /> Edit
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

