import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { useTagTaxonomy } from '@/hooks/useTagTaxonomy';
import type { TaxonomyTag } from '@/types';

interface DimensionTagPickerProps {
  selectedTagIds: string[];
  onSelectedChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

const ACCENT = {
  format: {
    label: 'Format',
    selected: 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300',
    count: 'text-blue-500 dark:text-blue-400',
  },
  domain: {
    label: 'Domain',
    selected: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300',
    count: 'text-emerald-500 dark:text-emerald-400',
  },
  subtopic: {
    label: 'Sub-Topic',
    selected: 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300',
    count: 'text-amber-500 dark:text-amber-400',
  },
} as const;

const toggle = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id];

const ChipRow: React.FC<{
  tags: TaxonomyTag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  accent: typeof ACCENT[keyof typeof ACCENT];
  disabled?: boolean;
}> = ({ tags, selectedIds, onToggle, accent, disabled }) => (
  <div className="flex flex-wrap gap-1.5">
    {tags.map((tag) => {
      const isSelected = selectedIds.includes(tag.id);
      return (
        <button
          key={tag.id}
          type="button"
          disabled={disabled}
          onClick={() => onToggle(tag.id)}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
            isSelected
              ? accent.selected
              : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          aria-pressed={isSelected}
        >
          {isSelected && <Check size={10} />}
          {tag.rawName}
        </button>
      );
    })}
  </div>
);

export const DimensionTagPicker: React.FC<DimensionTagPickerProps> = ({
  selectedTagIds,
  onSelectedChange,
  disabled = false,
}) => {
  const { data: taxonomy, isLoading } = useTagTaxonomy();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-gray-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-8 rounded bg-gray-100 dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  // Once taxonomy loads, strip any selectedTagIds that no longer exist in the
  // taxonomy (e.g. deprecated or deleted tags carried over from the article).
  // This prevents stale IDs from being re-sent on save and failing validation.
  const hasPrunedRef = useRef(false);
  useEffect(() => {
    if (!taxonomy || hasPrunedRef.current) return;
    hasPrunedRef.current = true;

    const validIds = new Set([
      ...taxonomy.formats.map(t => t.id),
      ...taxonomy.domains.map(t => t.id),
      ...taxonomy.subtopics.map(t => t.id),
    ]);
    const pruned = selectedTagIds.filter(id => validIds.has(id));
    if (pruned.length !== selectedTagIds.length) {
      onSelectedChange(pruned);
    }
  }, [taxonomy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!taxonomy || (taxonomy.formats.length === 0 && taxonomy.domains.length === 0 && taxonomy.subtopics.length === 0)) {
    return null;
  }

  const handleToggle = (id: string) => {
    onSelectedChange(toggle(selectedTagIds, id));
  };

  return (
    <div className="col-span-1 sm:col-span-2 space-y-2.5">
      <label className="block text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
        Classification Tags
      </label>

      {taxonomy.formats.length > 0 && (
        <div>
          <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
            Format
          </span>
          <div className="mt-1">
            <ChipRow
              tags={taxonomy.formats}
              selectedIds={selectedTagIds}
              onToggle={handleToggle}
              accent={ACCENT.format}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {taxonomy.domains.length > 0 && (
        <div>
          <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">
            Domain
          </span>
          <div className="mt-1">
            <ChipRow
              tags={taxonomy.domains}
              selectedIds={selectedTagIds}
              onToggle={handleToggle}
              accent={ACCENT.domain}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {taxonomy.subtopics.length > 0 && (
        <div>
          <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
            Sub-Topic
          </span>
          <div className="mt-1">
            <ChipRow
              tags={taxonomy.subtopics}
              selectedIds={selectedTagIds}
              onToggle={handleToggle}
              accent={ACCENT.subtopic}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
};
