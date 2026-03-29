import React from 'react';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, Folder } from 'lucide-react';
import { AdminCollection } from '../types/admin';

interface FeaturedSortableListProps {
  collections: AdminCollection[];
  onReorder: (orderedIds: string[]) => void;
  onRemoveFeatured: (col: AdminCollection) => void;
}

interface SortableItemProps {
  collection: AdminCollection;
  index: number;
  onRemoveFeatured: (col: AdminCollection) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ collection, index, onRemoveFeatured }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: collection.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        isDragging
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 shadow-lg'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing touch-none"
        title="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>

      {/* Position badge */}
      <span className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
        {index + 1}
      </span>

      {/* Collection info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-400">
          <Folder size={14} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{collection.name}</div>
          <div className="text-[10px] text-slate-400 truncate">{collection.creator?.name}</div>
        </div>
      </div>

      {/* Nugget count */}
      <span className="text-[10px] font-bold text-slate-400 shrink-0">
        {collection.itemCount} nuggets
      </span>

      {/* Remove from featured */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemoveFeatured(collection); }}
        title="Remove from toolbar"
        className="p-1.5 rounded-lg text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
      >
        <Star size={14} fill="currentColor" />
      </button>
    </div>
  );
};

export const FeaturedSortableList: React.FC<FeaturedSortableListProps> = ({
  collections,
  onReorder,
  onRemoveFeatured,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = collections.findIndex((c) => c.id === active.id);
    const newIndex = collections.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(collections, oldIndex, newIndex);
    onReorder(reordered.map((c) => c.id));
  };

  if (collections.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic py-2">
        No featured collections. Star a public collection to add it to the toolbar.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={collections.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {collections.map((col, index) => (
            <SortableItem
              key={col.id}
              collection={col}
              index={index}
              onRemoveFeatured={onRemoveFeatured}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
