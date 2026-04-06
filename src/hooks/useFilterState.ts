import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SortOrder, TimeRange, SerializableFilterState } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;
const STORAGE_KEY = 'phoenix_filters';

const DEFAULTS: Required<SerializableFilterState> = {
  q: '',
  categories: [],
  tag: '',
  sort: 'latest' as SortOrder,
  favorites: false,
  unread: false,
  formats: [],
  timeRange: 'all' as TimeRange,
  collectionId: '',
  formatTagIds: [],
  domainTagIds: [],
  subtopicTagIds: [],
};

// ---------------------------------------------------------------------------
// URL ↔ FilterState serialisation helpers (pure functions)
// ---------------------------------------------------------------------------

export function filtersToParams(f: SerializableFilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.categories && f.categories.length > 0) {
    f.categories.forEach(c => p.append('cat', c));
  }
  if (f.tag) p.set('tag', f.tag);
  if (f.sort && f.sort !== 'latest') p.set('sort', f.sort);
  if (f.favorites) p.set('favorites', '1');
  if (f.unread) p.set('unread', '1');
  if (f.formats && f.formats.length > 0) {
    f.formats.forEach(fmt => p.append('fmt', fmt));
  }
  if (f.timeRange && f.timeRange !== 'all') p.set('time', f.timeRange);
  if (f.collectionId) p.set('col', f.collectionId);
  if (f.formatTagIds && f.formatTagIds.length > 0) {
    f.formatTagIds.forEach(id => p.append('ft', id));
  }
  if (f.domainTagIds && f.domainTagIds.length > 0) {
    f.domainTagIds.forEach(id => p.append('dt', id));
  }
  if (f.subtopicTagIds && f.subtopicTagIds.length > 0) {
    f.subtopicTagIds.forEach(id => p.append('st', id));
  }
  return p;
}

/** Maps URL/localStorage sort values; legacy title sorts become latest. */
function parseSortParam(raw: string | null): SortOrder | undefined {
  if (raw === 'latest' || raw === 'oldest') return raw;
  if (raw === 'title' || raw === 'title-desc') return 'latest';
  return undefined;
}

function normalizePersistedSort(raw: unknown): SortOrder | undefined {
  if (raw === 'latest' || raw === 'oldest') return raw;
  if (raw === 'title' || raw === 'title-desc') return 'latest';
  return undefined;
}

export function paramsToFilters(p: URLSearchParams): SerializableFilterState {
  const timeRange = p.get('time');
  const validTimeRanges: TimeRange[] = ['all', '24h', '7d'];

  return {
    q: p.get('q') || undefined,
    categories: p.getAll('cat').filter(Boolean),
    tag: p.get('tag') || undefined,
    sort: parseSortParam(p.get('sort')),
    favorites: p.get('favorites') === '1' || undefined,
    unread: p.get('unread') === '1' || undefined,
    formats: p.getAll('fmt').filter(Boolean),
    timeRange: validTimeRanges.includes(timeRange as TimeRange) ? (timeRange as TimeRange) : undefined,
    collectionId: p.get('col') || undefined,
    formatTagIds: p.getAll('ft').filter(Boolean),
    domainTagIds: p.getAll('dt').filter(Boolean),
    subtopicTagIds: p.getAll('st').filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadPersistedFilters(): Partial<SerializableFilterState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<SerializableFilterState>;
  } catch {
    return {};
  }
}

