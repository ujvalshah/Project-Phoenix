import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronUp,
  ChevronDown,
  GripVertical,
  X,
  Star,
  ChevronRight,
  Grid3X3,
  LayoutGrid,
  Square,
} from 'lucide-react';
import { Image } from '@/components/Image';
import { EmbeddedMedia } from '@/components/embeds/EmbeddedMedia';
import type { MediaType } from '@/types';

/**
 * Media item representation for the UnifiedMediaManager
 */
export interface UnifiedMediaItem {
  id: string;
  url: string;
  type: MediaType;
  thumbnail?: string;
  isDisplayImage: boolean;    // Selected as card thumbnail
  showInMasonry: boolean;     // Show in masonry layout
  showInGrid: boolean;        // Show in grid layout
  showInUtility: boolean;     // Show in utility layout
  masonryTitle?: string;
  isUploading?: boolean;
  uploadError?: string;
  previewMetadata?: Record<string, unknown>;
  order?: number;
}

interface UnifiedMediaManagerProps {
  items: UnifiedMediaItem[];
  onReorder: (sourceIndex: number, destinationIndex: number) => void;
  onDelete: (itemId: string) => void;
  onSetDisplayImage: (itemId: string | null) => void;
  onToggleMasonry: (itemId: string, showInMasonry: boolean) => void;
  onToggleGrid: (itemId: string, showInGrid: boolean) => void;
  onToggleUtility: (itemId: string, showInUtility: boolean) => void;
  onMasonryTitleChange: (itemId: string, title: string) => void;
  onAddMedia: () => void;
  disabled?: boolean;
  showClearThumbnail?: boolean;
}

const MASONRY_TITLE_MAX_LENGTH = 80;

/**
 * Normalize masonry title input
 */
const normalizeMasonryTitle = (input: string): string => {
  return input
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, MASONRY_TITLE_MAX_LENGTH);
};

/**
 * Check if device is mobile (screen width < 768px)
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * Layout visibility icon component
 */
const LayoutIcon: React.FC<{ type: 'grid' | 'masonry' | 'utility'; size?: number }> = ({
  type,
  size = 12,
}) => {
  switch (type) {
    case 'grid':
      return <Grid3X3 size={size} />;
    case 'masonry':
      return <LayoutGrid size={size} />;
    case 'utility':
      return <Square size={size} />;
  }
};

/**
 * Sortable media item for desktop drag-and-drop
 */
interface SortableMediaItemProps {
  item: UnifiedMediaItem;
  index: number;
  onDelete: (itemId: string) => void;
  onSetDisplayImage: (itemId: string) => void;
  onToggleMasonry: (itemId: string, show: boolean) => void;
  onToggleGrid: (itemId: string, show: boolean) => void;
  onToggleUtility: (itemId: string, show: boolean) => void;
  disabled?: boolean;
}

