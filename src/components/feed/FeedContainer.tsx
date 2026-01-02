/**
 * ============================================================================
 * FEED CONTAINER: Virtualized Feed with Scroll Persistence
 * ============================================================================
 * 
 * FEATURES:
 * - TanStack React Virtual for windowing
 * - Only renders visible cards + small overscan
 * - Preserves scroll position when opening/closing Detail View (via routing)
 * - Integrates with React Query for data lifecycle
 * - Zero CLS with fixed card heights
 * - Scroll state persistence via FeedScrollStateContext
 * 
 * ARCHITECTURE:
 * - Saves scroll state on scroll events
 * - Restores scroll state on mount BEFORE virtualizer renders
 * - Works with modal-route pattern (/feed and /feed/:id)
 * - FeedContainer remains mounted during route transitions
 * 
 * PERFORMANCE:
 * - Memoized components to limit re-renders
 * - Small overscan for smooth scrolling
 * - Zero visual jump on scroll restoration
 * 
 * ============================================================================
 */

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Article } from '@/types';
import { FeedCardCompact } from './FeedCardCompact';
import { useFeedScrollState } from '@/context/FeedScrollStateContext';
import { twMerge } from 'tailwind-merge';

export interface FeedContainerProps {
  /** Articles to display */
  articles: Article[];
  /** Loading state */
  isLoading?: boolean;
  /** Handler for article click - now uses navigation, but kept for compatibility */
  onArticleClick?: (article: Article) => void;
  /** Optional action handlers */
  onLike?: (article: Article) => void;
  onBookmark?: (article: Article) => void;
  onShare?: (article: Article) => void;
  /** Card spacing */
  gap?: number;
  /** Overscan count (cards to render outside viewport) */
  overscan?: number;
  /** Container className */
  className?: string;
}

/**
 * Estimate card height for virtualization
 * Based on:
 * - Image: 4:3 aspect ratio (assuming container width)
 * - Content padding: ~16px top + bottom
 * - Title: ~48px (2 lines)
 * - Metadata: ~20px
 * - Tags: ~32px
 * - Gap: 16px
 * Total: ~viewport width * (3/4) + 132px
 * 
 * For mobile (typical 375px width):
 * - Image: 375 * 0.75 = 281px
 * - Content: 132px
 * - Total: ~413px
 */
function estimateCardHeight(containerWidth: number): number {
  const imageHeight = containerWidth * (3 / 4); // 4:3 aspect ratio
  const contentHeight = 132; // Padding + title + metadata + tags
  return imageHeight + contentHeight;
}

/**
 * FeedContainer Component
 * 
 * Uses TanStack React Virtual for efficient rendering
 */
