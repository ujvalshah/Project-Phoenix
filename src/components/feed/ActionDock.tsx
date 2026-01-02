/**
 * ============================================================================
 * ACTION DOCK: Sticky Bottom Action Bar
 * ============================================================================
 * 
 * FEATURES:
 * - Sticky bottom positioning
 * - Safe-area insets (mobile-first)
 * - Thumb-reachable actions
 * - Like, Bookmark, Share actions
 * - Source link
 * 
 * ============================================================================
 */

import React from 'react';
import { Heart, Bookmark, Share2, ExternalLink } from 'lucide-react';
import { Article } from '@/types';
import { SourceBadge } from '../shared/SourceBadge';
import { twMerge } from 'tailwind-merge';

export interface ActionDockProps {
  /** Article */
  article: Article;
  /** Source URL */
  sourceUrl?: string;
  /** Like handler */
  onLike?: () => void;
  /** Bookmark handler */
  onBookmark?: () => void;
  /** Share handler */
  onShare?: () => void;
}

export const ActionDock: React.FC<ActionDockProps> = ({
  article,
  sourceUrl,
  onLike,
  onBookmark,
  onShare,
}) => {
  // Check if article is liked/bookmarked (placeholder - replace with actual state)
  const isLiked = false;
  const isBookmarked = false;
  
  const handleSourceClick = () => {
    if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };
  
  return (
    <div
      className={twMerge(
        'sticky bottom-0 z-20',
        'flex items-center justify-between',
        'px-4 py-3',
        'bg-white/90 dark:bg-slate-950/90',
        'backdrop-blur-lg',
        'border-t border-slate-200 dark:border-slate-800',
        'safe-area-inset-bottom', // CSS custom property for safe-area insets
        'pb-safe-bottom' // Tailwind utility for safe-area bottom padding
      )}
      style={{
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
      }}
    >
      {/* Source Badge */}
      <div className="flex-1 min-w-0">
        {sourceUrl && (
          <button
            onClick={handleSourceClick}
            className={twMerge(
              'flex items-center gap-2',
              'px-3 py-1.5 rounded-lg',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              'transition-colors',
              'group'
            )}
            aria-label="Open source link"
          >
            <SourceBadge url={sourceUrl} size="sm" variant="default" />
            <ExternalLink
              size={14}
              className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors"
            />
          </button>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Like */}
        {onLike && (
          <button
            onClick={onLike}
            className={twMerge(
              'p-3 rounded-full',
              'transition-colors',
              isLiked
                ? 'text-red-500 bg-red-50 dark:bg-red-950/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart
              size={20}
              className={isLiked ? 'fill-current' : ''}
            />
          </button>
        )}
        
        {/* Bookmark */}
        {onBookmark && (
          <button
            onClick={onBookmark}
            className={twMerge(
              'p-3 rounded-full',
              'transition-colors',
              isBookmarked
                ? 'text-blue-500 bg-blue-50 dark:bg-blue-950/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <Bookmark
              size={20}
              className={isBookmarked ? 'fill-current' : ''}
            />
          </button>
        )}
        
        {/* Share */}
        {onShare && (
          <button
            onClick={onShare}
            className={twMerge(
              'p-3 rounded-full',
              'text-slate-600 dark:text-slate-400',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              'transition-colors'
            )}
            aria-label="Share"
          >
            <Share2 size={20} />
          </button>
        )}
      </div>
    </div>
  );
};




