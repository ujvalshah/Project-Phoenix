import React, { useState, useRef, useEffect } from 'react';
import { X, FolderPlus, MoreVertical, Flag, Trash2, Edit2, Globe, Lock } from 'lucide-react';
import { Article } from '@/types';
import { BookmarkButton } from '../bookmarks';
import { Avatar } from './Avatar';
import { ShareMenu } from './ShareMenu';

interface DetailTopBarProps {
  authorName: string;
  article: Article;
  onClose?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
  onAddToCollection: () => void;
  onReport: () => void;
  isOwner: boolean;
  isAdmin: boolean;
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
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{authorName}</div>
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
          meta={{ author: authorName, text: article?.excerpt ?? '' }}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
        />
        <BookmarkButton
          itemId={article?.id ?? ''}
          itemType="nugget"
          size="md"
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        />
        <button
          onClick={onAddToCollection}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          title="Add to Collection"
        >
          <FolderPlus size={20} />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={handleToggleMenu}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            title="More options"
          >
            <MoreVertical size={20} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30 overflow-hidden">
              {(isOwner || isAdmin) && onEdit && (
                <button
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
              <button
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
          )}
        </div>
        {onClose && (
          <button
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
