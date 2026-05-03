import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, X } from 'lucide-react';
import { useTagTaxonomy } from '@/hooks/useTagTaxonomy';
import { useFeaturedCollections } from '@/hooks/useFeaturedCollections';
import { useQuery } from '@tanstack/react-query';
import { storageService } from '@/services/storageService';
import { Collection, TaxonomyTag } from '@/types';
import type { FilterState } from './filterTypes';
import { getOverlayHost } from '@/utils/overlayHosts';
import { buildCollectionFilterGroups } from './collectionFilterUtils';
import {
  HEADER_PERF_SURFACES,
  headerPerfSurfaceReady,
} from '@/dev/perfMarks';

interface MobileFilterSheetProps {
  isOpen: boolean;
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onClearAll: () => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  resultCount?: number;
}

type FilterTab = 'topics' | 'collections';
type SectionKey = 'formats' | 'domains' | 'subtopics';

const INITIAL_VISIBLE = 8;
const COLLECTIONS_PAGE_LIMIT = 100;

const emitFilterAnalytics = (
  eventName: 'filter_selected' | 'filter_removed' | 'clear_all_clicked' | 'filter_search_used' | 'no_results_triggered',
  payload: Record<string, unknown>,
) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('nuggets:filter-analytics', {
      detail: {
        event: eventName,
        ...payload,
      },
    }),
  );
};

const normalize = (value: string) => value.trim().toLowerCase();