export const FeedContainer: React.FC<FeedContainerProps> = ({
  articles,
  isLoading = false,
  onArticleClick,
  onLike,
  onBookmark,
  onShare,
  gap = 16,
  overscan = 3,
  className,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const { saveScrollState, restoreScrollState } = useFeedScrollState();
  const hasRestoredScrollRef = useRef(false);
  
  // Track container width for card height calculation
  const [containerWidth, setContainerWidth] = React.useState(375); // Default mobile width
  
  // Track container width for card height calculation
  const [containerWidth, setContainerWidth] = React.useState(375); // Default mobile width
  
  // Calculate card height based on container width
  const cardHeight = useMemo(() => {
    return estimateCardHeight(containerWidth);
  }, [containerWidth]);
  
  // Update container width on mount and resize
  useEffect(() => {
    if (!parentRef.current) return;
    
    const updateWidth = () => {
      if (parentRef.current) {
        setContainerWidth(parentRef.current.clientWidth);
      }
    };
    
    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(parentRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // Virtualizer configuration
  const virtualizer = useVirtualizer({
    count: articles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => cardHeight + gap,
    overscan,
    // Enable smooth scrolling
    measureElement: (element) => element?.getBoundingClientRect().height ?? cardHeight + gap,
  });
  
  // CRITICAL: Restore scroll state AFTER virtualizer is created but BEFORE first render
  // This must happen after virtualizer exists but before items are rendered
  useEffect(() => {
    if (!parentRef.current || hasRestoredScrollRef.current || articles.length === 0) return;
    
    const savedState = restoreScrollState();
    if (savedState && savedState.scrollOffset > 0) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (parentRef.current) {
          // Restore scroll position directly on scroll element
          parentRef.current.scrollTop = savedState.scrollOffset;
          hasRestoredScrollRef.current = true;
        }
      });
    } else {
      hasRestoredScrollRef.current = true; // Mark as processed even if no saved state
    }
  }, [restoreScrollState, articles.length, virtualizer]);
  
  // Force remeasure when card height changes
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, cardHeight]);
  
  // Save scroll state on scroll events
  // PERFORMANCE FIX: Use requestAnimationFrame + debounce for optimal performance
  // Previous implementation used setTimeout which could cause scroll jank.
  // Now we:
  // 1. Batch DOM reads (scrollTop, virtualItems) in RAF to avoid layout thrashing
  // 2. Debounce state saves to avoid excessive context updates
  // 3. Keep listener passive for browser scroll optimizations
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    if (!parentRef.current) return;
    
    // Cancel any pending RAF to avoid multiple queued updates
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    // Batch DOM reads in requestAnimationFrame to avoid layout thrashing
    rafIdRef.current = requestAnimationFrame(() => {
      if (!parentRef.current) return;
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Read DOM values in RAF (after browser has painted)
      const scrollTop = parentRef.current.scrollTop;
      const virtualItems = virtualizer.getVirtualItems();
      const firstVisibleIndex = virtualItems.length > 0 ? virtualItems[0].index : 0;
      
      // Debounce state saving (save after 100ms of no scrolling)
      // This prevents excessive context updates during fast scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        saveScrollState({
          scrollOffset: scrollTop,
          virtualIndex: firstVisibleIndex,
          activeItemId: null, // Set when article is clicked
        });
      }, 100);
      
      rafIdRef.current = null;
    });
  }, [virtualizer, saveScrollState]);
  
  // Attach scroll listener
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;
    
    // Already marked as passive - good for performance
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [handleScroll]);
  
  // Handle article click - save scroll state with active item ID
  const handleArticleClick = useCallback((article: Article) => {
    if (!parentRef.current) return;
    
    const scrollTop = parentRef.current.scrollTop;
    const virtualItems = virtualizer.getVirtualItems();
    const firstVisibleIndex = virtualItems.length > 0 ? virtualItems[0].index : 0;
    
    // Save scroll state with active item ID before navigation
    saveScrollState({
      scrollOffset: scrollTop,
      virtualIndex: firstVisibleIndex,
      activeItemId: article.id,
    });
    
    // Call optional onArticleClick handler (for compatibility)
    if (onArticleClick) {
      onArticleClick(article);
    }
  }, [virtualizer, saveScrollState, onArticleClick]);
  
  // Loading skeleton
  if (isLoading && articles.length === 0) {
    return (
      <div className={twMerge('w-full flex flex-col gap-4', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="h-[400px] bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }
  
  // Empty state
  if (!isLoading && articles.length === 0) {
    return (
      <div className={twMerge('w-full flex flex-col items-center justify-center py-12', className)}>
        <p className="text-slate-500 dark:text-slate-400 text-sm">No articles found</p>
      </div>
    );
  }
  
  return (
    <div
      ref={parentRef}
      className={twMerge(
        'w-full h-full overflow-auto',
        'custom-scrollbar',
        className
      )}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const article = articles[virtualItem.index];
          if (!article) return null;
          
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
            >
              <div className="px-4" style={{ paddingBottom: gap }}>
                <FeedCardCompact
                  article={article}
                  index={virtualItem.index}
                  onClick={handleArticleClick}
                  isInViewport={virtualItem.index < 10} // Consider first 10 as in viewport for fetchPriority
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