const SortableMediaItem: React.FC<SortableMediaItemProps> = ({
  item,
  index,
  onDelete,
  onSetDisplayImage,
  onToggleMasonry,
  onToggleGrid,
  onToggleUtility,
  disabled,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative group rounded-lg overflow-hidden border-2 transition-all
        ${item.isDisplayImage
          ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
          : 'border-slate-200 dark:border-slate-700'
        }
        ${isDragging ? 'opacity-80 shadow-lg scale-105' : ''}
        ${item.isUploading ? 'opacity-60' : ''}
        bg-slate-50 dark:bg-slate-800
      `}
    >
      {/* Top Row: Drag Handle + Order + Star + Delete */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-1.5 bg-gradient-to-b from-black/60 to-transparent">
        {/* Left: Drag handle + Order */}
        <div className="flex items-center gap-1">
          <div
            {...attributes}
            {...listeners}
            className="p-0.5 text-white/90 cursor-grab active:cursor-grabbing hover:text-white"
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </div>
          <div className="w-5 h-5 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded flex items-center justify-center">
            {index + 1}
          </div>
        </div>

        {/* Right: Star + Delete */}
        <div className="flex items-center gap-1">
          {/* Star/Thumbnail indicator */}
          <button
            type="button"
            onClick={() => onSetDisplayImage(item.id)}
            disabled={disabled || item.isUploading}
            className={`p-1 rounded transition-colors ${
              item.isDisplayImage
                ? 'bg-primary-500 text-white'
                : 'bg-white/20 text-white/70 hover:bg-white/30 hover:text-white'
            }`}
            title={item.isDisplayImage ? 'Card thumbnail' : 'Set as thumbnail'}
          >
            <Star size={12} fill={item.isDisplayImage ? 'currentColor' : 'none'} />
          </button>
          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            disabled={disabled || item.isUploading}
            className="p-1 bg-red-500/80 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-50"
            title="Delete media"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Media Preview */}
      <div className="aspect-video overflow-hidden">
        {item.type === 'image' ? (
          <Image
            src={item.thumbnail || item.url}
            alt={`Media ${index + 1}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
            <EmbeddedMedia
              media={{
                type: item.type,
                url: item.url,
                thumbnail_url: item.thumbnail,
                previewMetadata: item.previewMetadata,
              }}
              onClick={() => {}}
            />
          </div>
        )}

        {/* Upload Progress Indicator */}
        {item.isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
          </div>
        )}

        {/* Upload Error Badge */}
        {item.uploadError && (
          <div className="absolute bottom-0 inset-x-0 bg-red-500 text-white text-xs px-2 py-1 text-center">
            Upload failed
          </div>
        )}
      </div>

      {/* Bottom: Layout visibility toggles */}
      <div className="p-1.5 bg-white dark:bg-slate-850 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          {/* Media type badge + URL debug */}
          <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize" title={item.url}>
            {item.type === 'youtube' ? 'YouTube' : item.type}
            <span className="ml-1 text-[8px] text-slate-400">({item.url.slice(-12)})</span>
          </span>

          {/* Layout toggles */}
          <div className="flex items-center gap-0.5">
            {/* Grid */}
            <button
              type="button"
              onClick={() => onToggleGrid(item.id, !item.showInGrid)}
              disabled={disabled || item.isUploading}
              className={`p-1 rounded transition-colors ${
                item.showInGrid
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
              title={item.showInGrid ? 'Hide from Grid' : 'Show in Grid'}
            >
              <LayoutIcon type="grid" />
            </button>
            {/* Masonry */}
            <button
              type="button"
              onClick={() => onToggleMasonry(item.id, !item.showInMasonry)}
              disabled={disabled || item.isUploading}
              className={`p-1 rounded transition-colors ${
                item.showInMasonry
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
              title={item.showInMasonry ? 'Hide from Masonry' : 'Show in Masonry'}
            >
              <LayoutIcon type="masonry" />
            </button>
            {/* Utility */}
            <button
              type="button"
              onClick={() => onToggleUtility(item.id, !item.showInUtility)}
              disabled={disabled || item.isUploading}
              className={`p-1 rounded transition-colors ${
                item.showInUtility
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
              title={item.showInUtility ? 'Hide from Utility' : 'Show in Utility'}
            >
              <LayoutIcon type="utility" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Mobile media item with up/down arrow buttons
 */
interface MobileMediaItemProps {
  item: UnifiedMediaItem;
  index: number;
  totalItems: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: (itemId: string) => void;
  onSetDisplayImage: (itemId: string) => void;
  onToggleMasonry: (itemId: string, show: boolean) => void;
  onToggleGrid: (itemId: string, show: boolean) => void;
  onToggleUtility: (itemId: string, show: boolean) => void;
  disabled?: boolean;
}

const MobileMediaItem: React.FC<MobileMediaItemProps> = ({
  item,
  index,
  totalItems,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSetDisplayImage,
  onToggleMasonry,
  onToggleGrid,
  onToggleUtility,
  disabled,
}) => {
  return (
    <div
      className={`
        relative rounded-lg border-2 transition-all overflow-hidden
        ${item.isDisplayImage
          ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
          : 'border-slate-200 dark:border-slate-700'
        }
        ${item.isUploading ? 'opacity-60' : ''}
        bg-slate-50 dark:bg-slate-800
      `}
    >
      {/* Top row: Arrows, Preview, Info, Actions */}
      <div className="flex items-center gap-2 p-2">
        {/* Arrow Buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || index === 0}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || index === totalItems - 1}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Order Number */}
        <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded flex items-center justify-center flex-shrink-0">
          {index + 1}
        </div>

        {/* Media Preview */}
        <div className="w-16 h-12 rounded overflow-hidden flex-shrink-0">
          {item.type === 'image' ? (
            <Image
              src={item.thumbnail || item.url}
              alt={`Media ${index + 1}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-[10px] text-slate-500">
              {item.type === 'youtube' ? 'YT' : item.type}
            </div>
          )}
        </div>

        {/* Info & Layout toggles */}
        <div className="flex-1 min-w-0">
          {/* Type + Thumbnail */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">
              {item.type === 'youtube' ? 'YouTube' : item.type}
            </span>
            {item.isDisplayImage && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary-500">
                <Star size={8} fill="currentColor" />
                Thumb
              </span>
            )}
          </div>
          {/* Layout toggles */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleGrid(item.id, !item.showInGrid)}
              disabled={disabled || item.isUploading}
              className={`px-1.5 py-0.5 text-[10px] rounded ${
                item.showInGrid
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              G
            </button>
            <button
              type="button"
              onClick={() => onToggleMasonry(item.id, !item.showInMasonry)}
              disabled={disabled || item.isUploading}
              className={`px-1.5 py-0.5 text-[10px] rounded ${
                item.showInMasonry
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              M
            </button>
            <button
              type="button"
              onClick={() => onToggleUtility(item.id, !item.showInUtility)}
              disabled={disabled || item.isUploading}
              className={`px-1.5 py-0.5 text-[10px] rounded ${
                item.showInUtility
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              U
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSetDisplayImage(item.id)}
            disabled={disabled || item.isUploading}
            className={`p-1.5 rounded ${
              item.isDisplayImage
                ? 'bg-primary-500 text-white'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title={item.isDisplayImage ? 'Card thumbnail' : 'Set as thumbnail'}
          >
            <Star size={14} fill={item.isDisplayImage ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            disabled={disabled || item.isUploading}
            className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
            title="Delete media"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * UnifiedMediaManager: Single component for all media management
 *
 * Combines functionality from:
 * - MediaSection: Layout visibility controls, card thumbnail selection
 * - MediaCarousel: Drag-to-reorder, order numbers
 *
 * Features:
 * - Drag-to-reorder (desktop) / Arrow buttons (mobile)
 * - Card thumbnail selection (star icon)
 * - Layout visibility toggles (Grid/Masonry/Utility)
 * - Delete buttons
 * - Masonry titles (collapsible)
 * - Order numbers
 * - Add more button
 */
export const UnifiedMediaManager: React.FC<UnifiedMediaManagerProps> = ({
  items,
  onReorder,
  onDelete,
  onSetDisplayImage,
  onToggleMasonry,
  onToggleGrid,
  onToggleUtility,
  onMasonryTitleChange,
  onAddMedia,
  disabled = false,
  showClearThumbnail = false,
}) => {
  const isMobile = useIsMobile();
  const [showMasonryTitles, setShowMasonryTitles] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      onReorder(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < items.length - 1) {
      onReorder(index, index + 1);
    }
  };

  const handleTitleChange = (itemId: string, value: string) => {
    const normalized = normalizeMasonryTitle(value);
    onMasonryTitleChange(itemId, normalized);
  };

  // Find items enabled for masonry (exclude 'link' type)
  const masonryEnabledItems = items.filter((item) => item.showInMasonry && item.type !== 'link');
  const displayImageItem = items.find((item) => item.isDisplayImage);

  // Empty state
  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Media Attachments
        </div>
        <button
          type="button"
          onClick={onAddMedia}
          disabled={disabled}
          className="w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Click to add media
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
          <span>Media ({items.length})</span>
          {!isMobile && (
            <span className="text-slate-400 dark:text-slate-500 font-normal">
              Drag to reorder
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onAddMedia}
          disabled={disabled}
          className="text-primary-500 hover:text-primary-600 text-xs font-medium disabled:opacity-50"
        >
          + Add More
        </button>
      </div>

      {/* Media Items */}
      {isMobile ? (
        // Mobile: List with arrow buttons
        <div className="space-y-2">
          {items.map((item, index) => (
            <MobileMediaItem
              key={item.id}
              item={item}
              index={index}
              totalItems={items.length}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              onDelete={onDelete}
              onSetDisplayImage={onSetDisplayImage}
              onToggleMasonry={onToggleMasonry}
              onToggleGrid={onToggleGrid}
              onToggleUtility={onToggleUtility}
              disabled={disabled}
            />
          ))}
        </div>
      ) : (
        // Desktop: Drag-and-drop grid
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((item, index) => (
                <SortableMediaItem
                  key={item.id}
                  item={item}
                  index={index}
                  onDelete={onDelete}
                  onSetDisplayImage={onSetDisplayImage}
                  onToggleMasonry={onToggleMasonry}
                  onToggleGrid={onToggleGrid}
                  onToggleUtility={onToggleUtility}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 pt-1">
        <div className="flex items-center gap-1">
          <Star size={10} className="text-primary-500" fill="currentColor" />
          <span>= Thumbnail</span>
        </div>
        <div className="flex items-center gap-1">
          <LayoutIcon type="grid" size={10} />
          <span>= Grid</span>
        </div>
        <div className="flex items-center gap-1">
          <LayoutIcon type="masonry" size={10} />
          <span>= Masonry</span>
        </div>
        <div className="flex items-center gap-1">
          <LayoutIcon type="utility" size={10} />
          <span>= Utility</span>
        </div>
      </div>

      {/* Masonry Titles Section (Collapsible) */}
      {masonryEnabledItems.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
          <button
            type="button"
            onClick={() => setShowMasonryTitles(!showMasonryTitles)}
            className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ChevronRight
              size={14}
              className={`transition-transform ${showMasonryTitles ? 'rotate-90' : ''}`}
            />
            Masonry Titles ({masonryEnabledItems.length})
            <span className="text-slate-400 dark:text-slate-500 font-normal">
              (optional)
            </span>
          </button>

          {showMasonryTitles && (
            <div className="mt-3 space-y-2">
              {masonryEnabledItems.map((item, index) => (
                <div key={`title-${item.id}`} className="flex items-center gap-2">
                  <div className="w-10 h-8 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={item.thumbnail || item.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="text"
                    value={item.masonryTitle || ''}
                    onChange={(e) => handleTitleChange(item.id, e.target.value)}
                    placeholder={`Title for #${index + 1}`}
                    maxLength={MASONRY_TITLE_MAX_LENGTH}
                    disabled={disabled}
                    className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                  />
                </div>
              ))}
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Titles appear as captions on hover in Masonry view.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
        {displayImageItem && (
          <div className="flex items-center gap-2">
            <span>
              Thumbnail: {displayImageItem.type === 'image' ? 'Image' : displayImageItem.type} #{items.indexOf(displayImageItem) + 1}
            </span>
            {showClearThumbnail && (
              <button
                type="button"
                onClick={() => onSetDisplayImage(null)}
                disabled={disabled}
                className="text-primary-500 hover:text-primary-600 underline disabled:opacity-50"
              >
                Reset
              </button>
            )}
          </div>
        )}
        {masonryEnabledItems.length === 0 && (
          <p className="text-amber-600 dark:text-amber-400">
            No items for Masonry view - nugget won't appear in Masonry layout
          </p>
        )}
      </div>
    </div>
  );
};
