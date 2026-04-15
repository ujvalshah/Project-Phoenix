import React, { useEffect, useState } from 'react';
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
import { ExternalLink, Pencil, GripVertical, X, Eye } from 'lucide-react';
import { useAdminHeader } from '../layout/AdminLayout';
import { useLegalPages, useLegalPageFull, useUpdateLegalPage } from '@/hooks/useLegalPages';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ModalShell } from '@/components/UI/ModalShell';
import type { LegalPageConfig } from '@/services/legalService';

/** Toggle switch component */
const Toggle: React.FC<{
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}> = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`
      relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
      transition-colors duration-200 ease-in-out
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      ${checked ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}
    `}
  >
    <span
      className={`
        pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow
        ring-0 transition duration-200 ease-in-out
        ${checked ? 'translate-x-4' : 'translate-x-0'}
      `}
    />
  </button>
);

/** Format ISO date for display */
function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** ─── Editor Modal ─── */
const EditorModal: React.FC<{
  slug: string;
  onClose: () => void;
}> = ({ slug, onClose }) => {
  const { data: page, isLoading } = useLegalPageFull(slug);
  const updateMutation = useUpdateLegalPage();
  const [content, setContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (page?.content !== undefined) {
      setContent(page.content);
      setHasChanges(false);
    }
  }, [page?.content]);

  const handleSave = () => {
    updateMutation.mutate(
      { slug, data: { content, lastUpdated: new Date().toISOString() } },
      { onSuccess: () => { setHasChanges(false); onClose(); } }
    );
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  return (
    <ModalShell isOpen onClose={onClose} wrapperClassName="p-4" backdropClassName="bg-black/50 backdrop-blur-sm">
      <div className="relative z-10 w-full max-w-5xl mx-auto max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Edit: {page?.title ?? slug}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">/legal/{slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showPreview
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Eye size={14} />
              Preview
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : showPreview ? (
            /* Preview mode — side by side */
            <div className="flex-1 flex divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                  Markdown
                </div>
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="flex-1 w-full p-4 font-mono text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none focus:outline-none"
                  spellCheck={false}
                />
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                  Preview
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <MarkdownRenderer content={content} prose />
                </div>
              </div>
            </div>
          ) : (
            /* Edit-only mode — full width */
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="flex-1 w-full p-6 font-mono text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none focus:outline-none"
              spellCheck={false}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/30">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hasChanges ? 'Unsaved changes' : 'No changes'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
              className="px-4 py-2 text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

/** ─── Sortable Row ─── */
const SortableRow: React.FC<{
  page: LegalPageConfig;
  isMutating: boolean;
  onToggle: (page: LegalPageConfig, field: 'enabled' | 'showInFooter', value: boolean) => void;
  onEdit: (slug: string) => void;
}> = ({ page, isMutating, onToggle, onEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors ${
        isDragging
          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 shadow-lg'
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

      {/* Title & Slug */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{page.title}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">/legal/{page.slug}</p>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex flex-col items-center gap-0.5">
          <Toggle
            checked={page.enabled}
            onChange={(val) => onToggle(page, 'enabled', val)}
            disabled={isMutating}
            label={`${page.enabled ? 'Disable' : 'Enable'} ${page.title}`}
          />
          <span className="text-[9px] text-slate-400 uppercase font-medium">Enabled</span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <Toggle
            checked={page.showInFooter}
            onChange={(val) => onToggle(page, 'showInFooter', val)}
            disabled={isMutating}
            label={`${page.showInFooter ? 'Hide from' : 'Show in'} footer: ${page.title}`}
          />
          <span className="text-[9px] text-slate-400 uppercase font-medium">Footer</span>
        </div>
      </div>

      {/* Last Updated */}
      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 hidden sm:block w-24 text-right">
        {page.lastUpdated ? formatDate(page.lastUpdated) : '—'}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(page.slug)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Pencil size={12} />
          Edit
        </button>
        <a
          href={`/legal/${page.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            page.enabled
              ? 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
              : 'text-slate-400 dark:text-slate-600 pointer-events-none'
          }`}
          aria-disabled={!page.enabled}
        >
          <ExternalLink size={12} />
          View
        </a>
      </div>
    </div>
  );
};

/** ─── Main Page ─── */
export const AdminLegalPagesPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const { allPages, isLoading } = useLegalPages();
  const updateMutation = useUpdateLegalPage();
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  useEffect(() => {
    setPageHeader('Legal Pages', 'Manage legal page visibility and content.');
  }, [setPageHeader]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleToggle = (page: LegalPageConfig, field: 'enabled' | 'showInFooter', value: boolean) => {
    updateMutation.mutate({ slug: page.slug, data: { [field]: value } });
  };

  const sortedPages = [...allPages].sort((a, b) => a.order - b.order);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedPages.findIndex((p) => p.slug === active.id);
    const newIndex = sortedPages.findIndex((p) => p.slug === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedPages, oldIndex, newIndex);

    // Persist new order values for all affected pages
    const updates = reordered
      .map((page, idx) => ({ slug: page.slug, newOrder: idx + 1, oldOrder: page.order }))
      .filter((u) => u.newOrder !== u.oldOrder);

    for (const { slug, newOrder } of updates) {
      await updateMutation.mutateAsync({ slug, data: { order: newOrder } });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedPages.map((p) => p.slug)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {sortedPages.map((page) => (
              <SortableRow
                key={page.slug}
                page={page}
                isMutating={updateMutation.isPending}
                onToggle={handleToggle}
                onEdit={setEditingSlug}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {allPages.length === 0 && (
        <div className="px-4 py-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          No legal pages found. Legal page configs are seeded automatically on server startup.
        </div>
      )}

      {/* Editor Modal */}
      {editingSlug && (
        <EditorModal slug={editingSlug} onClose={() => setEditingSlug(null)} />
      )}
    </div>
  );
};
