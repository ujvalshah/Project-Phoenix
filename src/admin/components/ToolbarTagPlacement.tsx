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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowDownAZ, TrendingUp, Clock, Settings2 } from 'lucide-react';
import { useTagTaxonomy } from '@/hooks/useTagTaxonomy';
import { adminTagsService } from '../services/adminTagsService';
import { useToast } from '@/hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';
import type { TaxonomyTag } from '@/types';

type SortMode = 'a-z' | 'most-nuggets' | 'latest' | 'custom';

const SORT_OPTIONS: { value: SortMode; label: string; icon: React.ReactNode }[] = [
  { value: 'a-z', label: 'A to Z', icon: <ArrowDownAZ size={14} /> },
  { value: 'most-nuggets', label: 'Most Nuggets', icon: <TrendingUp size={14} /> },
  { value: 'latest', label: 'Latest', icon: <Clock size={14} /> },
  { value: 'custom', label: 'Custom Order', icon: <Settings2 size={14} /> },
];

/**
 * Admin panel for managing toolbar tag placement order.
 * Shows separate sections for Format and Domain dimensions,
 * each with sort mode selection and drag-and-drop custom ordering.
 */
export const ToolbarTagPlacement: React.FC = () => {
  const { data: taxonomy, isLoading } = useTagTaxonomy();
  const toast = useToast();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Settings2 size={16} className="text-primary-500" />
          Toolbar Tag Placement
        </h3>
        <div className="space-y-3">
          <div className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-32 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!taxonomy || (taxonomy.formats.length === 0 && taxonomy.domains.length === 0)) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Settings2 size={16} className="text-primary-500" />
          Toolbar Tag Placement
        </h3>
        <p className="text-xs text-slate-400 italic py-2">
          No format or domain tags configured. Assign dimensions to tags first.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
        <Settings2 size={16} className="text-primary-500" />
        Toolbar Tag Placement
        <span className="text-xs font-normal text-slate-400">Controls the order of tags in the home feed toolbar</span>
      </h3>

      <div className="space-y-6">
        {taxonomy.formats.length > 0 && (
          <DimensionPlacement
            title="Content Format"
            dimension="format"
            tags={taxonomy.formats}
            accentColor="blue"
            toast={toast}
            queryClient={queryClient}
          />
        )}

        {taxonomy.domains.length > 0 && (
          <DimensionPlacement
            title="Subject Domain"
            dimension="domain"
            tags={taxonomy.domains}
            accentColor="emerald"
            toast={toast}
            queryClient={queryClient}
          />
        )}
      </div>
    </div>
  );
};

// ─── Per-Dimension Placement Section ─────────────────────────────────────────

interface DimensionPlacementProps {
  title: string;
  dimension: 'format' | 'domain';
  tags: TaxonomyTag[];
  accentColor: 'blue' | 'emerald';
  toast: ReturnType<typeof useToast>;
  queryClient: ReturnType<typeof useQueryClient>;
}

const DimensionPlacement: React.FC<DimensionPlacementProps> = ({
  title,
  dimension,
  tags: initialTags,
  accentColor,
  toast,
  queryClient,
}) => {
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const [orderedTags, setOrderedTags] = useState<TaxonomyTag[]>(initialTags);
  const [isSaving, setIsSaving] = useState(false);

  // Sync when taxonomy data changes
  useEffect(() => {
    setOrderedTags(initialTags);
  }, [initialTags]);

  const handleSortModeChange = async (mode: SortMode) => {
    setSortMode(mode);

    if (mode === 'custom') {
      // Already in current order, no API call needed
      return;
    }

    // Apply sort client-side for immediate preview
    const sorted = [...orderedTags];
    if (mode === 'a-z') {
      sorted.sort((a, b) => a.rawName.localeCompare(b.rawName));
    } else if (mode === 'most-nuggets') {
      sorted.sort((a, b) => b.usageCount - a.usageCount);
    } else if (mode === 'latest') {
      // Can't sort by createdAt client-side (not in TaxonomyTag),
      // let the backend handle it
    }

    if (mode !== 'latest') {
      setOrderedTags(sorted);
    }

    // Persist via API
    setIsSaving(true);
    try {
      await adminTagsService.reorderToolbarTags(dimension, { mode });
      await queryClient.invalidateQueries({ queryKey: ['tagTaxonomy'] });
      toast.success(`${title} sorted by ${SORT_OPTIONS.find(o => o.value === mode)?.label}`);
    } catch {
      toast.error('Failed to reorder tags');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragReorder = async (newOrder: TaxonomyTag[]) => {
    setOrderedTags(newOrder);
    setSortMode('custom');

    setIsSaving(true);
    try {
      await adminTagsService.reorderToolbarTags(dimension, {
        tagIds: newOrder.map(t => t.id),
      });
      await queryClient.invalidateQueries({ queryKey: ['tagTaxonomy'] });
    } catch {
      toast.error('Failed to save custom order');
      setOrderedTags(initialTags); // revert
    } finally {
      setIsSaving(false);
    }
  };

  const accentBorder = accentColor === 'blue'
    ? 'border-l-blue-400 dark:border-l-blue-600'
    : 'border-l-emerald-400 dark:border-l-emerald-600';

  return (
    <div className={`border-l-2 ${accentBorder} pl-3`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          {title}
          <span className="ml-2 text-[10px] font-normal text-slate-400 lowercase tracking-normal">
            {orderedTags.length} tag{orderedTags.length !== 1 ? 's' : ''}
          </span>
        </h4>

        {/* Sort mode selector */}
        <div className="flex items-center gap-1">
          {isSaving && (
            <span className="text-[10px] text-slate-400 mr-1">Saving...</span>
          )}
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortModeChange(opt.value)}
              disabled={isSaving}
              title={opt.label}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                sortMode === opt.value
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800'
              } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drag-and-drop list */}
      <SortableTagList
        tags={orderedTags}
        onReorder={handleDragReorder}
        accentColor={accentColor}
      />
    </div>
  );
};

// ─── Sortable Tag List (DnD) ─────────────────────────────────────────────────

interface SortableTagListProps {
  tags: TaxonomyTag[];
  onReorder: (newOrder: TaxonomyTag[]) => void;
  accentColor: 'blue' | 'emerald';
}

const SortableTagList: React.FC<SortableTagListProps> = ({ tags, onReorder, accentColor }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tags.findIndex((t) => t.id === active.id);
    const newIndex = tags.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(tags, oldIndex, newIndex));
  };

  if (tags.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic py-2">
        No tags in this dimension.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tags.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {tags.map((tag, index) => (
            <SortableTagItem key={tag.id} tag={tag} index={index} accentColor={accentColor} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

// ─── Single Sortable Tag Item ────────────────────────────────────────────────

const SortableTagItem: React.FC<{
  tag: TaxonomyTag;
  index: number;
  accentColor: 'blue' | 'emerald';
}> = ({ tag, index, accentColor }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const dragBg = accentColor === 'blue'
    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
        isDragging
          ? `${dragBg} shadow-lg`
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
        <GripVertical size={14} />
      </button>

      {/* Position badge */}
      <span className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
        {index + 1}
      </span>

      {/* Tag name */}
      <span className="text-sm font-semibold text-slate-800 dark:text-white flex-1 truncate">
        {tag.rawName}
      </span>

      {/* Usage count */}
      <span className="text-[10px] font-bold text-slate-400 shrink-0">
        {tag.usageCount} nuggets
      </span>
    </div>
  );
};
