import React, { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { useFeaturedCollections } from '@/hooks/useFeaturedCollections';
import { useTagTaxonomy } from '@/hooks/useTagTaxonomy';
import { useQuery } from '@tanstack/react-query';
import { storageService } from '@/services/storageService';
import { Collection, TaxonomyTag } from '@/types';

export interface FilterState {
  collectionId: string | null;
  formatTagIds?: string[];
  domainTagIds?: string[];
  subtopicTagIds?: string[];
}

interface FilterPopoverProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onClear: () => void;
  variant?: 'dropdown' | 'embedded';
  resultCount?: number;
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  filters,
  onChange,
  onClear,
  variant = 'dropdown',
  resultCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'dimensions' | 'collections'>('dimensions');

  // Taxonomy data
  const { data: taxonomy, isLoading: isTaxonomyLoading } = useTagTaxonomy();

  // Collections data
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
    staleTime: 1000 * 60,
  });

  const normalizedSearch = searchQuery.trim().toLowerCase();

  // ── Derived state ─────────────────────────────────────────────────────────

  const selectedFormatIds = filters.formatTagIds || [];
  const selectedDomainIds = filters.domainTagIds || [];
  const selectedSubtopicIds = filters.subtopicTagIds || [];
  const hasActiveFilter = filters.collectionId !== null || selectedFormatIds.length > 0 || selectedDomainIds.length > 0 || selectedSubtopicIds.length > 0;

  // Collections grouped for the collections tab
  const collectionsById = useMemo(() => {
    const allCollections = [...featuredCollections, ...publicCollections];
    return new Map(allCollections.map((c) => [c.id, c]));
  }, [featuredCollections, publicCollections]);

  const groupedCollections = useMemo(() => {
    return featuredCollections
      .map((parent) => {
        const children = publicCollections
          .filter((c) => c.parentId === parent.id)
          .sort((a, b) => a.name.localeCompare(b.name));
        const parentMatches = parent.name.toLowerCase().includes(normalizedSearch);
        const matchingChildren = normalizedSearch
          ? children.filter((c) => c.name.toLowerCase().includes(normalizedSearch))
          : children;
        if (normalizedSearch && !parentMatches && matchingChildren.length === 0) return null;
        return { parent, children: parentMatches ? children : matchingChildren };
      })
      .filter((g): g is { parent: Collection; children: Collection[] } => Boolean(g));
  }, [featuredCollections, publicCollections, normalizedSearch]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleFormatTag = (tagId: string) => {
    const current = selectedFormatIds;
    const next = current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId];
    onChange({ ...filters, formatTagIds: next });
  };

  const toggleDomainTag = (tagId: string) => {
    const current = selectedDomainIds;
    const next = current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId];
    onChange({ ...filters, domainTagIds: next });
  };

  const toggleSubtopicTag = (tagId: string) => {
    const current = selectedSubtopicIds;
    const next = current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId];
    onChange({ ...filters, subtopicTagIds: next });
  };

  const handleCollectionSelect = (id: string) => {
    onChange({ ...filters, collectionId: filters.collectionId === id ? null : id });
  };

  const selectedCollectionName = filters.collectionId ? collectionsById.get(filters.collectionId)?.name ?? null : null;

  const containerClasses = variant === 'embedded'
    ? 'bg-transparent'
    : 'w-[min(860px,94vw)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200/80 dark:border-slate-800 p-4';

  const isLoading = isTaxonomyLoading || isFeaturedLoading || isPublicLoading;

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <h3 className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-[0.16em]">
          Filter Nuggets
        </h3>
        {hasActiveFilter && (
          <button
            onClick={onClear}
            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            aria-label="Clear all filters"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-3 border-b border-gray-100 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('dimensions')}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'dimensions'
              ? 'border-primary-500 text-primary-700 dark:text-primary-300'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          Format, Domain & Topics
        </button>
        <button
          onClick={() => setActiveTab('collections')}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'collections'
              ? 'border-primary-500 text-primary-700 dark:text-primary-300'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          Collections
        </button>
      </div>

      {/* Show all / Active summary + inline search */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
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
            Collection: {selectedCollectionName}
          </span>
        )}
        {selectedFormatIds.length > 0 && taxonomy && (
          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-[11px] font-medium">
            {selectedFormatIds.length} format{selectedFormatIds.length > 1 ? 's' : ''}
          </span>
        )}
        {selectedDomainIds.length > 0 && taxonomy && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-medium">
            {selectedDomainIds.length} domain{selectedDomainIds.length > 1 ? 's' : ''}
          </span>
        )}
        {selectedSubtopicIds.length > 0 && taxonomy && (
          <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-[11px] font-medium">
            {selectedSubtopicIds.length} topic{selectedSubtopicIds.length > 1 ? 's' : ''}
          </span>
        )}
        {/* Inline search — pushed to the right */}
        <div className="relative ml-auto flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={13} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'collections' ? 'Search collections...' : 'Search tags...'}
            className="h-8 w-44 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 text-xs text-gray-700 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500"
            aria-label="Search"
          />
        </div>
      </div>

      {/* ─── Dimensions Tab ─────────────────────────────────────────────── */}
      {activeTab === 'dimensions' && (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-8 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-32 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" />
            </div>
          ) : !taxonomy || (taxonomy.formats.length === 0 && taxonomy.domains.length === 0 && taxonomy.subtopics.length === 0) ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 py-8 text-center">
              No dimension tags configured yet. Run the seed migration first.
            </p>
          ) : (
            <>
              {/* FORMAT section */}
              {taxonomy.formats.length > 0 && (
                <DimensionSection
                  title="Content Format"
                  tags={taxonomy.formats}
                  selectedIds={selectedFormatIds}
                  onToggle={toggleFormatTag}
                  accentColor="blue"
                />
              )}

              {/* DOMAIN section */}
              {taxonomy.domains.length > 0 && (
                <DimensionSection
                  title="Subject Domain"
                  tags={taxonomy.domains}
                  selectedIds={selectedDomainIds}
                  onToggle={toggleDomainTag}
                  accentColor="emerald"
                />
              )}

              {/* SUB-TOPIC section */}
              {taxonomy.subtopics.length > 0 && (
                <DimensionSection
                  title="Sub-Topics"
                  tags={taxonomy.subtopics}
                  selectedIds={selectedSubtopicIds}
                  onToggle={toggleSubtopicTag}
                  accentColor="amber"
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Collections Tab ────────────────────────────────────────────── */}
      {activeTab === 'collections' && (
        <div>
          {(isFeaturedLoading || isPublicLoading) ? (
            <div className="space-y-3">
              <div className="h-8 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-32 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse" />
            </div>
          ) : groupedCollections.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 py-8 text-center">
              No collections available.
            </p>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {groupedCollections.map(({ parent, children }) => {
                const parentCount = parent.validEntriesCount ?? parent.entries?.length ?? 0;
                const isParentSelected = filters.collectionId === parent.id;
                return (
                  <div key={parent.id}>
                    <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                      {parent.name}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Parent collection pill */}
                      <button
                        onClick={() => handleCollectionSelect(parent.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                          isParentSelected
                            ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 shadow-sm'
                            : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                        aria-pressed={isParentSelected}
                      >
                        {isParentSelected && <Check size={11} />}
                        All {parent.name}
                        <span className={`text-[10px] tabular-nums ${isParentSelected ? 'text-violet-500 dark:text-violet-400' : 'text-gray-400 dark:text-slate-500'}`}>
                          {parentCount}
                        </span>
                      </button>
                      {/* Sub-collection pills */}
                      {children.map((child) => {
                        const isChildSelected = filters.collectionId === child.id;
                        const childCount = child.validEntriesCount ?? child.entries?.length ?? 0;
                        return (
                          <button
                            key={child.id}
                            onClick={() => handleCollectionSelect(child.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                              isChildSelected
                                ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 shadow-sm'
                                : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                            }`}
                            aria-pressed={isChildSelected}
                          >
                            {isChildSelected && <Check size={11} />}
                            {child.name}
                            <span className={`text-[10px] tabular-nums ${isChildSelected ? 'text-violet-500 dark:text-violet-400' : 'text-gray-400 dark:text-slate-500'}`}>
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
          )}
        </div>
      )}

      {!isLoading && (
        <div className="mt-3 border-t border-gray-100 dark:border-slate-800 pt-2.5 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {typeof resultCount === 'number' ? `Showing ${resultCount} nuggets` : 'Filters apply instantly'}
          </p>
          {hasActiveFilter && (
            <button
              onClick={onClear}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              aria-label="Clear all filters"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Reusable Dimension Chip Section ────────────────────────────────────────

const ACCENT_CLASSES = {
  blue: {
    selected: 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-sm',
    count: 'text-blue-500 dark:text-blue-400',
    check: '',
  },
  emerald: {
    selected: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-sm',
    count: 'text-emerald-500 dark:text-emerald-400',
    check: '',
  },
  amber: {
    selected: 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 shadow-sm',
    count: 'text-amber-500 dark:text-amber-400',
    check: '',
  },
} as const;

const DimensionSection: React.FC<{
  title: string;
  tags: TaxonomyTag[];
  selectedIds: string[];
  onToggle: (tagId: string) => void;
  accentColor: keyof typeof ACCENT_CLASSES;
}> = ({ title, tags, selectedIds, onToggle, accentColor }) => {
  const accent = ACCENT_CLASSES[accentColor];

  return (
    <div>
      <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">
        {title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const isSelected = selectedIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => onToggle(tag.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isSelected
                  ? accent.selected
                  : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
              aria-pressed={isSelected}
            >
              {isSelected && <Check size={11} />}
              {tag.rawName}
              <span className={`text-[10px] tabular-nums ${isSelected ? accent.count : 'text-gray-400 dark:text-slate-500'}`}>
                {tag.usageCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