function persistFilters(f: SerializableFilterState): void {
  try {
    // Only persist non-default values
    const toStore: Partial<SerializableFilterState> = {};
    if (f.sort && f.sort !== DEFAULTS.sort) toStore.sort = f.sort;
    if (f.favorites) toStore.favorites = true;
    if (f.unread) toStore.unread = true;
    if (f.formats && f.formats.length > 0) toStore.formats = f.formats;
    if (f.timeRange && f.timeRange !== DEFAULTS.timeRange) toStore.timeRange = f.timeRange;
    // Don't persist search query or categories — those are ephemeral
    if (Object.keys(toStore).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage may be full or disabled
  }
}

// ---------------------------------------------------------------------------
// Hook: useFilterState
// ---------------------------------------------------------------------------

export interface UseFilterStateReturn {
  // Current state (debounced query for API calls)
  searchQuery: string;           // debounced — use for API calls
  searchInputValue: string;      // raw — use for <input> value
  selectedCategories: string[];
  selectedTag: string | null;
  sortOrder: SortOrder;
  favorites: boolean;
  unread: boolean;
  formats: string[];
  timeRange: TimeRange;
  /** Active community collection ID (category toolbar), null = "All" */
  collectionId: string | null;
  /** Selected format dimension tag IDs */
  formatTagIds: string[];
  /** Selected domain dimension tag IDs */
  domainTagIds: string[];
  /** Selected sub-topic dimension tag IDs */
  subtopicTagIds: string[];

  // Derived
  activeCategory: string;        // 'All', 'Today', or first category
  hasActiveFilters: boolean;
  activeFilterCount: number;

  // Setters
  setSearchInput: (value: string) => void;
  setSelectedCategories: (cats: string[]) => void;
  toggleCategory: (cat: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSortOrder: (sort: SortOrder) => void;
  setFavorites: (v: boolean) => void;
  setUnread: (v: boolean) => void;
  toggleFormat: (fmt: string) => void;
  setTimeRange: (t: TimeRange) => void;
  setCollectionId: (id: string | null) => void;
  toggleFormatTag: (tagId: string) => void;
  toggleDomainTag: (tagId: string) => void;
  toggleSubtopicTag: (tagId: string) => void;

  // Reset
  clearAll: () => void;
  clearSearch: () => void;
  clearCategories: () => void;
  clearTag: () => void;
  clearSort: () => void;
  clearCollection: () => void;
  clearFavorites: () => void;
  clearUnread: () => void;
  clearFormats: () => void;
  clearTimeRange: () => void;
  clearFormatTags: () => void;
  clearDomainTags: () => void;
  clearSubtopicTags: () => void;
}

export function useFilterState(): UseFilterStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialise from URL params > localStorage > defaults
  const urlFilters = useMemo(() => paramsToFilters(searchParams), []);  // eslint-disable-line react-hooks/exhaustive-deps -- only read URL on mount
  const persisted = useMemo(() => loadPersistedFilters(), []);

  // Merge: URL wins over localStorage wins over defaults
  const initial = useMemo<Required<SerializableFilterState>>(() => ({
    q: urlFilters.q || DEFAULTS.q,
    categories: urlFilters.categories && urlFilters.categories.length > 0
      ? urlFilters.categories
      : DEFAULTS.categories,
    tag: urlFilters.tag || DEFAULTS.tag,
    sort: urlFilters.sort ?? normalizePersistedSort(persisted.sort) ?? DEFAULTS.sort,
    favorites: urlFilters.favorites ?? persisted.favorites ?? DEFAULTS.favorites,
    unread: urlFilters.unread ?? persisted.unread ?? DEFAULTS.unread,
    formats: urlFilters.formats && urlFilters.formats.length > 0
      ? urlFilters.formats
      : persisted.formats || DEFAULTS.formats,
    timeRange: urlFilters.timeRange || persisted.timeRange || DEFAULTS.timeRange,
    collectionId: urlFilters.collectionId || DEFAULTS.collectionId,
    formatTagIds: urlFilters.formatTagIds && urlFilters.formatTagIds.length > 0
      ? urlFilters.formatTagIds
      : DEFAULTS.formatTagIds,
    domainTagIds: urlFilters.domainTagIds && urlFilters.domainTagIds.length > 0
      ? urlFilters.domainTagIds
      : DEFAULTS.domainTagIds,
    subtopicTagIds: urlFilters.subtopicTagIds && urlFilters.subtopicTagIds.length > 0
      ? urlFilters.subtopicTagIds
      : DEFAULTS.subtopicTagIds,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- State ----
  const [searchInputValue, setSearchInputValueRaw] = useState(initial.q);
  const [debouncedQuery, setDebouncedQuery] = useState(initial.q);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [tag, setTag] = useState<string | null>(initial.tag || null);
  const [sort, setSort] = useState<SortOrder>(initial.sort);
  const [favorites, setFavorites] = useState(initial.favorites);
  const [unread, setUnread] = useState(initial.unread);
  const [formats, setFormats] = useState<string[]>(initial.formats);
  const [timeRange, setTimeRange] = useState<TimeRange>(initial.timeRange);
  const [collectionId, setCollectionId] = useState<string | null>(initial.collectionId || null);
  const [formatTagIds, setFormatTagIds] = useState<string[]>(initial.formatTagIds);
  const [domainTagIds, setDomainTagIds] = useState<string[]>(initial.domainTagIds);
  const [subtopicTagIds, setSubtopicTagIds] = useState<string[]>(initial.subtopicTagIds);

  // ---- Debounce search input ----
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setSearchInput = useCallback((value: string) => {
    const trimmed = value.trimStart();
    setSearchInputValueRaw(trimmed);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(trimmed.trim());
    }, DEBOUNCE_MS);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // ---- URL sync (write) ----
  // CRITICAL: Must preserve URL params that belong to other components (e.g. "expanded"
  // used by ArticleGrid's drawer). Only touch params that belong to the filter system.
  const FILTER_PARAM_KEYS = new Set(['q', 'cat', 'tag', 'sort', 'favorites', 'unread', 'fmt', 'time', 'col', 'ft', 'dt', 'st']);

  const syncRef = useRef(false);
  useEffect(() => {
    // Skip the first render to avoid overwriting initial URL
    if (!syncRef.current) {
      syncRef.current = true;
      return;
    }
    const serializable: SerializableFilterState = {
      q: debouncedQuery || undefined,
      categories: categories.length > 0 ? categories : undefined,
      tag: tag || undefined,
      sort: sort !== 'latest' ? sort : undefined,
      favorites: favorites || undefined,
      unread: unread || undefined,
      formats: formats.length > 0 ? formats : undefined,
      timeRange: timeRange !== 'all' ? timeRange : undefined,
      collectionId: collectionId || undefined,
      formatTagIds: formatTagIds.length > 0 ? formatTagIds : undefined,
      domainTagIds: domainTagIds.length > 0 ? domainTagIds : undefined,
      subtopicTagIds: subtopicTagIds.length > 0 ? subtopicTagIds : undefined,
    };
    const filterParams = filtersToParams(serializable);

    setSearchParams((prev) => {
      // Start with non-filter params from the current URL (preserve "expanded", etc.)
      const merged = new URLSearchParams();
      for (const [key, value] of prev.entries()) {
        if (!FILTER_PARAM_KEYS.has(key)) {
          merged.append(key, value);
        }
      }
      // Layer filter params on top
      for (const [key, value] of filterParams.entries()) {
        merged.append(key, value);
      }
      return merged;
    }, { replace: true });

    persistFilters(serializable);
  }, [debouncedQuery, categories, tag, sort, favorites, unread, formats, timeRange, collectionId, formatTagIds, domainTagIds, subtopicTagIds, setSearchParams]);

  // ---- Derived ----
  const activeCategory = useMemo(() => {
    if (categories.length === 0) return 'All';
    if (categories.includes('Today')) return 'Today';
    return categories[0] || 'All';
  }, [categories]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (debouncedQuery) count++;
    count += categories.length;
    if (tag) count++;
    if (sort !== 'latest') count++;
    if (favorites) count++;
    if (unread) count++;
    count += formats.length;
    if (timeRange !== 'all') count++;
    if (collectionId) count++;
    count += formatTagIds.length;
    count += domainTagIds.length;
    count += subtopicTagIds.length;
    return count;
  }, [debouncedQuery, categories, tag, sort, favorites, unread, formats, timeRange, collectionId, formatTagIds, domainTagIds, subtopicTagIds]);

  const hasActiveFilters = activeFilterCount > 0;

  // ---- Category toggle ----
  const toggleCategory = useCallback((cat: string) => {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }, []);

  // ---- Format toggle ----
  const toggleFormat = useCallback((fmt: string) => {
    setFormats(prev =>
      prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]
    );
  }, []);

  // ---- Dimension tag toggles ----
  const toggleFormatTag = useCallback((tagId: string) => {
    setFormatTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const toggleDomainTag = useCallback((tagId: string) => {
    setDomainTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const toggleSubtopicTag = useCallback((tagId: string) => {
    setSubtopicTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  }, []);

  // ---- Resets ----
  const clearAll = useCallback(() => {
    setSearchInputValueRaw('');
    setDebouncedQuery('');
    setCategories([]);
    setTag(null);
    setSort('latest');
    setFavorites(false);
    setUnread(false);
    setFormats([]);
    setTimeRange('all');
    setCollectionId(null);
    setFormatTagIds([]);
    setDomainTagIds([]);
    setSubtopicTagIds([]);
    clearTimeout(debounceRef.current);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInputValueRaw('');
    setDebouncedQuery('');
    clearTimeout(debounceRef.current);
  }, []);

  const clearCategories = useCallback(() => setCategories([]), []);
  const clearTag = useCallback(() => setTag(null), []);
  const clearSort = useCallback(() => setSort('latest'), []);
  const clearCollection = useCallback(() => setCollectionId(null), []);
  const clearFavorites = useCallback(() => setFavorites(false), []);
  const clearUnread = useCallback(() => setUnread(false), []);
  const clearFormats = useCallback(() => setFormats([]), []);
  const clearTimeRange = useCallback(() => setTimeRange('all'), []);
  const clearFormatTags = useCallback(() => setFormatTagIds([]), []);
  const clearDomainTags = useCallback(() => setDomainTagIds([]), []);
  const clearSubtopicTags = useCallback(() => setSubtopicTagIds([]), []);

  return {
    searchQuery: debouncedQuery,
    searchInputValue,
    selectedCategories: categories,
    selectedTag: tag,
    sortOrder: sort,
    favorites,
    unread,
    formats,
    timeRange,
    collectionId,
    formatTagIds,
    domainTagIds,
    subtopicTagIds,
    activeCategory,
    hasActiveFilters,
    activeFilterCount,
    setSearchInput,
    setSelectedCategories: setCategories,
    toggleCategory,
    setSelectedTag: setTag,
    setSortOrder: setSort,
    setFavorites,
    setUnread,
    toggleFormat,
    setTimeRange,
    setCollectionId,
    toggleFormatTag,
    toggleDomainTag,
    toggleSubtopicTag,
    clearAll,
    clearSearch,
    clearCategories,
    clearTag,
    clearSort,
    clearCollection,
    clearFavorites,
    clearUnread,
    clearFormats,
    clearTimeRange,
    clearFormatTags,
    clearDomainTags,
    clearSubtopicTags,
  };
}
