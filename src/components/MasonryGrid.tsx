import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Article } from '@/types';
import { MasonryAtom } from './masonry/MasonryAtom';
import { useMasonry } from '@/hooks/useMasonry';
import { Loader2 } from 'lucide-react';
import { getMasonryVisibleMedia } from '@/utils/masonryMediaHelper';
import { CardSkeleton } from './card/CardSkeleton';
import { CardError } from './card/CardError';

/**
 * Expanded masonry entry: one per selected media item
 * Allows multiple tiles from the same article when multiple media items are selected
 */
interface MasonryEntry {
  article: Article;
  mediaItemId?: string; // If specified, render only this media item; otherwise render all visible items (backward compatibility)
}

interface MasonryGridProps {
  articles: Article[];
  isLoading: boolean;
  onArticleClick: (article: Article) => void;
  onCategoryClick: (category: string) => void;
  currentUserId?: string;
  onTagClick?: (tag: string) => void;
  // Infinite Scroll Props
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  // Error Handling Props
  error?: Error | null;
  onRetry?: () => void;
}

/**
 * MasonryGrid: Dedicated Masonry layout renderer
 * 
 * Architecture:
 * - Uses useMasonry hook for layout logic (Layer 1)
 * - Renders flex-based columns (Layer 2)
 * - Uses MasonryAtom for content-first rendering (Layer 3)
 * 
 * Rules:
 * - Deterministic Round-Robin distribution (index % columnCount)
 * - Flex-based columns (NOT CSS columns)
 * - SSR-safe (uses defaultColumns on server)
 * - Debounced resize handling
 * - Fixed gap (~1rem)
 * - Fixed column count per breakpoint
 * - NO card components
 * - NO card styling
 */
// Infinite Scroll Trigger Component for Masonry
const InfiniteScrollTrigger: React.FC<{
  onIntersect: () => void;
  isLoading: boolean;
  hasMore: boolean;
}> = ({ onIntersect, isLoading, hasMore }) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onIntersect);
  
  // Keep callback ref updated without triggering effect
  useEffect(() => {
    callbackRef.current = onIntersect;
  }, [onIntersect]);

  useEffect(() => {
    if (!hasMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          callbackRef.current();
        }
      },
      {
        rootMargin: '300px', // Prefetch distance
        threshold: 0,
      }
    );

    const currentTrigger = triggerRef.current;
    if (currentTrigger) {
      observer.observe(currentTrigger);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore]);

  if (!hasMore) return null;

  return (
    <div ref={triggerRef} className="flex justify-center py-6 w-full">
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-medium">Loading more...</span>
        </div>
      )}
    </div>
  );
};

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  articles,
  isLoading,
  onArticleClick,
  onCategoryClick,
  currentUserId,
  onTagClick,
  // Infinite Scroll Props
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  // Error Handling Props
  error = null,
  onRetry,
}) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  // Trigger animations when we have data and are not loading
  // This works for both fresh loads and cached data on page refresh
  useEffect(() => {
    if (!isLoading && articles.length > 0) {
      // Small delay to ensure DOM is ready for animation
      const timer = setTimeout(() => setShouldAnimate(true), 50);
      return () => clearTimeout(timer);
    } else if (isLoading) {
      // Reset animation state when loading starts
      setShouldAnimate(false);
    }
  }, [isLoading, articles.length]);

  // Expand articles into masonry entries: one entry per selected media item
  // If an article has multiple selected media items, it creates multiple independent tiles
  // IMPORTANT: Articles with no visible media items are EXCLUDED from Masonry view
  // Masonry is a media-focused view - text-only nuggets should use Grid or Feed views
  const masonryEntries = useMemo(() => {
    const entries: MasonryEntry[] = [];

    for (const article of articles) {
      const visibleMediaItems = getMasonryVisibleMedia(article);

      // Skip articles with no visible media items
      // Masonry view is exclusively for media content
      if (visibleMediaItems.length === 0) {
        continue;
      }

      // Create one entry per selected media item
      // Each entry represents one tile in the masonry grid
      for (const mediaItem of visibleMediaItems) {
        entries.push({
          article,
          mediaItemId: mediaItem.id,
        });
      }
    }

    return entries;
  }, [articles]);

  // Layer 1: Layout logic (delegated to hook)
  const { columns, columnCount } = useMasonry(masonryEntries, {
    breakpoints: [
      { minWidth: 0, columnCount: 1 },      // < 640px: 1 column (mobile)
      { minWidth: 640, columnCount: 2 },    // 640-1024: 2 columns (tablet)
      { minWidth: 1024, columnCount: 3 },  // 1024-1536: 3 columns (desktop)
      { minWidth: 1536, columnCount: 4 },  // >= 1536: 4 columns (large desktop)
    ],
    defaultColumns: 1, // SSR-safe default (mobile-first, reduces CLS)
    debounceMs: 100,
  });

  // Infinite Scroll Handler
  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [isFetchingNextPage, hasNextPage, onLoadMore]);

  // Error State: Show error UI when query fails
  if (error && !isLoading) {
    return (
      <div className="flex gap-4 w-full">
        {Array.from({ length: columnCount }).map((_, colIdx) => (
          <div key={colIdx} className="flex-1 flex flex-col gap-4">
            {colIdx === 0 && (
              <CardError
                error={error}
                onRetry={onRetry}
                variant="masonry"
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Layer 2: Presentational rendering only
  if (isLoading) {
    return (
      <div className="flex gap-4 w-full">
        {Array.from({ length: columnCount }).map((_, colIdx) => (
          <div key={colIdx} className="flex-1 flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} variant="masonry" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Ensure entries are visible - use animation if available, otherwise show immediately
  const hasEntries = masonryEntries.length > 0;
  const shouldShowContent = !isLoading && hasEntries;

  return (
    <>
      <div className="flex gap-4 w-full transition-opacity duration-300 motion-reduce:transition-none">
        {columns.map((columnEntries, colIdx) => (
          <div key={colIdx} className="flex-1 flex flex-col gap-4">
            {columnEntries.map((entry, entryIdx) => {
              // Ensure unique React keys even if mediaItemId is duplicate
              // Use entryIdx in addition to mediaItemId to guarantee uniqueness
              const uniqueKey = `${entry.article.id}-${entry.mediaItemId || 'all'}-${entryIdx}-${columnEntries.length}`;

              // Calculate global index for stagger (across all columns)
              // Formula: column index + (row index * number of columns)
              const globalIndex = colIdx + (entryIdx * columns.length);
              const delay = Math.min(globalIndex * 50, 750);

              return (
                <div
                  key={uniqueKey}
                  className={`
                    ${shouldAnimate && shouldShowContent ? 'animate-fade-in-up' : ''}
                    ${shouldShowContent ? 'opacity-100' : 'opacity-0'}
                    motion-reduce:animate-none motion-reduce:opacity-100
                  `}
                  style={{
                    animationDelay: shouldAnimate && shouldShowContent ? `${delay}ms` : '0ms',
                  }}
                >
                  <MasonryAtom
                    article={entry.article}
                    mediaItemId={entry.mediaItemId}
                    onArticleClick={onArticleClick}
                    onCategoryClick={onCategoryClick}
                    currentUserId={currentUserId}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* Infinite Scroll Trigger for Masonry */}
      <InfiniteScrollTrigger
        onIntersect={handleLoadMore}
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
      />
    </>
  );
};

