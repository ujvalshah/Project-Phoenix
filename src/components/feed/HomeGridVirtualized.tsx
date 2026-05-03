import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { Article } from '@/types';
import { NewsCard } from '@/components/NewsCard';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';
import { CardError } from '@/components/card/CardError';
import { getPriorityThumbnailCount } from '@/constants/aboveFoldPriority';
import {
  chunkIntoGridRows,
  estimateHomeGridRowHeightPx,
  flatIndexToRowIndex,
  gridRowGapPx,
  HOME_FEED_WINDOW_VIRTUAL_OVERSCAN_ROWS,
} from '@/utils/homeGridVirtualization';
import { recordMeasureEffect } from '@/utils/devFeedCloseAnalysis';

export type HomeGridVirtualizedApi = {
  scrollToFlatArticleIndex: (flatIndex: number) => void;
};

interface VirtualizedRowProps {
  rowIndex: number;
  rowStart: number;
  rowsLength: number;
  scrollMarginTop: number;
  columnCount: number;
  rowGap: number;
  rowArticles: Article[];
  shouldAnimate: boolean;
  staggerCapIndex: number;
  priorityThumbnailCount: number;
  selectionMode: boolean;
  selectedIdSet: ReadonlySet<string>;
  disableInlineExpansion: boolean;
  searchHighlightQuery?: string;
  currentUserId?: string;
  onCategoryClick: (category: string) => void;
  onCardClick: (article: Article) => void;
  onTagClick?: (tag: string) => void;
  getSelectCallbackForArticle: (id: string) => (() => void) | undefined;
  getRegisterRefForArticle: (id: string) => (el: HTMLDivElement | null) => void;
  measureElement: (el: HTMLElement | null) => void;
}