const ChipButton: React.FC<{
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
  ariaLabel: string;
}> = ({ label, count, selected, onClick, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-pressed={selected}
    className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-[14px] font-medium transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 ${
      selected
        ? 'border-primary-300 bg-primary-50 text-primary-800 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
    }`}
  >
    {selected && <Check size={14} aria-hidden />}
    <span>{label}</span>
    {typeof count === 'number' && <span className={`text-[12px] tabular-nums ${selected ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 dark:text-slate-400'}`}>{count}</span>}
  </button>
);

const SEARCH_ANALYTICS_DEBOUNCE_MS = 600;

const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  isOpen,
  filters,
  onChange,
  onClearAll,
  onClose,
  triggerRef,
  resultCount,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('topics');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [announceNoResults, setAnnounceNoResults] = useState(false);
  const [animState, setAnimState] = useState<'closed' | 'entering' | 'open' | 'exiting'>('closed');
  const panelRef = useRef<HTMLDivElement>(null);
  const handleStartYRef = useRef<number | null>(null);
  const searchAnalyticsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: taxonomy, isLoading: isTaxonomyLoading } = useTagTaxonomy();
  const { data: featuredCollections = [], isLoading: isFeaturedLoading } = useFeaturedCollections();
  const { data: publicCollections = [], isLoading: isPublicLoading } = useQuery<Collection[]>({
    queryKey: ['collections', 'public', 'filter-surface'],
    queryFn: async () => {
      const allCollections: Collection[] = [];
      let page = 1;
      let totalCount = Number.POSITIVE_INFINITY;

      while (allCollections.length < totalCount) {
        const result = await storageService.getCollections({
          type: 'public',
          page,
          limit: COLLECTIONS_PAGE_LIMIT,
          sortField: 'name',
          sortDirection: 'asc',
          summary: true,
          includeEntries: false,
          includeCount: true,
        });

        const pageData = Array.isArray(result) ? result : result.data;
        const pageCount = Array.isArray(result) ? pageData.length : result.count;
        totalCount = pageCount;
        allCollections.push(...pageData);

        if (pageData.length === 0 || allCollections.length >= totalCount) {
          break;
        }
        page += 1;
      }

      return Array.from(new Map(allCollections.map((c) => [c.id, c])).values());
    },
    staleTime: 1000 * 60,
  });

  const selectedFormatIds = filters.formatTagIds || [];
  const selectedDomainIds = filters.domainTagIds || [];
  const selectedSubtopicIds = filters.subtopicTagIds || [];
  const hasActiveFilter =
    filters.collectionId !== null ||
    selectedFormatIds.length > 0 ||
    selectedDomainIds.length > 0 ||
    selectedSubtopicIds.length > 0;
  const activeFilterCount =
    (filters.collectionId ? 1 : 0) +
    selectedFormatIds.length +
    selectedDomainIds.length +
    selectedSubtopicIds.length;

  const collectionsById = useMemo(() => {
    const allCollections = [...featuredCollections, ...publicCollections];
    return new Map(allCollections.map((c) => [c.id, c]));
  }, [featuredCollections, publicCollections]);

  const tagMaps = useMemo(() => {
    return {
      formats: new Map((taxonomy?.formats || []).map((t) => [t.id, t])),
      domains: new Map((taxonomy?.domains || []).map((t) => [t.id, t])),
      subtopics: new Map((taxonomy?.subtopics || []).map((t) => [t.id, t])),
    };
  }, [taxonomy]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; remove: () => void; type: string }> = [];
    for (const id of selectedFormatIds) {
      const tag = tagMaps.formats.get(id);
      if (!tag) continue;
      chips.push({
        key: `format-${id}`,
        label: tag.rawName,
        type: 'format',
        remove: () => {
          onChange({ ...filters, formatTagIds: selectedFormatIds.filter((v) => v !== id) });
          emitFilterAnalytics('filter_removed', { filterType: 'format', filterLabel: tag.rawName, tabContext: activeTab, resultCount });
        },
      });
    }
    for (const id of selectedDomainIds) {
      const tag = tagMaps.domains.get(id);
      if (!tag) continue;
      chips.push({
        key: `domain-${id}`,
        label: tag.rawName,
        type: 'domain',
        remove: () => {
          onChange({ ...filters, domainTagIds: selectedDomainIds.filter((v) => v !== id) });
          emitFilterAnalytics('filter_removed', { filterType: 'domain', filterLabel: tag.rawName, tabContext: activeTab, resultCount });
        },
      });
    }
    for (const id of selectedSubtopicIds) {
      const tag = tagMaps.subtopics.get(id);
      if (!tag) continue;
      chips.push({
        key: `subtopic-${id}`,
        label: tag.rawName,
        type: 'subtopic',
        remove: () => {
          onChange({ ...filters, subtopicTagIds: selectedSubtopicIds.filter((v) => v !== id) });
          emitFilterAnalytics('filter_removed', { filterType: 'subtopic', filterLabel: tag.rawName, tabContext: activeTab, resultCount });
        },
      });
    }
    if (filters.collectionId) {
      const collection = collectionsById.get(filters.collectionId);
      if (collection) {
        chips.push({
          key: `collection-${collection.id}`,
          label: collection.name,
          type: 'collection',
          remove: () => {
            onChange({ ...filters, collectionId: null });
            emitFilterAnalytics('filter_removed', { filterType: 'collection', filterLabel: collection.name, tabContext: activeTab, resultCount });
          },
        });
      }
    }
    return chips;
  }, [activeTab, collectionsById, filters, onChange, resultCount, selectedDomainIds, selectedFormatIds, selectedSubtopicIds, tagMaps.domains, tagMaps.formats, tagMaps.subtopics]);

  const groupedCollections = useMemo(
    () =>
      buildCollectionFilterGroups({
        featuredCollections,
        publicCollections,
        searchQuery,
      }),
    [featuredCollections, publicCollections, searchQuery]
  );

  const filterTagsBySearch = (tags: TaxonomyTag[]) => {
    const q = normalize(searchQuery);
    if (!q) return tags;
    return tags.filter((tag) => tag.rawName.toLowerCase().includes(q));
  };

  const formatTags = filterTagsBySearch(taxonomy?.formats || []);
  const domainTags = filterTagsBySearch(taxonomy?.domains || []);
  const subtopicTags = filterTagsBySearch(taxonomy?.subtopics || []);

  const hasTopicMatches = formatTags.length > 0 || domainTags.length > 0 || subtopicTags.length > 0;
  const hasCollectionMatches = groupedCollections.length > 0;

  const animStateRef = useRef(animState);
  animStateRef.current = animState;

  // Animation lifecycle: open → entering → open, close → exiting → closed.
  // Reopen while exiting must be handled: closing clears the exit timer, so without
  // the exiting branch we would stick in exiting with an invisible full-screen layer.
  //
  // IMPORTANT: depend only on `isOpen`. Including `animState` in the dependency array
  // re-ran this effect when leaving `closed`, and cleanup cancelled the inner rAF chain
  // that transitions `entering` → `open`, leaving the sheet stuck at `entering`
  // (invisible overlay) and breaking first-open perf measurement.
  useEffect(() => {
    if (isOpen) {
      const phase = animStateRef.current;
      if (phase === 'closed' || phase === 'exiting') {
        const outerRaf = requestAnimationFrame(() => {
          setAnimState('entering');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setAnimState('open'));
          });
        });
        return () => {
          cancelAnimationFrame(outerRaf);
        };
      }
      return;
    }

    const phase = animStateRef.current;
    if (phase === 'open' || phase === 'entering') {
      let closeTimer = 0;
      const outerRaf = requestAnimationFrame(() => {
        setAnimState('exiting');
        closeTimer = window.setTimeout(() => setAnimState('closed'), 250);
      });
      return () => {
        cancelAnimationFrame(outerRaf);
        window.clearTimeout(closeTimer);
      };
    }
  }, [isOpen]);

  const mobileFilterPerfOnceRef = useRef(false);
  useLayoutEffect(() => {
    if (!isOpen || animState !== 'open') return;
    if (mobileFilterPerfOnceRef.current) return;
    mobileFilterPerfOnceRef.current = true;
    headerPerfSurfaceReady(HEADER_PERF_SURFACES.MOBILE_FILTER_SHEET, {
      animState: 'open',
    });
  }, [isOpen, animState]);

  // Cleanup search analytics debounce on unmount
  useEffect(() => {
    return () => clearTimeout(searchAnalyticsTimerRef.current);
  }, []);

  const emitDebouncedSearchAnalytics = useCallback((query: string) => {
    clearTimeout(searchAnalyticsTimerRef.current);
    searchAnalyticsTimerRef.current = setTimeout(() => {
      emitFilterAnalytics('filter_search_used', {
        tabContext: activeTab,
        queryLength: query.trim().length,
      });
    }, SEARCH_ANALYTICS_DEBOUNCE_MS);
  }, [activeTab]);

  const sheetMounted = animState !== 'closed';
  useEffect(() => {
    if (!sheetMounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sheetMounted]);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setSearchQuery('');
      setExpandedSections({});
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    }, 20);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      triggerRef?.current?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const isNoResults = typeof resultCount === 'number' && resultCount === 0 && hasActiveFilter;
    if (isNoResults && !announceNoResults) {
      emitFilterAnalytics('no_results_triggered', { tabContext: activeTab, resultCount: 0 });
      queueMicrotask(() => setAnnounceNoResults(true));
    } else if (!isNoResults) {
      queueMicrotask(() => setAnnounceNoResults(false));
    }
  }, [activeTab, announceNoResults, hasActiveFilter, isOpen, resultCount]);

  const shouldRender = animState !== 'closed';
  if (!shouldRender || typeof document === 'undefined') return null;
  const isVisible = animState === 'open';

  const toggleTag = (key: SectionKey, current: string[], id: string, label: string) => {
    const exists = current.includes(id);
    const next = exists ? current.filter((v) => v !== id) : [...current, id];
    const patch: FilterState = { ...filters };
    if (key === 'formats') patch.formatTagIds = next;
    if (key === 'domains') patch.domainTagIds = next;
    if (key === 'subtopics') patch.subtopicTagIds = next;
    onChange(patch);
    emitFilterAnalytics(exists ? 'filter_removed' : 'filter_selected', {
      filterType: key,
      filterLabel: label,
      tabContext: activeTab,
      resultCount,
    });
  };

  const toggleCollection = (collection: Collection) => {
    const isSelected = filters.collectionId === collection.id;
    onChange({ ...filters, collectionId: isSelected ? null : collection.id });
    emitFilterAnalytics(isSelected ? 'filter_removed' : 'filter_selected', {
      filterType: 'collection',
      filterLabel: collection.name,
      tabContext: activeTab,
      resultCount,
    });
  };

  const renderSection = (
    sectionId: string,
    title: string,
    tags: TaxonomyTag[],
    selectedIds: string[],
    onToggle: (tag: TaxonomyTag) => void,
  ) => {
    if (tags.length === 0) return null;
    const expanded = expandedSections[sectionId] === true;
    const visible = expanded ? tags : tags.slice(0, INITIAL_VISIBLE);
    const showToggle = tags.length > INITIAL_VISIBLE;
    return (
      <section key={sectionId} className="space-y-2.5">
        <h4 className="px-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-slate-400">{title}</h4>
        <div className="flex flex-wrap gap-2 px-4">
          {visible.map((tag) => (
            <ChipButton
              key={tag.id}
              label={tag.rawName}
              count={tag.usageCount}
              selected={selectedIds.includes(tag.id)}
              onClick={() => onToggle(tag)}
              ariaLabel={`${selectedIds.includes(tag.id) ? 'Remove' : 'Select'} ${tag.rawName} filter`}
            />
          ))}
        </div>
        {showToggle && (
          <button
            type="button"
            onClick={() => setExpandedSections((prev) => ({ ...prev, [sectionId]: !expanded }))}
            className="ml-4 min-h-11 rounded-full px-3 text-[13px] font-medium text-primary-700 transition-colors hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1"
          >
            {expanded ? 'Show less' : `Show more (${tags.length - INITIAL_VISIBLE})`}
          </button>
        )}
      </section>
    );
  };

  return createPortal(
    <div
      className={`fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity duration-200 ${isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={`absolute bottom-0 left-0 right-0 mx-auto flex h-[90dvh] w-full max-w-[640px] flex-col rounded-t-3xl bg-white text-gray-900 shadow-2xl transition-transform duration-250 ease-out motion-reduce:transition-none dark:bg-slate-900 dark:text-slate-100 ${isVisible ? 'pointer-events-auto translate-y-0' : 'pointer-events-none translate-y-full'}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Single sticky header block — avoids fragile hardcoded top offsets */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur dark:bg-slate-900/95">
          {/* Drag handle + title */}
          <div
            className="border-b border-gray-100 px-4 pb-2 pt-2 dark:border-slate-800"
            onTouchStart={(event) => {
              handleStartYRef.current = event.touches[0]?.clientY ?? null;
            }}
            onTouchMove={(event) => {
              const currentY = event.touches[0]?.clientY ?? null;
              if (handleStartYRef.current == null || currentY == null) return;
              const delta = currentY - handleStartYRef.current;
              if (delta > 80) onClose();
            }}
            onTouchEnd={() => { handleStartYRef.current = null; }}
          >
            <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-gray-300 dark:bg-slate-700" aria-hidden />
            <div className="flex min-h-11 items-center justify-between">
              <div>
                <h2 className="text-[18px] font-semibold">Filters</h2>
                <p className="text-[12px] text-gray-500 dark:text-slate-400">{activeFilterCount > 0 ? `${activeFilterCount} selected` : 'No filters selected'}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="border-b border-gray-100 px-4 py-2 dark:border-slate-800" role="status" aria-label="Active filters">
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.remove}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 text-[13px] font-medium text-primary-800 transition-colors hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-200 dark:hover:bg-primary-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1"
                    aria-label={`Remove ${chip.label} filter`}
                  >
                    <span>{chip.label}</span>
                    <X size={13} aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab bar + search */}
          <div className="border-b border-gray-100 px-4 py-2.5 dark:border-slate-800">
            <div className="grid grid-cols-2 rounded-full bg-gray-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => { setActiveTab('topics'); setSearchQuery(''); }}
                className={`min-h-11 rounded-full text-[14px] font-medium transition-colors ${
                  activeTab === 'topics'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Topics
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('collections'); setSearchQuery(''); }}
                className={`min-h-11 rounded-full text-[14px] font-medium transition-colors ${
                  activeTab === 'collections'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Collections
              </button>
            </div>
            <div className="relative mt-2.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={14} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  const next = event.target.value;
                  setSearchQuery(next);
                  if (next.trim().length > 0) {
                    emitDebouncedSearchAnalytics(next);
                  }
                }}
                placeholder={activeTab === 'topics' ? 'Search topics' : 'Search collections'}
                className="h-11 w-full rounded-full border border-gray-200 bg-gray-50 pl-9 pr-9 text-[14px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                aria-label={activeTab === 'topics' ? 'Search topics' : 'Search collections'}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 pt-3">
          {activeTab === 'topics' ? (
            isTaxonomyLoading ? (
              <div className="space-y-3 px-4">
                <div className="h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
                <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
              </div>
            ) : !hasTopicMatches ? (
              <div className="mx-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-[15px] font-medium text-gray-800 dark:text-slate-100">No matching topics</p>
                <p className="mt-1 text-[13px] text-gray-500 dark:text-slate-400">Try another keyword or clear search.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {renderSection('formats', 'Content Format', formatTags, selectedFormatIds, (tag) => toggleTag('formats', selectedFormatIds, tag.id, tag.rawName))}
                {renderSection('domains', 'Subject Domain', domainTags, selectedDomainIds, (tag) => toggleTag('domains', selectedDomainIds, tag.id, tag.rawName))}
                {renderSection('subtopics', 'Topics', subtopicTags, selectedSubtopicIds, (tag) => toggleTag('subtopics', selectedSubtopicIds, tag.id, tag.rawName))}
              </div>
            )
          ) : isFeaturedLoading || isPublicLoading ? (
            <div className="space-y-3 px-4">
              <div className="h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
              <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
            </div>
          ) : !hasCollectionMatches ? (
            <div className="mx-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[15px] font-medium text-gray-800 dark:text-slate-100">No matching collections</p>
              <p className="mt-1 text-[13px] text-gray-500 dark:text-slate-400">Try another keyword or clear search.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedCollections.map(({ parent, children }) => {
                const options = [parent, ...children];
                const expanded = expandedSections[parent.id] === true;
                const visible = expanded ? options : options.slice(0, INITIAL_VISIBLE);
                const showToggle = options.length > INITIAL_VISIBLE;
                return (
                  <section key={parent.id} className="space-y-2.5">
                    <h4 className="px-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-slate-400">{parent.name}</h4>
                    <div className="flex flex-wrap gap-2 px-4">
                      {visible.map((collection) => {
                        const count = collection.validEntriesCount ?? collection.entries?.length ?? 0;
                        const isSelected = filters.collectionId === collection.id;
                        return (
                          <ChipButton
                            key={collection.id}
                            label={collection.id === parent.id ? `All ${collection.name}` : collection.name}
                            count={count}
                            selected={isSelected}
                            onClick={() => toggleCollection(collection)}
                            ariaLabel={`${isSelected ? 'Remove' : 'Select'} ${collection.name} collection filter`}
                          />
                        );
                      })}
                    </div>
                    {showToggle && (
                      <button
                        type="button"
                        onClick={() => setExpandedSections((prev) => ({ ...prev, [parent.id]: !expanded }))}
                        className="ml-4 min-h-11 rounded-full px-3 text-[13px] font-medium text-primary-700 transition-colors hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1"
                      >
                        {expanded ? 'Show less' : `Show more (${options.length - INITIAL_VISIBLE})`}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          {typeof resultCount === 'number' && resultCount === 0 && hasActiveFilter ? (
            <div className="space-y-2.5">
              <p className="text-[13px] font-medium text-gray-700 dark:text-slate-200">No results match these filters</p>
              <div className="flex items-center gap-2">
                {activeChips.length > 0 && (
                  <button
                    type="button"
                    onClick={activeChips[activeChips.length - 1].remove}
                    className="min-h-11 flex-1 rounded-full border border-gray-200 px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Remove last filter
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    emitFilterAnalytics('clear_all_clicked', { tabContext: activeTab, resultCount });
                  }}
                  className="min-h-11 flex-1 rounded-full border border-primary-300 px-3 text-[13px] font-semibold text-primary-700 hover:bg-primary-50 dark:border-primary-700 dark:text-primary-300 dark:hover:bg-primary-900/20"
                >
                  Reset all
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    emitFilterAnalytics('clear_all_clicked', { tabContext: activeTab, resultCount });
                  }}
                  className="min-h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 flex-1 rounded-full bg-primary-600 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 active:bg-primary-800 dark:bg-primary-500 dark:hover:bg-primary-600 dark:active:bg-primary-700"
              >
                {typeof resultCount === 'number'
                  ? `Show ${resultCount} nugget${resultCount !== 1 ? 's' : ''}`
                  : 'View results'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    getOverlayHost('drawer'),
  );
};

export default MobileFilterSheet;
