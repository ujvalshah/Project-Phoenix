import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Article } from '@/types';
import { ExternalLink, MoreVertical, Flag, Edit2, Trash2, FolderPlus } from 'lucide-react';

type SourceLinkLabel = 'Link' | 'Source';

interface ActionHUDProps {
  article: Article;
  onAddToCollection: (e: React.MouseEvent) => void;
  onMore: (e: React.MouseEvent) => void;
  sourceLink?: { url: string; label: SourceLinkLabel } | null;
  showMenuButton?: boolean;
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
  sourceLink = null,
  showMenuButton = true,
  showMoreMenu = false,
  moreMenuRef,
  isOwner = false,
  isAdmin = false,
  onReport,
  onEdit,
  onDelete,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<'up' | 'down'>('up');
  const [align, setAlign] = useState<'right' | 'left'>('right');

  const computePlacementDeps = useMemo(
    () => [isOwner, isAdmin, !!onEdit, !!onReport, !!onDelete, !!onAddToCollection],
    [isOwner, isAdmin, onEdit, onReport, onDelete, onAddToCollection]
  );

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (!showMoreMenu) return;
    if (!moreMenuRef?.current || !panelRef.current) return;

    const anchorRect = moreMenuRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();

    const margin = 8;
    const spaceAbove = anchorRect.top;
    const spaceBelow = window.innerHeight - anchorRect.bottom;

    const canFitUp = spaceAbove >= panelRect.height + margin;
    const canFitDown = spaceBelow >= panelRect.height + margin;

    if (canFitUp) setPlacement('up');
    else if (canFitDown) setPlacement('down');
    else setPlacement(spaceAbove > spaceBelow ? 'up' : 'down');

    const spaceLeft = anchorRect.left;
    const spaceRight = window.innerWidth - anchorRect.right;

    const canFitRight = spaceRight >= panelRect.width + margin;
    const canFitLeft = spaceLeft >= panelRect.width + margin;

    // Default to right alignment; flip to left only if right doesn't fit but left does.
    if (!canFitRight && canFitLeft) setAlign('left');
    else setAlign('right');
  }, [showMoreMenu, moreMenuRef, computePlacementDeps]);

  return (
    <div
      className="absolute top-2 right-2 flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-slate-200/50 dark:border-slate-700/50 z-10"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Source/Link */}
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

      {/* More Menu */}
      {showMenuButton && (
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={onMore}
            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded"
            title="More options"
          >
            <MoreVertical size={14} />
          </button>
          {showMoreMenu && (
            <div
              ref={panelRef}
              className={[
                'absolute w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-20 overflow-hidden',
                placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1',
                align === 'right' ? 'right-0' : 'left-0',
              ].join(' ')}
            >
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

              {/* Add to collection — below Edit in the menu */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCollection(e);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                aria-label="Add to collection"
              >
                <FolderPlus size={12} /> Add to collection
              </button>
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
      )}
    </div>
  );
};