const VirtualizedRow = React.memo(function VirtualizedRow({
  rowIndex,
  rowStart,
  rowsLength,
  scrollMarginTop,
  columnCount,
  rowGap,
  rowArticles,
  shouldAnimate,
  staggerCapIndex,
  priorityThumbnailCount,
  selectionMode,
  selectedIdSet,
  disableInlineExpansion,
  searchHighlightQuery,
  currentUserId,
  onCategoryClick,
  onCardClick,
  onTagClick,
  getSelectCallbackForArticle,
  getRegisterRefForArticle,
  measureElement,
}: VirtualizedRowProps) {
  return (
    <div
      data-index={rowIndex}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        // With window virtualizer + scrollMargin, starts are document-based.
        // Convert to container-local coordinates by subtracting scrollMargin.
        transform: `translateY(${rowStart - scrollMarginTop}px)`,
      }}
      ref={measureElement}
    >
      <div
        className="grid w-full auto-rows-auto items-stretch"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          columnGap: rowGap,
          // Preserve row spacing between virtualized bands without doubling grid row-gap math.
          paddingBottom: rowIndex < rowsLength - 1 ? rowGap : 0,
        }}
      >
        {rowArticles.map((article, colInRow) => {
          const flatIndex = rowIndex * columnCount + colInRow;
          const isPriorityTile = flatIndex < priorityThumbnailCount;
          // Only animate within the first-screen stagger window. Virtualized rows
          // remount when they re-enter overscan, so applying the fade class past
          // the cap re-fires on every scroll-back.
          const animateThisRow =
            shouldAnimate &&
            !isPriorityTile &&
            flatIndex <= staggerCapIndex;
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
                  ref={getRegisterRefForArticle(article.id)}
                  article={article}
                  skipArticlePrepare
                  viewMode="grid"
                  onCategoryClick={onCategoryClick}
                  onClick={onCardClick}
                  currentUserId={currentUserId}
                  onTagClick={onTagClick}
                  selectionMode={selectionMode}
                  isSelected={selectedIdSet.has(article.id)}
                  onSelect={getSelectCallbackForArticle(article.id)}
                  disableInlineExpansion={disableInlineExpansion}
                  searchHighlightQuery={searchHighlightQuery}
                  priorityThumbnail={isPriorityTile}
                />
              </div>
            </ErrorBoundary>
          );
        })}
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.rowArticles !== next.rowArticles) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.rowStart !== next.rowStart) return false;
  if (prev.rowsLength !== next.rowsLength) return false;
  if (prev.scrollMarginTop !== next.scrollMarginTop) return false;
  if (prev.columnCount !== next.columnCount) return false;
  if (prev.rowGap !== next.rowGap) return false;
  if (prev.shouldAnimate !== next.shouldAnimate) return false;
  if (prev.staggerCapIndex !== next.staggerCapIndex) return false;
  if (prev.priorityThumbnailCount !== next.priorityThumbnailCount) return false;
  if (prev.selectionMode !== next.selectionMode) return false;
  if (prev.disableInlineExpansion !== next.disableInlineExpansion) return false;
  if (prev.searchHighlightQuery !== next.searchHighlightQuery) return false;
  if (prev.currentUserId !== next.currentUserId) return false;
  if (prev.onCategoryClick !== next.onCategoryClick) return false;
  if (prev.onCardClick !== next.onCardClick) return false;
  if (prev.onTagClick !== next.onTagClick) return false;
  if (prev.getSelectCallbackForArticle !== next.getSelectCallbackForArticle) return false;
  if (prev.getRegisterRefForArticle !== next.getRegisterRefForArticle) return false;
  if (prev.measureElement !== next.measureElement) return false;

  if (prev.selectedIdSet !== next.selectedIdSet) {
    for (const article of prev.rowArticles) {
      if (prev.selectedIdSet.has(article.id) !== next.selectedIdSet.has(article.id)) {
        return false;
      }
    }
  }

  return true;
});

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
  /** TanStack Virtual `overscan` in row units; defaults {@link HOME_FEED_WINDOW_VIRTUAL_OVERSCAN_ROWS}. */
  overscanRows?: number;
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
  overscanRows,
}) => {
  const measureParentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const prevDisplayArticlesRef = useRef<Article[]>([]);
  const prevRowsRef = useRef<Article[][]>([]);
  const prevColumnCountRef = useRef(columnCount);

  /** Stable per-row ref callbacks avoid ref churn when the parent virtualizer re-renders. */
  const registerRefByIdRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const getRegisterRefForArticle = useCallback(
    (id: string) => {
      const map = registerRefByIdRef.current;
      let cb = map.get(id);
      if (!cb) {
        cb = (el: HTMLDivElement | null) => registerCard(id, el);
        map.set(id, cb);
      }
      return cb;
    },
    [registerCard],
  );

  /** Stable per-card select closures when `selectionMode` is on. */
  const selectCbByArticleIdRef = useRef<Map<string, () => void>>(new Map());
  useLayoutEffect(() => {
    selectCbByArticleIdRef.current.clear();
  }, [onSelect]);

  const getSelectCallbackForArticle = useCallback(
    (id: string) => {
      if (!onSelect) return undefined;
      const map = selectCbByArticleIdRef.current;
      let cb = map.get(id);
      if (!cb) {
        cb = () => onSelect(id);
        map.set(id, cb);
      }
      return cb;
    },
    [onSelect],
  );

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

  const rows = useMemo(() => {
    const prevArticles = prevDisplayArticlesRef.current;
    const prevRows = prevRowsRef.current;
    const canIncrementallyAppend =
      prevColumnCountRef.current === columnCount &&
      prevArticles.length > 0 &&
      displayArticles.length >= prevArticles.length &&
      prevArticles.every((prevArticle, idx) => prevArticle === displayArticles[idx]);

    if (canIncrementallyAppend) {
      const nextRows = prevRows.slice();
      let workingLastRow = nextRows.length > 0 ? [...nextRows[nextRows.length - 1]] : [];
      if (nextRows.length > 0) {
        nextRows[nextRows.length - 1] = workingLastRow;
      }

      for (let i = prevArticles.length; i < displayArticles.length; i += 1) {
        const article = displayArticles[i];
        if (workingLastRow.length < columnCount) {
          workingLastRow.push(article);
        } else {
          workingLastRow = [article];
          nextRows.push(workingLastRow);
        }
      }

      prevDisplayArticlesRef.current = displayArticles;
      prevRowsRef.current = nextRows;
      prevColumnCountRef.current = columnCount;
      return nextRows;
    }

    const rebuiltRows = chunkIntoGridRows(displayArticles, columnCount);
    prevDisplayArticlesRef.current = displayArticles;
    prevRowsRef.current = rebuiltRows;
    prevColumnCountRef.current = columnCount;
    return rebuiltRows;
  }, [displayArticles, columnCount]);

  const rowGap = gridRowGapPx();
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const priorityThumbnailCount = useMemo(
    () => getPriorityThumbnailCount(columnCount),
    [columnCount],
  );
  const baseEstimate = useMemo(
    () => estimateHomeGridRowHeightPx(containerWidth, columnCount) + rowGap,
    [containerWidth, columnCount, rowGap],
  );

  const overscan =
    overscanRows !== undefined && overscanRows >= 0 ? overscanRows : HOME_FEED_WINDOW_VIRTUAL_OVERSCAN_ROWS;

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => baseEstimate,
    overscan,
    scrollMargin: scrollMarginTop,
    measureElement: (el) => el?.getBoundingClientRect().height ?? baseEstimate,
  });

  const scrollToFlatArticleIndex = useCallback(
    (flatIndex: number) => {
      const row = flatIndexToRowIndex(flatIndex, columnCount);
      virtualizer.scrollToIndex(row, { align: 'start' });
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
    if (import.meta.env.DEV) {
      recordMeasureEffect();
    }
  }, [virtualizer, baseEstimate]);

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
            <VirtualizedRow
              key={virtualRow.key}
              rowIndex={virtualRow.index}
              rowStart={virtualRow.start}
              rowsLength={rows.length}
              scrollMarginTop={scrollMarginTop}
              columnCount={columnCount}
              rowGap={rowGap}
              rowArticles={rowArticles}
              shouldAnimate={shouldAnimate}
              staggerCapIndex={staggerCapIndex}
              priorityThumbnailCount={priorityThumbnailCount}
              selectionMode={selectionMode}
              selectedIdSet={selectedIdSet}
              disableInlineExpansion={disableInlineExpansion}
              searchHighlightQuery={searchHighlightQuery}
              currentUserId={currentUserId}
              onCategoryClick={onCategoryClick}
              onCardClick={onCardClick}
              onTagClick={onTagClick}
              getSelectCallbackForArticle={getSelectCallbackForArticle}
              getRegisterRefForArticle={getRegisterRefForArticle}
              measureElement={virtualizer.measureElement}
            />
          );
        })}
      </div>
    </div>
  );
};

HomeGridVirtualized.displayName = 'HomeGridVirtualized';
