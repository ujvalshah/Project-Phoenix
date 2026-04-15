import React, { useState, useRef } from 'react';
import { X, FolderPlus, MoreVertical, Flag, Trash2, Edit2, Globe, Lock } from 'lucide-react';
import { Article } from '@/types';
import { BookmarkButton } from '../bookmarks';
import { Avatar } from './Avatar';
import { ShareMenu } from './ShareMenu';
import { DropdownPortal } from '@/components/UI/DropdownPortal';

interface DetailTopBarProps {
  authorName: string;
  article: Article;
  onClose?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
  /** Editorial “public collection” add — omitted for standard users */
  onAddToCollection?: () => void;
  onReport: () => void;
  isOwner: boolean;
  isAdmin: boolean;
  showAuthorName?: boolean;
}

export const DetailTopBar: React.FC<DetailTopBarProps> = ({
  authorName,
  article,
  onClose,
  onEdit,
  onDelete,
  onToggleVisibility,
  onAddToCollection,
  onReport,
  isOwner,
  isAdmin,
  showAuthorName = true,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-3 min-w-0">
        {authorName && (
          <>
            <Avatar name={authorName} size="sm" />
            {showAuthorName && (
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{authorName}</div>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ShareMenu
          data={{
            type: 'nugget',
            id: article?.id ?? '',
            title: article?.title ?? 'Untitled',
            shareUrl: `${window.location.origin}/article/${article?.id ?? ''}`,
          }}
          meta={{
            text: [authorName, article?.excerpt ?? ''].filter(Boolean).join('\n'),
          }}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
        />
        <BookmarkButton
          itemId={article?.id ?? ''}
          itemType="nugget"
          size="md"
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        />
        <div className="relative inline-flex">
          <button
            ref={menuAnchorRef}
            type="button"
            onClick={handleToggleMenu}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            title="More options"
            aria-expanded={showMenu}
            aria-haspopup="menu"
          >
            <MoreVertical size={20} />
          </button>
          <DropdownPortal
            isOpen={showMenu}
            anchorRef={menuAnchorRef}
            align="right"
            host="dropdown"
            offsetY={4}
            onClickOutside={() => setShowMenu(false)}
            className="w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl py-1 overflow-hidden"
          >
            <div role="menu">
              {(isOwner || isAdmin) && onEdit && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Edit2 size={12} /> Edit
                </button>
              )}
              {isOwner && onToggleVisibility && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onToggleVisibility();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  {(article?.visibility ?? 'public') === 'private' ? (
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
              {onAddToCollection && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onAddToCollection();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <FolderPlus size={12} /> Add to collection
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onReport();
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Flag size={12} /> Report
              </button>
              {(isOwner || isAdmin) && onDelete && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>
          </DropdownPortal>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
};
