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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronUp, ChevronDown, GripVertical, X, Star } from 'lucide-react';
import { Image } from '@/components/Image';
import type { MediaSectionItem } from './MediaSection';

interface MediaCarouselProps {
  items: MediaSectionItem[];
  onReorder: (sourceIndex: number, destinationIndex: number) => void;
  onDelete: (itemId: string) => void;
  onSetDisplayImage: (itemId: string | null) => void;
  disabled?: boolean;
}

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
 * Sortable media item for desktop drag-and-drop
 */
interface SortableItemProps {
  item: MediaSectionItem;
  index: number;
  onDelete: (itemId: string) => void;
  onSetDisplayImage: (itemId: string) => void;
  disabled?: boolean;
}

const SortableItem: React.FC<SortableItemProps> = ({
  item,
  index,
  onDelete,
  onSetDisplayImage,
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
        ${isDragging ? 'opacity-80 shadow-lg' : ''}
        bg-slate-50 dark:bg-slate-800
      `}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1 bg-black/60 text-white rounded cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </div>

      {/* Order Badge */}
      <div className="absolute top-2 left-10 z-10 w-5 h-5 bg-black/60 text-white text-xs font-medium rounded flex items-center justify-center">
        {index + 1}
      </div>

      {/* Display Image Badge (Star) */}
      {item.isDisplayImage && (
        <div
          className="absolute top-2 right-10 z-10 bg-primary-500 text-white p-1 rounded-full shadow-lg cursor-pointer"
          title="Card thumbnail"
        >
          <Star size={12} fill="currentColor" />
        </div>
      )}

      {/* Delete Button */}
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        disabled={disabled}
        className="absolute top-2 right-2 z-10 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
        title="Delete media"
      >
        <X size={14} />
      </button>

      {/* Media Preview */}
      <div
        className="aspect-video overflow-hidden cursor-pointer"
        onClick={() => onSetDisplayImage(item.id)}
        title="Click to set as card thumbnail"
      >
        <Image
          src={item.thumbnail || item.url}
          alt={`Media ${index + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Media Type Badge */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded backdrop-blur-sm">
        {item.type === 'image' ? 'Image' : item.type === 'youtube' ? 'YouTube' : item.type}
      </div>
    </div>
  );
};

/**
 * Mobile media item with up/down arrow buttons
 */
interface MobileItemProps {
  item: MediaSectionItem;
  index: number;
  totalItems: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: (itemId: string) => void;
  onSetDisplayImage: (itemId: string) => void;
  disabled?: boolean;
}

const MobileItem: React.FC<MobileItemProps> = ({
  item,
  index,
  totalItems,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSetDisplayImage,
  disabled,
}) => {
  return (
    <div
      className={`
        relative flex items-center gap-3 p-2 rounded-lg border-2 transition-all
        ${item.isDisplayImage
          ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
          : 'border-slate-200 dark:border-slate-700'
        }
        bg-slate-50 dark:bg-slate-800
      `}
    >
      {/* Arrow Buttons */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={disabled || index === 0}
          className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
        >
          <ChevronUp size={18} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={disabled || index === totalItems - 1}
          className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Order Number */}
      <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded flex items-center justify-center flex-shrink-0">
        {index + 1}
      </div>

      {/* Media Preview */}
      <div
        className="w-20 h-14 rounded overflow-hidden flex-shrink-0 cursor-pointer"
        onClick={() => onSetDisplayImage(item.id)}
        title="Click to set as card thumbnail"
      >
        <Image
          src={item.thumbnail || item.url}
          alt={`Media ${index + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">
            {item.type}
          </span>
          {item.isDisplayImage && (
            <span className="inline-flex items-center gap-1 text-xs text-primary-500">
              <Star size={10} fill="currentColor" />
              Thumbnail
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
          {item.url}
        </p>
      </div>

      {/* Delete Button */}
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        disabled={disabled}
        className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
        title="Delete media"
      >
        <X size={16} />
      </button>
    </div>
  );
};

/**
 * MediaCarousel: Drag-and-drop carousel ordering for media items
 *
 * Features:
 * - Desktop: Drag-and-drop grid with @dnd-kit
 * - Mobile: Up/Down arrow buttons for reordering
 * - Visual order numbers
 * - Thumbnail selection on click
 * - Delete buttons
 */
export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  items,
  onReorder,
  onDelete,
  onSetDisplayImage,
  disabled = false,
}) => {
  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
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

  if (items.length === 0) {
    return null;
  }

  // Mobile: List with arrow buttons
  if (isMobile) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
          <span>Media Order ({items.length})</span>
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            - Use arrows to reorder
          </span>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <MobileItem
              key={item.id}
              item={item}
              index={index}
              totalItems={items.length}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              onDelete={onDelete}
              onSetDisplayImage={onSetDisplayImage}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    );
  }

  // Desktop: Drag-and-drop grid
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <span>Media Order ({items.length})</span>
        <span className="text-slate-400 dark:text-slate-500 font-normal">
          - Drag to reorder
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item, index) => (
              <SortableItem
                key={item.id}
                item={item}
                index={index}
                onDelete={onDelete}
                onSetDisplayImage={onSetDisplayImage}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        First image = default carousel start. Click any image to set as card thumbnail.
      </p>
    </div>
  );
};
