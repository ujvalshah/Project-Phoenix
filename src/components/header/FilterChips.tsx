import React from 'react';
import { X } from 'lucide-react';
import type { SortOrder } from '@/types';

interface DimensionChip {
  id: string;
  label: string;
}

interface FilterChipsProps {
  searchQuery: string;
  selectedCategories: string[];
  selectedTag: string | null;
  sortOrder: SortOrder;
  collectionName: string | null;
  formatChips?: DimensionChip[];
  domainChips?: DimensionChip[];
  subtopicChips?: DimensionChip[];
  onClearSearch: () => void;
  onRemoveCategory: (cat: string) => void;
  onClearTag: () => void;
  onClearSort: () => void;
  onClearCollection: () => void;
  onRemoveFormatTag?: (tagId: string) => void;
  onRemoveDomainTag?: (tagId: string) => void;
  onRemoveSubtopicTag?: (tagId: string) => void;
  onClearAll: () => void;
}

const Chip: React.FC<{ label: string; onRemove: () => void; color?: 'primary' | 'blue' | 'emerald' | 'amber' }> = ({ label, onRemove, color = 'primary' }) => {
  const colorClasses = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border ${colorClasses[color]}`}>
      {label}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X size={10} />
      </button>
    </span>
  );
};

const sortLabels: Record<SortOrder, string> = {
  latest: 'Latest',
  oldest: 'Oldest',
};

export const FilterChips: React.FC<FilterChipsProps> = ({
  searchQuery,
  selectedCategories,
  selectedTag,
  sortOrder,
  collectionName,
  formatChips = [],
  domainChips = [],
  subtopicChips = [],
  onClearSearch,
  onRemoveCategory,
  onClearTag,
  onClearSort,
  onClearCollection,
  onRemoveFormatTag,
  onRemoveDomainTag,
  onRemoveSubtopicTag,
  onClearAll,
}) => {
  const chips: React.ReactNode[] = [];

  if (searchQuery) {
    chips.push(<Chip key="q" label={`Search: "${searchQuery}"`} onRemove={onClearSearch} />);
  }
  for (const cat of selectedCategories) {
    chips.push(<Chip key={`cat-${cat}`} label={cat} onRemove={() => onRemoveCategory(cat)} />);
  }
  if (selectedTag) {
    chips.push(<Chip key="tag" label={`Tag: ${selectedTag}`} onRemove={onClearTag} />);
  }
  if (sortOrder !== 'latest') {
    chips.push(<Chip key="sort" label={`Sort: ${sortLabels[sortOrder]}`} onRemove={onClearSort} />);
  }
  if (collectionName) {
    chips.push(<Chip key="col" label={`Collection: ${collectionName}`} onRemove={onClearCollection} />);
  }
  // Dimension tag chips
  for (const fmt of formatChips) {
    chips.push(
      <Chip key={`ft-${fmt.id}`} label={fmt.label} color="blue" onRemove={() => onRemoveFormatTag?.(fmt.id)} />
    );
  }
  for (const dom of domainChips) {
    chips.push(
      <Chip key={`dt-${dom.id}`} label={dom.label} color="emerald" onRemove={() => onRemoveDomainTag?.(dom.id)} />
    );
  }
  for (const sub of subtopicChips) {
    chips.push(
      <Chip key={`st-${sub.id}`} label={sub.label} color="amber" onRemove={() => onRemoveSubtopicTag?.(sub.id)} />
    );
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 sm:px-6 lg:px-8 py-1.5 max-w-[1800px] mx-auto" role="status" aria-label="Active filters">
      {chips}
      {chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors font-medium"
          aria-label="Clear all filters"
        >
          Clear all
        </button>
      )}
    </div>
  );
};
