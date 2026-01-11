import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardSkeletonProps {
  variant: 'grid' | 'feed' | 'masonry';
  className?: string;
}

/**
 * CardSkeleton: Loading placeholder that matches actual card structure
 *
 * Features:
 * - Matches real card layout (media, tags, title, content, footer)
 * - Shimmer animation for visual feedback
 * - Variant-specific sizing and spacing
 * - Reduced motion support
 *
 * Design Principles:
 * - Match actual card dimensions to prevent layout shift
 * - Use consistent spacing with real cards (8pt rhythm)
 * - Shimmer provides activity cue without being distracting
 */
export const CardSkeleton: React.FC<CardSkeletonProps> = ({ variant, className }) => {
  // Shared skeleton element with shimmer
  const SkeletonBox: React.FC<{ className?: string }> = ({ className: boxClassName }) => (
    <div
      className={twMerge(
        'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200',
        'dark:from-slate-800 dark:via-slate-700 dark:to-slate-800',
        'bg-[length:200%_100%]',
        'animate-shimmer',
        'rounded',
        boxClassName
      )}
    />
  );

  // Feed variant: Wider card with enhanced spacing
  if (variant === 'feed') {
    return (
      <div
        className={twMerge(
          'relative flex flex-col bg-white dark:bg-slate-900',
          'rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.04)]',
          'w-full p-6 gap-4',
          className
        )}
      >
        {/* Media skeleton - 16:9 aspect ratio */}
        <div className="w-full aspect-video rounded-lg overflow-hidden">
          <SkeletonBox className="w-full h-full" />
        </div>

        {/* Tags skeleton */}
        <div className="flex gap-1">
          <SkeletonBox className="h-4 w-12 rounded-full" />
          <SkeletonBox className="h-4 w-16 rounded-full" />
          <SkeletonBox className="h-4 w-14 rounded-full" />
        </div>

        {/* Title skeleton */}
        <SkeletonBox className="h-4 w-3/4" />

        {/* Content skeleton - 3 lines */}
        <div className="space-y-2">
          <SkeletonBox className="h-3 w-full" />
          <SkeletonBox className="h-3 w-full" />
          <SkeletonBox className="h-3 w-2/3" />
        </div>

        {/* Footer skeleton */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-2">
          {/* Author metadata */}
          <div className="flex items-center gap-2">
            <SkeletonBox className="w-6 h-6 rounded-full" />
            <SkeletonBox className="h-3 w-20" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-0.5">
            <SkeletonBox className="w-8 h-8 rounded-full" />
            <SkeletonBox className="w-8 h-8 rounded-full" />
            <SkeletonBox className="w-8 h-8 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // Masonry variant: Flexible height with break-inside-avoid
  if (variant === 'masonry') {
    return (
      <div
        className={twMerge(
          'relative flex flex-col bg-white dark:bg-slate-900',
          'border border-slate-200 dark:border-slate-800',
          'rounded-2xl shadow-sm',
          'w-full p-4 break-inside-avoid mb-6',
          className
        )}
        style={{ height: 'auto' }}
      >
        {/* Media skeleton - variable height for masonry */}
        <div className="w-full rounded-lg overflow-hidden mb-3">
          <div className="aspect-video">
            <SkeletonBox className="w-full h-full" />
          </div>
        </div>

        {/* Tags skeleton */}
        <div className="flex gap-1 mb-2">
          <SkeletonBox className="h-4 w-12 rounded-full" />
          <SkeletonBox className="h-4 w-16 rounded-full" />
        </div>

        {/* Title skeleton */}
        <SkeletonBox className="h-4 w-4/5 mb-2" />

        {/* Content skeleton - 2 lines */}
        <div className="space-y-2 mb-3">
          <SkeletonBox className="h-3 w-full" />
          <SkeletonBox className="h-3 w-3/4" />
        </div>

        {/* Footer skeleton */}
        <div className="mt-auto pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {/* Author metadata */}
          <div className="flex items-center gap-2">
            <SkeletonBox className="w-6 h-6 rounded-full" />
            <SkeletonBox className="h-3 w-16" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-0.5">
            <SkeletonBox className="w-8 h-8 rounded-full" />
            <SkeletonBox className="w-8 h-8 rounded-full" />
            <SkeletonBox className="w-8 h-8 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // Grid variant (default): Compact card with fixed aspect ratio
  return (
    <div
      className={twMerge(
        'relative flex flex-col h-full',
        'bg-white dark:bg-slate-900',
        'border border-slate-200 dark:border-slate-700',
        'rounded-xl shadow-sm',
        className
      )}
    >
      {/* Media skeleton - 16:9 aspect ratio */}
      <div className="relative w-full overflow-hidden rounded-t-xl pt-2 px-2 pb-2">
        <div className="aspect-video rounded-lg overflow-hidden">
          <SkeletonBox className="w-full h-full" />
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-col flex-1 min-w-0 px-4 pb-2 gap-2">
        {/* Tags skeleton */}
        <div className="flex gap-1">
          <SkeletonBox className="h-4 w-12 rounded-full" />
          <SkeletonBox className="h-4 w-14 rounded-full" />
          <SkeletonBox className="h-4 w-10 rounded-full" />
        </div>

        {/* Title skeleton */}
        <SkeletonBox className="h-4 w-5/6" />

        {/* Content skeleton - 3 lines */}
        <div className="space-y-2">
          <SkeletonBox className="h-3 w-full" />
          <SkeletonBox className="h-3 w-full" />
          <SkeletonBox className="h-3 w-4/5" />
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="mt-auto px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        {/* Author metadata */}
        <div className="flex items-center gap-2">
          <SkeletonBox className="w-6 h-6 rounded-full" />
          <SkeletonBox className="h-3 w-16" />
        </div>

        {/* Action buttons */}
        <div className="flex gap-0.5">
          <SkeletonBox className="w-8 h-8 rounded-full" />
          <SkeletonBox className="w-8 h-8 rounded-full" />
          <SkeletonBox className="w-8 h-8 rounded-full" />
        </div>
      </div>
    </div>
  );
};
