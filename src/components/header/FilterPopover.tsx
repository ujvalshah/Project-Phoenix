import React, { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { useFeaturedCollections } from '@/hooks/useFeaturedCollections';
import { useQuery } from '@tanstack/react-query';
import { storageService } from '@/services/storageService';
import { Collection } from '@/types';

export interface FilterState {
  collectionId: string | null;
}

interface FilterPopoverProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onClear: () => void;
  variant?: 'dropdown' | 'embedded';
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  filters,
  onChange,
  onClear,
  variant = 'dropdown',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: featuredCollections = [], isLoading: isFeaturedLoading } = useFeaturedCollections();
  const { data: publicCollections = [], isLoading: isPublicLoading } = useQuery<Collection[]>({
    queryKey: ['collections', 'public', 'filter-popover'],
    queryFn: async () => {
      const result = await storageService.getCollections({
        type: 'public',
        limit: 300,
        sortField: 'name',
        sortDirection: 'asc',
      });
      return Array.isArray(result) ? result : result.data;
    },
    staleTime: 1000 * 60, // 1 minute
  });

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const isLoading = isFeaturedLoading || isPublicLoading;

  const collectionsById = useMemo(() => {
    const allCollections = [...featuredCollections, ...publicCollections];
    return new Map(allCollections.map((collection) => [collection.id, collection]));
  }, [featuredCollections, publicCollections]);

  const selectedCollectionName = filters.collectionId ? collectionsById.get(filters.collectionId)?.name ?? null : null;

  const groupedCollections = useMemo(() => {
    const groups = featuredCollections
      .map((parent) => {
        const children = publicCollections
          .filter((candidate) => candidate.parentId === parent.id)
          .sort((a, b) => a.name.localeCompare(b.name));

        const parentMatches = parent.name.toLowerCase().includes(normalizedSearch);
        const matchingChildren = normalizedSearch
          ? children.filter((child) => child.name.toLowerCase().includes(normalizedSearch))
          : children;

        if (normalizedSearch && !parentMatches && matchingChildren.length === 0) {
          return null;
        }

        return {
          parent,
          children: parentMatches ? children : matchingChildren,
        };
      })
      .filter((group): group is { parent: Collection; children: Collection[] } => Boolean(group));

    return groups;
  }, [featuredCollections, publicCollections, normalizedSearch]);

  const hasActiveFilter = filters.collectionId !== null;
  const containerClasses = variant === 'embedded'
    ? 'bg-transparent'
    : 'w-[min(860px,94vw)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200/80 dark:border-slate-800 p-4';

  const handleSelect = (id: string) => {
    onChange({
      collectionId: filters.collectionId === id ? null : id,
    });
  };

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <h3 className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-[0.16em]">
          Filter by Collection
        </h3>
        {hasActiveFilter && (
          <button
            onClick={onClear}
            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            aria-label="Clear collection filter"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative mb-2.5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={14} />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search collections..."
          className="w-full h-10 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 text-sm text-gray-700 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500"
          aria-label="Search collections"
        />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onClear}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${!hasActiveFilter
            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300'
            : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
          aria-pressed={!hasActiveFilter}
        >
          {!hasActiveFilter && <Check size={12} className="mr-1" />}
          Show all nuggets
        </button>
        {selectedCollectionName && (
          <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 px-2.5 py-1 text-[11px] font-medium">
            Selected: {selectedCollectionName}
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-3">
        No collection filter: includes nuggets outside any collection.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : groupedCollections.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 py-8 text-center">
          No collections available.
        </p>
      ) : (
        <div className="space-y-1">
          <div className="border-t border-gray-100 dark:border-slate-800 pt-3 max-h-[68vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2.5">
              {groupedCollections.map(({ parent, children }) => {
                const parentCount = parent.validEntriesCount ?? parent.entries?.length ?? 0;
                const isParentSelected = filters.collectionId === parent.id;

                return (
                  <div key={parent.id} className="min-w-0">
                    <button
                      onClick={() => handleSelect(parent.id)}
                      className={`w-full h-8 text-left rounded-md px-2 flex items-center justify-between transition-colors ${isParentSelected
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/70'
                      }`}
                      aria-label={`Filter by ${parent.name}`}
                      aria-pressed={isParentSelected}
                    >
                      <span className={`text-[13px] leading-tight ${isParentSelected
                        ? 'font-semibold text-primary-700 dark:text-primary-300'
                        : 'font-semibold text-gray-800 dark:text-slate-100'
                      }`}>
                        {parent.name}
                      </span>
                      <span className={`text-[11px] tabular-nums ml-2 ${isParentSelected
                        ? 'text-primary-500 dark:text-primary-400'
                        : 'text-gray-400 dark:text-slate-500'
                      }`}>
                        {parentCount}
                      </span>
                    </button>

                    <div className="mt-0.5 space-y-0.5">
                      {children.map((child) => {
                        const isChildSelected = filters.collectionId === child.id;
                        const childCount = child.validEntriesCount ?? child.entries?.length ?? 0;
                        return (
                          <button
                            key={child.id}
                            onClick={() => handleSelect(child.id)}
                            className={`w-full h-7 text-left rounded-md px-2 flex items-center justify-between transition-colors ${isChildSelected
                              ? 'bg-primary-50 dark:bg-primary-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-800/70'
                            }`}
                            aria-label={`Filter by ${child.name}`}
                            aria-pressed={isChildSelected}
                          >
                            <span className={`text-[12px] leading-tight ${isChildSelected
                              ? 'font-semibold text-primary-700 dark:text-primary-300'
                              : 'font-medium text-gray-700 dark:text-slate-300'
                            }`}>
                              - {child.name}
                            </span>
                            <span className={`text-[10px] tabular-nums ml-2 ${isChildSelected
                              ? 'text-primary-500 dark:text-primary-400'
                              : 'text-gray-400 dark:text-slate-500'
                            }`}>
                              {childCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
