import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { Article } from '@/types';
import {
  chunkIntoGridRows,
  estimateWorkspaceGridRowHeightPx,
  estimateWorkspaceListBandHeightPx,
  workspaceGridColumnCount,
  workspaceGridRowGapPx,
  workspaceListRowGapPx,
  WORKSPACE_LIBRARY_VIRTUAL_MIN_ITEMS,
} from '@/utils/workspaceLibraryVirtualization';
import { NuggetGridCard } from '@/components/workspace/NuggetGridCard';
import { NuggetListRow } from '@/components/workspace/NuggetListRow';

const GRID_OVERSCAN_ROWS = 4;
const LIST_OVERSCAN_ROWS = 6;

type GridProps = {
  articles: Article[];
  selectionMode: boolean;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onOpen: (article: Article) => void;
  priorityThumbnailFlatCount: number;
};

export const WorkspaceLibraryGridVirtualized: React.FC<GridProps> = ({
  articles,
  selectionMode,
  selectedIds,
  onSelect,
  onOpen,
  priorityThumbnailFlatCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [containerWidth, setContainerWidth] = useState(1200);

  const shouldVirtualize = articles.length >= WORKSPACE_LIBRARY_VIRTUAL_MIN_ITEMS;

  const columnCount = useMemo(
    () => workspaceGridColumnCount(containerWidth),
    [containerWidth],
  );

  const rows = useMemo(
    () => chunkIntoGridRows(articles, columnCount),
    [articles, columnCount],
  );

  const rowGap = workspaceGridRowGapPx();
  const baseEstimate = useMemo(
    () => estimateWorkspaceGridRowHeightPx(containerWidth, columnCount) + rowGap,
    [containerWidth, columnCount, rowGap],
  );

  useLayoutEffect(() => {
    if (!shouldVirtualize) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
      setContainerWidth(rect.width);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [shouldVirtualize, articles.length]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => baseEstimate,
    overscan: GRID_OVERSCAN_ROWS,
    scrollMargin,
    enabled: shouldVirtualize,
    getItemKey: (index) =>
      rows[index]?.map((a) => a.id).join('|') || String(index),
    measureElement: (el) => el?.getBoundingClientRect().height ?? baseEstimate,
  });

  useLayoutEffect(() => {
    if (!shouldVirtualize) return;
    virtualizer.measure();
  }, [virtualizer, shouldVirtualize, baseEstimate, rows.length, scrollMargin]);

  if (!shouldVirtualize) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {articles.map((item, index) => (
          <NuggetGridCard
            key={item.id}
            article={item}
            selectionMode={selectionMode}
            isSelected={selectedIds.includes(item.id)}
            onSelect={onSelect}
            onOpen={onOpen}
            priorityThumbnail={index < priorityThumbnailFlatCount}
          />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mx-auto w-full">
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
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
              ref={virtualizer.measureElement}
            >
              <div
                className="grid w-full auto-rows-auto items-stretch"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  columnGap: rowGap,
                  paddingBottom: virtualRow.index < rows.length - 1 ? rowGap : 0,
                }}
              >
                {rowArticles.map((article, colInRow) => {
                  const flatIndex = virtualRow.index * columnCount + colInRow;
                  return (
                    <NuggetGridCard
                      key={article.id}
                      article={article}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.includes(article.id)}
                      onSelect={onSelect}
                      onOpen={onOpen}
                      priorityThumbnail={flatIndex < priorityThumbnailFlatCount}
                    />
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

type ListProps = {
  articles: Article[];
  selectionMode: boolean;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onOpen: (article: Article) => void;
  compact: boolean;
  canManage: boolean;
  onEdit: (article: Article) => void;
  onDuplicate: (article: Article) => void;
  onDelete: (article: Article) => void;
  priorityThumbnailFlatCount: number;
};

export const WorkspaceLibraryListVirtualized: React.FC<ListProps> = ({
  articles,
  selectionMode,
  selectedIds,
  onSelect,
  onOpen,
  compact,
  canManage,
  onEdit,
  onDuplicate,
  onDelete,
  priorityThumbnailFlatCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const shouldVirtualize = articles.length >= WORKSPACE_LIBRARY_VIRTUAL_MIN_ITEMS;
  const rowGap = workspaceListRowGapPx();
  const baseEstimate = estimateWorkspaceListBandHeightPx(compact);

  useLayoutEffect(() => {
    if (!shouldVirtualize) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [shouldVirtualize, articles.length, compact]);

  const virtualizer = useWindowVirtualizer({
    count: articles.length,
    estimateSize: () => baseEstimate,
    overscan: LIST_OVERSCAN_ROWS,
    scrollMargin,
    enabled: shouldVirtualize,
    getItemKey: (index) => articles[index]?.id ?? index,
    measureElement: (el) => el?.getBoundingClientRect().height ?? baseEstimate,
  });

  useLayoutEffect(() => {
    if (!shouldVirtualize) return;
    virtualizer.measure();
  }, [virtualizer, shouldVirtualize, baseEstimate, articles.length, scrollMargin]);

  if (!shouldVirtualize) {
    return (
      <div className="flex flex-col gap-2.5">
        {articles.map((item, index) => (
          <NuggetListRow
            key={item.id}
            article={item}
            selectionMode={selectionMode}
            isSelected={selectedIds.includes(item.id)}
            onSelect={onSelect}
            onOpen={onOpen}
            compact={compact}
            canManage={canManage}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            priorityThumbnail={index < priorityThumbnailFlatCount}
          />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mx-auto w-full">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const article = articles[vi.index];
          if (!article) return null;
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start - scrollMargin}px)`,
              }}
              ref={virtualizer.measureElement}
            >
              <div
                style={{
                  paddingBottom: vi.index < articles.length - 1 ? rowGap : 0,
                }}
              >
                <NuggetListRow
                  article={article}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.includes(article.id)}
                  onSelect={onSelect}
                  onOpen={onOpen}
                  compact={compact}
                  canManage={canManage}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  priorityThumbnail={vi.index < priorityThumbnailFlatCount}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
