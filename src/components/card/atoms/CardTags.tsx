import React, { useRef } from 'react';
import { Tooltip } from '@/components/UI/Tooltip';
import { DropdownPortal } from '@/components/UI/DropdownPortal';
import { twMerge } from 'tailwind-merge';

interface TagPillProps {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const TagPill: React.FC<TagPillProps> = ({ label, onClick }) => {
  const pill = (
    <span
      title={label}
      onClick={onClick}
      className={twMerge(
        'inline-flex min-w-0 max-w-full items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600',
        'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
        onClick && [
          'cursor-pointer',
          'hover:border-slate-300 hover:bg-slate-100',
          'dark:hover:bg-slate-700',
          'hover:shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
        ]
      )}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `Filter by tag: ${label}` : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClick(e as unknown as React.MouseEvent);
        }
      } : undefined}
    >
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
  return onClick ? <Tooltip content="Click to filter">{pill}</Tooltip> : pill;
};

interface CardTagsProps {
  tags: string[];
  onTagClick: (tag: string) => void;
  showTagPopover?: boolean;
  onToggleTagPopover?: (e: React.MouseEvent) => void;
  onCloseTagPopover?: () => void;
  className?: string;
  variant?: 'default' | 'grid' | 'feed';
}

export const CardTags: React.FC<CardTagsProps> = ({
  tags,
  onTagClick,
  showTagPopover,
  onToggleTagPopover,
  onCloseTagPopover,
  className,
  variant = 'default',
}) => {
  const moreTagsAnchorRef = useRef<HTMLButtonElement>(null);

  if (!tags || tags.length === 0) return null;

  /** Inline cap before +N; chips share one row and truncate — do not raise this without layout review */
  const MAX_INLINE_TAGS = 3;
  const visibleTags = tags.slice(0, MAX_INLINE_TAGS);
  const remainingCount = tags.length - MAX_INLINE_TAGS;

  // Single-row band: nowrap + hidden overflow keeps grid title baselines aligned across cards.
  // Grid/Feed: flat row; default (masonry): amber band — same overflow rules.
  const containerClasses =
    variant === 'grid' || variant === 'feed'
      ? 'flex flex-nowrap items-center gap-1 relative w-full min-w-0 shrink-0 overflow-hidden'
      : 'mb-2 flex flex-nowrap items-center gap-1 relative w-full min-w-0 shrink-0 overflow-hidden rounded-lg bg-amber-50 px-2 py-1 dark:bg-amber-900/20';

  return (
    <div
      className={twMerge(containerClasses, className)}
    >
      {visibleTags.map((tag) => (
        <TagPill
          key={tag}
          label={tag}
          onClick={(e) => {
            e.stopPropagation();
            onTagClick(tag);
          }}
        />
      ))}
      {remainingCount > 0 && (
        <div className="relative inline-flex shrink-0">
          <button
            ref={moreTagsAnchorRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleTagPopover) {
                onToggleTagPopover(e);
              }
            }}
            className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            aria-label={`Show ${remainingCount} more tags`}
            aria-expanded={showTagPopover}
            aria-haspopup="menu"
          >
            +{remainingCount}
          </button>
          <DropdownPortal
            isOpen={!!showTagPopover && tags.length > MAX_INLINE_TAGS}
            anchorRef={moreTagsAnchorRef}
            align="left"
            host="popover"
            offsetY={4}
            onClickOutside={onCloseTagPopover}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-2 w-40"
          >
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto custom-scrollbar" role="menu">
              {tags.slice(MAX_INLINE_TAGS).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick(tag);
                    onCloseTagPopover?.();
                  }}
                  className="text-left text-xs px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </DropdownPortal>
        </div>
      )}
    </div>
  );
};
