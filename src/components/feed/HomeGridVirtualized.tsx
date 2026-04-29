import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { Article } from '@/types';
import { NewsCard } from '@/components/NewsCard';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';
import { CardError } from '@/components/card/CardError';
import {
  chunkIntoGridRows,
  estimateHomeGridRowHeightPx,
  flatIndexToRowIndex,
  gridRowGapPx,
} from '@/utils/homeGridVirtualization';

export type HomeGridVirtualizedApi = {
  scrollToFlatArticleIndex: (flatIndex: number) => void;
};

interface HomeGridVirtualizedProps {
  displayArticles: Article[];
  columnCount: number;
  shouldAnimate: boolean;
  staggerCapIndex: number;
  onCategoryClick: (category: string) => void;
  onCardClick: (article: Article) => void;
  currentUserId?: string;
  onTagClick?: (tag: string) => void;
  selectionMode?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  disableInlineExpansion: boolean;
  searchHighlightQuery?: string;
  registerCard: (id: string, el: HTMLDivElement | null) => void;
  /** Distance from document top to the top of the virtual list (window scroll offset baseline). */
  scrollMarginTop: number;
  /** Parent exposes imperative scroll for drawer prev/next when the target row is off-screen. */
  apiRef: React.MutableRefObject<HomeGridVirtualizedApi | null>;
}

/**
 * Window-scrolled virtual grid: each virtual row is a CSS grid of up to `columnCount` cards.
 * Phase A: fixed estimate + measureElement for variable row height (no true masonry).
 */
export const HomeGridVirtualized: React.FC<HomeGridVirtualizedProps> = ({
  displayArticles,
  columnCount,
  shouldAnimate,
  staggerCapIndex,
  onCategoryClick,
  onCardClick,
  currentUserId,
  onTagClick,
  selectionMode = false,
  selectedIds = [],
  onSelect,
  disableInlineExpansion,
  searchHighlightQuery,
  registerCard,
  scrollMarginTop,
  apiRef,
}) => {
  const measureParentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useLayoutEffect(() => {
    const el = measureParentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerWidth(el.getBoundingClientRect().width);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(
    () => chunkIntoGridRows(displayArticles, columnCount),
    [displayArticles, columnCount],
  );

  const rowGap = gridRowGapPx();
  const baseEstimate = useMemo(
    () => estimateHomeGridRowHeightPx(containerWidth, columnCount) + rowGap,
    [containerWidth, columnCount, rowGap],
  );

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => baseEstimate,
    overscan: 2,
    scrollMargin: scrollMarginTop,
    measureElement: (el) => el?.getBoundingClientRect().height ?? baseEstimate,
  });

  const scrollToFlatArticleIndex = useCallback(
    (flatIndex: number) => {
      const row = flatIndexToRowIndex(flatIndex, columnCount);
      virtualizer.scrollToIndex(row, { align: 'nearest' });
    },
    [virtualizer, columnCount],
  );

  useLayoutEffect(() => {
    apiRef.current = { scrollToFlatArticleIndex };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, scrollToFlatArticleIndex]);

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, baseEstimate, rows.length]);

  return (
    <div ref={measureParentRef} className="mx-auto w-full">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowArticles = rows[virtualRow.index];
          if (!rowArticles?.length) return null;
          return (
            <div
              key={virtualRow.key}
              data-virtual-row={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                // With window virtualizer + scrollMargin, starts are document-based.
                // Convert to container-local coordinates by subtracting scrollMargin.
                transform: `translateY(${virtualRow.start - scrollMarginTop}px)`,
              }}
              ref={virtualizer.measureElement}
            >
              <div
                className="grid w-full auto-rows-auto items-stretch"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  columnGap: rowGap,
                  // Preserve row spacing between virtualized bands without doubling grid row-gap math.
                  paddingBottom: virtualRow.index < rows.length - 1 ? rowGap : 0,
                }}
              >
                {rowArticles.map((article, colInRow) => {
                  const flatIndex = virtualRow.index * columnCount + colInRow;
                  // Only animate within the first-screen stagger window. Virtualized rows
                  // remount when they re-enter overscan, so applying the fade class past
                  // the cap re-fires on every scroll-back.
                  const animateThisRow = shouldAnimate && flatIndex <= staggerCapIndex;
                  const delay = animateThisRow ? Math.min(flatIndex * 50, 750) : 0;
                  return (
                    <ErrorBoundary
                      key={article.id}
                      fallback={
                        <CardError
                          error={new Error('Failed to render card')}
                          variant="grid"
                        />
                      }
                    >
                      <div
                        className={`
                          h-full flex
                          ${animateThisRow ? 'animate-fade-in-up' : ''}
                          motion-reduce:animate-none motion-reduce:opacity-100
                        `}
                        style={{
                          animationDelay: animateThisRow ? `${delay}ms` : '0ms',
                        }}
                      >
                        <NewsCard
                          ref={(el) => registerCard(article.id, el)}
                          article={article}
                          skipArticlePrepare
                          viewMode="grid"
                          onCategoryClick={onCategoryClick}
                          onClick={onCardClick}
                          currentUserId={currentUserId}
                          onTagClick={onTagClick}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.includes(article.id)}
                          onSelect={onSelect ? () => onSelect(article.id) : undefined}
                          disableInlineExpansion={disableInlineExpansion}
                          searchHighlightQuery={searchHighlightQuery}
                        />
                      </div>
                    </ErrorBoundary>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

HomeGridVirtualized.displayName = 'HomeGridVirtualized';
