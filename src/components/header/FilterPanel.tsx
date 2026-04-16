import React, { useMemo, useState } from 'react';
import { Search, Check, X, PanelLeftClose, Layers3, FolderKanban } from 'lucide-react';
import { useFeaturedCollections } from '@/hooks/useFeaturedCollections';
import { useTagTaxonomy } from '@/hooks/useTagTaxonomy';
import { useQuery } from '@tanstack/react-query';
import { storageService } from '@/services/storageService';
import { Collection, TaxonomyTag } from '@/types';
import type { FilterState } from './filterTypes';

const FACET_INITIAL = 6;
const COLLECTION_CHILD_INITIAL = 6;

interface FilterPanelProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onClear: () => void;
  resultCount?: number;
  layout: 'popover' | 'sidebar';
  /** Sidebar only: collapse control in header */
  onRequestCollapse?: () => void;
}

function sortTagsByUsage(tags: TaxonomyTag[]): TaxonomyTag[] {
  return [...tags].sort((a, b) => b.usageCount - a.usageCount || a.rawName.localeCompare(b.rawName));
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onChange,
  onClear,
  resultCount,
  layout,
  onRequestCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMode, setActiveMode] = useState<'dimensions' | 'collections'>('dimensions');

  const { data: taxonomy, isLoading: isTaxonomyLoading } = useTagTaxonomy();
  const { data: featuredCollections = [], isLoading: isFeaturedLoading } = useFeaturedCollections();
  const { data: publicCollections = [], isLoading: isPublicLoading } = useQuery<Collection[]>({
    queryKey: ['collections', 'public', 'filter-surface'],
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

  const selectedFormatIds = filters.formatTagIds || [];
  const selectedDomainIds = filters.domainTagIds || [];
  const selectedSubtopicIds = filters.subtopicTagIds || [];
  const hasActiveFilter =
    filters.collectionId !== null ||
    selectedFormatIds.length > 0 ||
    selectedDomainIds.length > 0 ||
    selectedSubtopicIds.length > 0;

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

  const toggleFormatTag = (tagId: string) => {
    const current = selectedFormatIds;
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
    onChange({ ...filters, formatTagIds: next });
  };

  const toggleDomainTag = (tagId: string) => {
    const current = selectedDomainIds;
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
    onChange({ ...filters, domainTagIds: next });
  };

  const toggleSubtopicTag = (tagId: string) => {
    const current = selectedSubtopicIds;
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
    onChange({ ...filters, subtopicTagIds: next });
  };

  const handleCollectionSelect = (id: string) => {
    onChange({ ...filters, collectionId: filters.collectionId === id ? null : id });
  };

  const tagMaps = useMemo(() => ({
    formats: new Map((taxonomy?.formats ?? []).map((t) => [t.id, t])),
    domains: new Map((taxonomy?.domains ?? []).map((t) => [t.id, t])),
    subtopics: new Map((taxonomy?.subtopics ?? []).map((t) => [t.id, t])),
  }), [taxonomy]);

  const appliedChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.collectionId) {
      const colId = filters.collectionId;
      const name = collectionsById.get(colId)?.name ?? 'Collection';
      chips.push({
        key: `col-${colId}`,
        label: name,
        onRemove: () => onChange({ ...filters, collectionId: null }),
      });
    }
    for (const id of selectedFormatIds) {
      const tag = tagMaps.formats.get(id);
      if (tag) {
        chips.push({
          key: `fmt-${id}`,
          label: tag.rawName,
          onRemove: () =>
            onChange({ ...filters, formatTagIds: selectedFormatIds.filter((x) => x !== id) }),
        });
      }
    }
    for (const id of selectedDomainIds) {
      const tag = tagMaps.domains.get(id);
      if (tag) {
        chips.push({
          key: `dom-${id}`,
          label: tag.rawName,
          onRemove: () =>
            onChange({ ...filters, domainTagIds: selectedDomainIds.filter((x) => x !== id) }),
        });
      }
    }
    for (const id of selectedSubtopicIds) {
      const tag = tagMaps.subtopics.get(id);
      if (tag) {
        chips.push({
          key: `sub-${id}`,
          label: tag.rawName,
          onRemove: () =>
            onChange({ ...filters, subtopicTagIds: selectedSubtopicIds.filter((x) => x !== id) }),
        });
      }
    }
    return chips;
  }, [
    filters,
    collectionsById,
    tagMaps,
    selectedFormatIds,
    selectedDomainIds,
    selectedSubtopicIds,
    onChange,
  ]);

  const isLoading = isTaxonomyLoading || isFeaturedLoading || isPublicLoading;

  const headerTitle = layout === 'sidebar' ? 'Filters' : 'Filter Nuggets';
  const activeFilterCount =
    (filters.collectionId ? 1 : 0) + selectedFormatIds.length + selectedDomainIds.length + selectedSubtopicIds.length;

  const shellPad = layout === 'sidebar' ? 'px-3 pt-3 pb-2' : 'p-4';
  const bodyClass =
    layout === 'sidebar'
      ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
      : 'flex max-h-[60vh] flex-col overflow-hidden';

  return (
    <div className={bodyClass}>
      {/* Header */}
      <div
        className={`shrink-0 border-b border-slate-200/70 dark:border-slate-800/80 ${shellPad} ${
          layout === 'sidebar' ? 'bg-white dark:bg-slate-950' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{headerTitle}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {typeof resultCount === 'number' ? (
                <>
                  <span className="tabular-nums">{resultCount}</span> nuggets
                  {activeFilterCount > 0 && (
                    <>
                      {' '}
                      · <span className="tabular-nums">{activeFilterCount}</span> filters
                    </>
                  )}
                </>
              ) : (
                'Filters apply as you choose'
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 dark:text-primary-400 dark:hover:bg-primary-950/40 dark:hover:text-primary-300"
              >
                Reset
              </button>
            )}
            {layout === 'sidebar' && onRequestCollapse && (
              <button
                type="button"
                onClick={onRequestCollapse}
                className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Collapse filters sidebar"
                title="Collapse"
              >
                <PanelLeftClose size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
        </div>

        {appliedChips.length > 0 && (
          <div
            className="mt-3 rounded-xl border border-primary-200/70 bg-primary-50/60 px-3 py-2.5 shadow-sm dark:border-primary-900/40 dark:bg-primary-950/25"
            role="region"
            aria-label="Active filters"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-[11px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Active filters
                </span>
                <span className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-500/90 px-1 text-[10px] font-bold text-white dark:bg-primary-400/90 dark:text-slate-950">
                  {appliedChips.length}
                </span>
              </div>
              <button
                type="button"
                onClick={onClear}
                className="text-[11px] font-semibold text-primary-700 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 dark:text-primary-300 dark:hover:text-primary-200"
              >
                Clear all
              </button>
            </div>
            <div className="relative">
              <ul
                className="max-h-28 overflow-y-auto pr-1 flex flex-wrap content-start gap-2"
                role="list"
                aria-label="Active filter chips"
              >
                {appliedChips.map((c) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={c.onRemove}
                      aria-label={`Remove filter: ${c.label}`}
                      className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary-200/80 bg-white py-1 pl-2.5 pr-1.5 text-left text-[12px] font-semibold text-slate-900 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 dark:border-primary-900/40 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                    >
                      <span className="min-w-0 truncate">{c.label}</span>
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-500 group-hover:bg-primary-100 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:bg-primary-950/40 dark:group-hover:text-slate-100"
                        aria-hidden
                      >
                        <X size={12} strokeWidth={2.5} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-primary-50/95 to-transparent dark:from-primary-950/65"
                aria-hidden
              />
            </div>
          </div>
        )}

        {/* Mode switch */}
        <div className={`${appliedChips.length > 0 ? 'mt-3' : 'mt-3'} flex flex-col gap-2`}>
          <div
            className="flex rounded-xl border border-slate-200/70 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/50"
            role="tablist"
            aria-label="Filter mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'dimensions'}
              onClick={() => { setActiveMode('dimensions'); setSearchQuery(''); }}
              className={`min-h-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 ${
                activeMode === 'dimensions'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-950/40 dark:hover:text-slate-100'
              }`}
            >
              <Layers3 size={14} aria-hidden />
              <span>Format, domain & topics</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'collections'}
              onClick={() => { setActiveMode('collections'); setSearchQuery(''); }}
              className={`min-h-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 ${
                activeMode === 'collections'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-950/40 dark:hover:text-slate-100'
              }`}
            >
              <FolderKanban size={14} aria-hidden />
              <span>Collections</span>
            </button>
          </div>
          <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">
            {activeMode === 'dimensions'
              ? 'Use taxonomy filters to narrow by format, domain, or topic.'
              : 'Use collections to explore curated sets of nuggets.'}
          </p>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeMode === 'collections' ? 'Search collections…' : 'Search tags in this mode…'
              }
              className="h-8 w-full rounded-lg border border-slate-200/80 bg-white pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              aria-label={activeMode === 'collections' ? 'Search collections' : 'Search tags'}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${layout === 'sidebar' ? 'px-3 py-3' : 'px-4 py-3'}`}
      >
        {activeMode === 'dimensions' && (
          <>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : !taxonomy ||
              (taxonomy.formats.length === 0 && taxonomy.domains.length === 0 && taxonomy.subtopics.length === 0) ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No dimension tags configured yet.
              </p>
            ) : (
              <div className="space-y-5">
                {taxonomy.formats.length > 0 && (
                  <FilterFacetGroup
                    title="Content format"
                    tags={taxonomy.formats}
                    selectedIds={selectedFormatIds}
                    onToggle={toggleFormatTag}
                    search={normalizedSearch}
                  />
                )}
                {taxonomy.domains.length > 0 && (
                  <FilterFacetGroup
                    title="Subject domain"
                    tags={taxonomy.domains}
                    selectedIds={selectedDomainIds}
                    onToggle={toggleDomainTag}
                    search={normalizedSearch}
                  />
                )}
                {taxonomy.subtopics.length > 0 && (
                  <FilterFacetGroup
                    title="Topics"
                    tags={taxonomy.subtopics}
                    selectedIds={selectedSubtopicIds}
                    onToggle={toggleSubtopicTag}
                    search={normalizedSearch}
                  />
                )}
              </div>
            )}
          </>
        )}

        {activeMode === 'collections' && (
          <>
            {(isFeaturedLoading || isPublicLoading) ? (
              <div className="space-y-3">
                <div className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : groupedCollections.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No collections match.</p>
            ) : (
              <div className="space-y-5">
                {groupedCollections.map(({ parent, children }) => (
                  <CollectionFacetGroup
                    key={parent.id}
                    parent={parent}
                    childrenCols={children}
                    selectedId={filters.collectionId}
                    onSelect={handleCollectionSelect}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!isLoading && (
        <div
          className={`shrink-0 border-t border-slate-200/70 px-3 py-2 dark:border-slate-800/80 ${
            layout === 'sidebar' ? 'bg-white dark:bg-slate-950' : ''
          }`}
        >
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {typeof resultCount === 'number' ? `Showing ${resultCount} nuggets` : 'Results update automatically'}
          </p>
        </div>
      )}
    </div>
  );
};

const FilterFacetGroup: React.FC<{
  title: string;
  tags: TaxonomyTag[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  search: string;
}> = ({ title, tags, selectedIds, onToggle, search }) => {
  const [expanded, setExpanded] = useState(false);
  const filtered = useMemo(() => {
    if (!search) return tags;
    return tags.filter((t) => t.rawName.toLowerCase().includes(search));
  }, [tags, search]);
  const sorted = useMemo(() => sortTagsByUsage(filtered), [filtered]);
  const visible = expanded ? sorted : sorted.slice(0, FACET_INITIAL);
  const remainder = sorted.length - visible.length;

  if (sorted.length === 0) return null;

  return (
    <section aria-labelledby={`facet-${title.replace(/\s+/g, '-')}`}>
      <h3
        id={`facet-${title.replace(/\s+/g, '-')}`}
        className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
      >
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((tag) => (
          <FacetValueButton
            key={tag.id}
            label={tag.rawName}
            count={tag.usageCount}
            selected={selectedIds.includes(tag.id)}
            onClick={() => onToggle(tag.id)}
          />
        ))}
      </div>
      {remainder > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-[11px] font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 dark:text-primary-400"
        >
          {expanded ? 'Show less' : `Show ${remainder} more`}
        </button>
      )}
    </section>
  );
};

const CollectionFacetGroup: React.FC<{
  parent: Collection;
  childrenCols: Collection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}> = ({ parent, childrenCols, selectedId, onSelect }) => {
  const [childExpanded, setChildExpanded] = useState(false);
  const parentCount = parent.validEntriesCount ?? parent.entries?.length ?? 0;
  const isParentSelected = selectedId === parent.id;
  const visibleChildren = childExpanded ? childrenCols : childrenCols.slice(0, COLLECTION_CHILD_INITIAL);
  const childRemainder = childrenCols.length - visibleChildren.length;

  return (
    <section aria-label={parent.name}>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {parent.name}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        <FacetValueButton
          label={`All ${parent.name}`}
          count={parentCount}
          selected={isParentSelected}
          onClick={() => onSelect(parent.id)}
          variant="collection"
        />
        {visibleChildren.map((child) => {
          const isChildSelected = selectedId === child.id;
          const childCount = child.validEntriesCount ?? child.entries?.length ?? 0;
          return (
            <FacetValueButton
              key={child.id}
              label={child.name}
              count={childCount}
              selected={isChildSelected}
              onClick={() => onSelect(child.id)}
              variant="collection"
            />
          );
        })}
      </div>
      {childRemainder > 0 && (
        <button
          type="button"
          onClick={() => setChildExpanded((e) => !e)}
          className="mt-2 text-[11px] font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 dark:text-primary-400"
        >
          {childExpanded ? 'Show less' : `Show ${childRemainder} more`}
        </button>
      )}
    </section>
  );
};

const FacetValueButton: React.FC<{
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  variant?: 'default' | 'collection';
}> = ({ label, count, selected, onClick, variant = 'default' }) => {
  const collectionRing = variant === 'collection' && selected;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex max-w-full min-h-8 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 ${
        selected
          ? collectionRing
            ? 'border-violet-400 bg-violet-50 text-violet-900 ring-1 ring-violet-400/80 dark:border-violet-600 dark:bg-violet-950/50 dark:text-violet-100'
            : 'border-primary-400/80 bg-primary-50 text-slate-900 ring-1 ring-primary-400/70 dark:border-primary-600 dark:bg-primary-950/40 dark:text-slate-100'
          : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
      }`}
    >
      {selected && <Check size={12} className="shrink-0 text-current opacity-80" aria-hidden strokeWidth={2.5} />}
      <span className="min-w-0 truncate">{label}</span>
      <span
        className={`shrink-0 tabular-nums text-[10px] ${
          selected ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  );
};
