import React from 'react';
import { createPortal } from 'react-dom';
import { X, Bookmark, Trash2, CheckSquare } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSaveTo: () => void;
  onRemove: () => void;
  onCancel: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onSaveTo,
  onRemove,
  onCancel,
}) => {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-2xl px-4 py-2.5 border border-slate-700 dark:border-slate-200">
        {/* Count & Select All/None */}
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors text-sm font-semibold whitespace-nowrap"
        >
          <CheckSquare size={16} />
          <span>{selectedCount} selected</span>
        </button>

        <div className="w-px h-6 bg-slate-700 dark:bg-slate-300 mx-1" />

        {/* Actions */}
        <button
          onClick={onSaveTo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors text-sm font-medium whitespace-nowrap"
          title="Save to collections"
        >
          <Bookmark size={14} />
          <span className="hidden sm:inline">Save to</span>
        </button>

        <button
          onClick={onRemove}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-900/60 dark:hover:bg-red-100 text-red-400 dark:text-red-600 transition-colors text-sm font-medium whitespace-nowrap"
          title="Remove from this collection"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Remove</span>
        </button>

        <div className="w-px h-6 bg-slate-700 dark:bg-slate-300 mx-1" />

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          title="Cancel selection"
        >
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body
  );
};
