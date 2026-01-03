import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Article } from '@/types';
import { MasonryAtom } from './masonry/MasonryAtom';
import { useMasonry } from '@/hooks/useMasonry';
import { Loader2 } from 'lucide-react';
import { getMasonryVisibleMedia } from '@/utils/masonryMediaHelper';

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
}) => {
  // Expand articles into masonry entries: one entry per selected media item
  // If an article has multiple selected media items, it creates multiple independent tiles
  const masonryEntries = useMemo(() => {
    const entries: MasonryEntry[] = [];
    
    for (const article of articles) {
      const visibleMediaItems = getMasonryVisibleMedia(article);
      
      if (visibleMediaItems.length === 0) {
        // Skip articles with no selected media items
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
      { minWidth: 0, columnCount: 1 },      // < 768px: 1 column
      { minWidth: 768, columnCount: 3 },    // 768-1024: 3 columns (tablet)
      { minWidth: 1024, columnCount: 4 },  // 1024-1536: 4 columns (desktop)
      { minWidth: 1536, columnCount: 5 },  // >= 1536: 5 columns (large desktop)
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

  // Layer 2: Presentational rendering only
  if (isLoading) {
    return (
      <div className="flex gap-4 w-full">
        {Array.from({ length: columnCount }).map((_, colIdx) => (
          <div key={colIdx} className="flex-1 flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-100 dark:bg-slate-800 h-80 animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 w-full">
        {columns.map((columnEntries, colIdx) => (
          <div key={colIdx} className="flex-1 flex flex-col gap-4">
            {columnEntries.map((entry, entryIdx) => {
              // Ensure unique React keys even if mediaItemId is duplicate
              // Use entryIdx in addition to mediaItemId to guarantee uniqueness
              const uniqueKey = `${entry.article.id}-${entry.mediaItemId || 'all'}-${entryIdx}-${columnEntries.length}`;
              
              return (
                <MasonryAtom
                  key={uniqueKey}
                  article={entry.article}
                  mediaItemId={entry.mediaItemId}
                  onArticleClick={onArticleClick}
                  onCategoryClick={onCategoryClick}
                  currentUserId={currentUserId}
                />
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

