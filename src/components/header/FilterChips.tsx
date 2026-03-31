import React from 'react';
import { X } from 'lucide-react';
import type { SortOrder } from '@/types';

interface FilterChipsProps {
  searchQuery: string;
  selectedCategories: string[];
  selectedTag: string | null;
  sortOrder: SortOrder;
  collectionName: string | null;
  onClearSearch: () => void;
  onRemoveCategory: (cat: string) => void;
  onClearTag: () => void;
  onClearSort: () => void;
  onClearCollection: () => void;
  onClearAll: () => void;
}

const Chip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
    {label}
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="ml-0.5 p-0.5 rounded-full hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
      aria-label={`Remove ${label} filter`}
    >
      <X size={10} />
    </button>
  </span>
);

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
  onClearSearch,
  onRemoveCategory,
  onClearTag,
  onClearSort,
  onClearCollection,
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
