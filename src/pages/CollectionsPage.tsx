import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Article, Collection } from '@/types';
import { Link } from 'react-router-dom';
import { storageService } from '@/services/storageService';
import { ChevronDown, Folder, Loader2, Pencil, Plus, X } from 'lucide-react';
import { EmptyState } from '@/components/UI/EmptyState';
import { CollectionBrowseRow } from '@/components/collections/CollectionBrowseRow';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { CollectionTable } from '@/components/collections/CollectionTable';
import { CollectionsHeader } from '@/components/collections/CollectionsHeader';
import { CollectionsToolbar } from '@/components/collections/CollectionsToolbar';
import {
  AppliedFilterChip,
} from '@/components/collections/AppliedFiltersBar';
import { TaxonomySidebar, TaxonomyNode } from '@/components/collections/TaxonomySidebar';
import { CollectionsSkeletonState } from '@/components/collections/CollectionsSkeletonState';
import { useToast } from '@/hooks/useToast';
import { ModalShell } from '@/components/UI/ModalShell';
import { useAuth } from '@/hooks/useAuth';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';
import { WorkspaceTopSection } from '@/components/workspace/WorkspaceTopSection';
import { ArticleGrid } from '@/components/ArticleGrid';
import { ArticleModal } from '@/components/ArticleModal';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type ViewMode = 'grid' | 'table';
type SortField = 'created' | 'updated' | 'followers' | 'nuggets' | 'name';
type SortDirection = 'asc' | 'desc';
type LandingMode = 'browse' | 'manage';
const TAXONOMY_COLLAPSE_STORAGE_KEY = 'collections.taxonomyCollapsed';
const LANDING_MODE_STORAGE_KEY = 'collections.landingMode';

const CreateCollectionInstructionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}> = ({ isOpen, onClose, isAdmin }) => (
  <ModalShell isOpen={isOpen} onClose={onClose} wrapperClassName="p-4">
    <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
        <X size={20} />
      </button>
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
          <Folder size={24} />
        </div>
        <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
          {isAdmin ? 'How to create a public collection' : 'Public collections'}
        </h3>
        <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {isAdmin ? (
            <>
              Collections usually start from a nugget. Use the card menu <strong>Add to collection</strong> (admin) or
              admin tools to add entries. Public collections are editorial — standard visitors browse only.
            </>
          ) : (
            <>
              These pages are curated by the team. To save something for yourself, use the <strong>bookmark</strong> icon
              and manage items under <strong>Saved</strong> with private folders.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-slate-900"
        >
          Got it
        </button>
      </div>
    </div>
  </ModalShell>
);

interface ScopedHeaderProps {
  title: string;
  breadcrumb?: string;
  count: number;
  description?: string;
  childCollections: Collection[];
  showChildPills: boolean;
  onSelectChild: (child: Collection) => void;
  onBrowseAll: () => void;
  editHref?: string;
}

const ScopedHeader: React.FC<ScopedHeaderProps> = React.memo(({
  title,
  breadcrumb,
  count,
  description,
  childCollections,
  showChildPills,
  onSelectChild,
  onBrowseAll,
  editHref,
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  return (
    <div className="mb-2 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-h-[40px] items-center gap-2 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h2 className="truncate text-[14px] font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {breadcrumb && (
            <span className="hidden shrink-0 text-[11.5px] text-slate-400 sm:inline dark:text-slate-500">
              · {breadcrumb}
            </span>
          )}
          <span className="ml-1 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {count}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setIsDetailsOpen((previous) => !previous)}
            aria-expanded={isDetailsOpen}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            About
            <ChevronDown
              size={12}
              className={`transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={onBrowseAll}
            className="inline-flex h-7 items-center rounded-md px-2 text-[11.5px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            Browse all
          </button>
          {editHref && (
            <Link
              to={editHref}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Edit collection"
            >
              <Pencil size={12} />
              Edit
            </Link>
          )}
        </div>
      </div>
      {isDetailsOpen && (
        <div className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
          <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            {description?.trim()
              ? description
              : 'No description provided for this collection.'}
          </p>
          {showChildPills && childCollections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {childCollections.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onSelectChild(child)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {child.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
ScopedHeader.displayName = 'ScopedHeader';

interface TopicChip {
  id: string;
  name: string;
  count: number;
}

const TOPIC_CHIP_COLLAPSED_LIMIT = 14;
const TOPIC_CHIP_SKELETON_WIDTHS = [88, 64, 104, 72, 96, 80, 56, 92];

const TopicChipSkeleton: React.FC = () => (
  <div className="mb-4 flex flex-nowrap items-center gap-1.5 overflow-hidden sm:flex-wrap" aria-hidden>
    {TOPIC_CHIP_SKELETON_WIDTHS.map((width, index) => (
      <div
        key={index}
        className="h-8 shrink-0 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800/70"
        style={{ width }}
      />
    ))}
  </div>
);

const TopicChipStrip: React.FC<{
  groups: TopicChip[];
  isLoading: boolean;
  onSelect: (id: string) => void;
}> = React.memo(({ groups, isLoading, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  if (isLoading && groups.length === 0) return <TopicChipSkeleton />;
  if (groups.length === 0) return null;

  const overflowCount = Math.max(0, groups.length - TOPIC_CHIP_COLLAPSED_LIMIT);
  const visible = isExpanded || overflowCount === 0
    ? groups
    : groups.slice(0, TOPIC_CHIP_COLLAPSED_LIMIT);

  const handleToggle = () => {
    const collapsing = isExpanded;
    setIsExpanded((previous) => !previous);
    if (collapsing) {
      requestAnimationFrame(() => {
        toggleRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  };

  return (
    <div
      className="mb-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:[mask-image:none]"
    >
      {visible.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => onSelect(group.id)}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-primary-700 dark:hover:bg-primary-900/20 dark:hover:text-primary-300"
        >
          <span className="truncate max-w-[220px]">{group.name}</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {group.count}
          </span>
        </button>
      ))}
      {overflowCount > 0 && (
        <button
          ref={toggleRef}
          type="button"
          onClick={handleToggle}
          className="inline-flex h-8 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Show less' : `+${overflowCount} more`}
        </button>
      )}
    </div>
  );
});
TopicChipStrip.displayName = 'TopicChipStrip';

interface BrowseLandingProps {
  topicGroups: TopicChip[];
  topicsLoading: boolean;
  searchQuery: string;
  onSelectTopic: (id: string) => void;
  onArticleClick: (article: Article) => void;
  onTotalCountChange: (total: number) => void;
}

const BrowseLanding: React.FC<BrowseLandingProps> = ({
  topicGroups,
  topicsLoading,
  searchQuery,
  onSelectTopic,
  onArticleClick,
  onTotalCountChange,
}) => {
  const {
    articles,
    totalCount,
    isLoading,
    isFeedRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteArticles({
    searchQuery,
    activeCategory: 'All',
    sortOrder: 'latest',
    limit: 25,
  });

  useEffect(() => {
    onTotalCountChange(totalCount ?? 0);
  }, [totalCount, onTotalCountChange]);

  const trimmedQuery = searchQuery.trim();
  return (
    <>
      <TopicChipStrip groups={topicGroups} isLoading={topicsLoading} onSelect={onSelectTopic} />
      <ArticleGrid
        articles={articles}
        viewMode="grid"
        isLoading={isLoading}
        isFeedRefetching={isFeedRefetching}
        searchHighlightQuery={trimmedQuery || undefined}
        onArticleClick={onArticleClick}
        onCategoryClick={() => {}}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        error={error || null}
        onRetry={refetch}
        emptyTitle={trimmedQuery ? 'No matching nuggets' : 'No nuggets yet'}
        emptyMessage={
          trimmedQuery
            ? 'Try a different search or pick a topic above.'
            : 'Check back soon for fresh content across collections.'
        }
      />
    </>
  );
};

interface ScopedNuggetFeedProps {
  collectionId: string;
  searchQuery: string;
  sortOrder: 'latest' | 'oldest';
  onTotalCountChange: (total: number) => void;
  onArticleClick: (article: Article) => void;
}

const ScopedNuggetFeed: React.FC<ScopedNuggetFeedProps> = ({
  collectionId,
  searchQuery,
  sortOrder,
  onTotalCountChange,
  onArticleClick,
}) => {
  const {
    articles,
    totalCount,
    isLoading,
    isFeedRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteArticles({
    searchQuery,
    activeCategory: 'All',
    sortOrder,
    collectionId,
    limit: 24,
  });

  useEffect(() => {
    onTotalCountChange(totalCount ?? 0);
  }, [totalCount, onTotalCountChange]);

  if (isLoading) return <CollectionsSkeletonState />;

  const trimmedQuery = searchQuery.trim();
  return (
    <ArticleGrid
      articles={articles}
      viewMode="grid"
      isLoading={false}
      isFeedRefetching={isFeedRefetching}
      searchHighlightQuery={trimmedQuery || undefined}
      onArticleClick={onArticleClick}
      onCategoryClick={() => {}}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={fetchNextPage}
      error={error || null}
      onRetry={refetch}
      emptyTitle={trimmedQuery ? 'No matching nuggets' : 'No nuggets in this topic yet'}
      emptyMessage={
        trimmedQuery
          ? 'Try a different nugget search or clear it to view all nuggets in this scope.'
          : 'This topic scope has no nuggets yet.'
      }
    />
  );
};

const LoadMore: React.FC<{
  onClick: () => void;
  isLoading: boolean;
  remaining: number;
}> = ({ onClick, isLoading, remaining }) => (
  <div className="mt-3 flex justify-center">
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-primary-300 dark:hover:bg-primary-900/20"
    >
      {isLoading ? (
        <>
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Loading…
        </>
      ) : (
        <>
          Load more
          {remaining > 0 && <span className="text-slate-400 dark:text-slate-500">· {remaining} more</span>}
        </>
      )}
    </button>
  </div>
);

export const CollectionsPage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [taxonomyCollections, setTaxonomyCollections] = useState<Collection[]>([]);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [collectionSearchInputValue, setCollectionSearchInputValue] = useState('');
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [nuggetSearchInputValue, setNuggetSearchInputValue] = useState('');
  const [nuggetSearchQuery, setNuggetSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showInstruction, setShowInstruction] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isTaxonomyCollapsed, setIsTaxonomyCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(TAXONOMY_COLLAPSE_STORAGE_KEY) === '1';
  });
  const [landingMode, setLandingMode] = useState<LandingMode>(() => {
    if (typeof window === 'undefined') return 'browse';
    const stored = window.localStorage.getItem(LANDING_MODE_STORAGE_KEY);
    return stored === 'manage' ? 'manage' : 'browse';
  });
  const [scopedNuggetTotal, setScopedNuggetTotal] = useState(0);
  const [browseNuggetTotal, setBrowseNuggetTotal] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const pageLimit = 24;
  const taxonomyPageLimit = 100;
  const toast = useToast();
  const { isAdmin } = useAuth();
  const isNarrowViewport = useMediaQuery('(max-width: 1023px)');

  const collectionSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nuggetSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleCollectionSearchInput = useCallback((value: string) => {
    setCollectionSearchInputValue(value);
    clearTimeout(collectionSearchDebounceRef.current);
    collectionSearchDebounceRef.current = setTimeout(() => setCollectionSearchQuery(value.trim()), 300);
  }, []);
  const handleNuggetSearchInput = useCallback((value: string) => {
    setNuggetSearchInputValue(value);
    clearTimeout(nuggetSearchDebounceRef.current);
    nuggetSearchDebounceRef.current = setTimeout(() => setNuggetSearchQuery(value.trim()), 300);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(collectionSearchDebounceRef.current);
      clearTimeout(nuggetSearchDebounceRef.current);
    },
    [],
  );

  const loadTaxonomyCollections = useCallback(async () => {
    setIsTaxonomyLoading(true);
    try {
      const allCollections: Collection[] = [];
      let page = 1;
      let total = Number.POSITIVE_INFINITY;
      while (allCollections.length < total) {
        const response = await storageService.getCollections({
          type: 'public',
          includeCount: true,
          includeEntries: false,
          summary: true,
          sortField: 'name',
          sortDirection: 'asc',
          page,
          limit: taxonomyPageLimit,
        });
        const pageData = Array.isArray(response) ? response : response?.data || [];
        const count = Array.isArray(response)
          ? pageData.length
          : typeof response?.count === 'number'
            ? response.count
            : pageData.length;
        total = count;
        allCollections.push(...pageData);
        if (pageData.length === 0 || allCollections.length >= total) break;
        page += 1;
      }
      setTaxonomyCollections(Array.from(new Map(allCollections.map((collection) => [collection.id, collection])).values()));
    } finally {
      setIsTaxonomyLoading(false);
    }
  }, []);

  const loadCollections = useCallback(async (page: number = 1, append: boolean = false) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const response = await storageService.getCollections({
        type: 'public',
        includeCount: true,
        searchQuery: collectionSearchQuery || undefined,
        sortField,
        sortDirection,
        page,
        limit: pageLimit,
        includeEntries: false,
      });
      const pageData = Array.isArray(response) ? response : response?.data || [];
      const total = Array.isArray(response)
        ? pageData.length
        : typeof response?.count === 'number'
          ? response.count
          : pageData.length;
      setCollections((previous) => (append ? [...previous, ...pageData] : pageData));
      setTotalCount(total);
      setHasMore(page * pageLimit < total);
      setCurrentPage(page);
    } catch (error: any) {
      if (error?.message !== 'Request cancelled') {
        console.error('Error loading collections:', error);
      }
      if (!append) {
        setCollections([]);
        setTotalCount(0);
      }
    } finally {
      if (append) setIsLoadingMore(false);
      else setIsLoading(false);
    }
  }, [collectionSearchQuery, pageLimit, sortDirection, sortField]);

  useEffect(() => {
    void loadTaxonomyCollections();
  }, [loadTaxonomyCollections]);

  const processedCollections = useMemo(() => collections, [collections]);

  const parentCollectionMap = useMemo(() => {
    const map = new Map<string, Collection>();
    taxonomyCollections.forEach((collection) => {
      if (!collection.parentId) map.set(collection.id, collection);
    });
    return map;
  }, [taxonomyCollections]);

  const taxonomyGroups = useMemo<TaxonomyNode[]>(() => {
    const childrenByParent = new Map<string, Collection[]>();
    taxonomyCollections.forEach((collection) => {
      if (!collection.parentId) return;
      const next = childrenByParent.get(collection.parentId) || [];
      next.push(collection);
      childrenByParent.set(collection.parentId, next);
    });

    return taxonomyCollections
      .filter((collection) => !collection.parentId)
      .map((parent) => {
        const children = childrenByParent.get(parent.id) || [];
        const parentOwn = parent.validEntriesCount ?? parent.entries?.length ?? 0;
        const childrenTotal = children.reduce(
          (sum, child) => sum + (child.validEntriesCount ?? child.entries?.length ?? 0),
          0,
        );
        return {
          id: parent.id,
          name: parent.name,
          count: parentOwn + childrenTotal,
          children: children.map((child) => ({
            id: child.id,
            name: child.name,
            count: child.validEntriesCount ?? child.entries?.length ?? 0,
          })),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [taxonomyCollections]);

  const topicChipGroups = useMemo<TopicChip[]>(() => {
    return taxonomyGroups
      .map((group) => ({ id: group.id, name: group.name, count: group.count }))
      .filter((group) => group.count > 0)
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.name.localeCompare(right.name);
      });
  }, [taxonomyGroups]);

  const taxonomyLabelById = useMemo<Record<string, string>>(() => {
    const labels: Record<string, string> = {};
    taxonomyCollections.forEach((collection) => {
      const parent = collection.parentId ? parentCollectionMap.get(collection.parentId) : null;
      labels[collection.id] = parent ? `${parent.name} / ${collection.name}` : collection.name;
    });
    return labels;
  }, [taxonomyCollections, parentCollectionMap]);

  const parentNameById = useMemo<Record<string, string>>(() => {
    const names: Record<string, string> = {};
    taxonomyCollections.forEach((collection) => {
      if (!collection.parentId) return;
      const parent = parentCollectionMap.get(collection.parentId);
      if (parent) names[collection.id] = parent.name;
    });
    return names;
  }, [taxonomyCollections, parentCollectionMap]);

  const selectedParentCollection = useMemo(
    () => taxonomyCollections.find((collection) => collection.id === selectedParentId) || null,
    [taxonomyCollections, selectedParentId],
  );
  const selectedChildCollection = useMemo(
    () => taxonomyCollections.find((collection) => collection.id === selectedChildId) || null,
    [taxonomyCollections, selectedChildId],
  );

  const childCollectionsForSelectedParent = useMemo(
    () =>
      selectedParentId
        ? taxonomyCollections
            .filter((collection) => collection.parentId === selectedParentId)
            .sort((left, right) => left.name.localeCompare(right.name))
        : [],
    [taxonomyCollections, selectedParentId],
  );

  const scopedCollectionIds = useMemo(() => {
    if (selectedChildId) return [selectedChildId];
    if (!selectedParentId) return [];
    // Backend's getCollectionArticles returns the union of parent + child entries
    // when given the parent id, so a single fetch is sufficient.
    return [selectedParentId];
  }, [selectedChildId, selectedParentId]);

  const isScopedMode = scopedCollectionIds.length > 0;
  const isMobileCollectionLanding = isNarrowViewport && !isScopedMode && landingMode === 'browse';
  const isBrowseLanding = !isScopedMode && landingMode === 'browse' && !isMobileCollectionLanding;

  const breadcrumb = useMemo(() => {
    if (selectedChildCollection && selectedParentCollection) {
      return ['Collections', selectedParentCollection.name, selectedChildCollection.name];
    }
    if (selectedParentCollection) {
      return ['Collections', selectedParentCollection.name];
    }
    return [];
  }, [selectedChildCollection, selectedParentCollection]);

  useEffect(() => {
    if (isScopedMode || (landingMode === 'browse' && !isMobileCollectionLanding)) {
      setCollections([]);
      setTotalCount(0);
      setHasMore(false);
      setCurrentPage(1);
      setIsLoading(false);
      return;
    }
    setCurrentPage(1);
    void loadCollections(1, false);
  }, [isMobileCollectionLanding, isScopedMode, landingMode, loadCollections]);

  useEffect(() => {
    if (!isScopedMode) setScopedNuggetTotal(0);
  }, [isScopedMode]);

  useEffect(() => {
    if (!isBrowseLanding) setBrowseNuggetTotal(0);
  }, [isBrowseLanding]);

  useEffect(() => {
    if (isScopedMode && selectionMode) {
      setSelectionMode(false);
      setSelectedIds([]);
    }
  }, [isScopedMode, selectionMode]);

  const selectedScopeLabel = useMemo(() => {
    if (selectedChildCollection && selectedParentCollection) {
      return `${selectedParentCollection.name} / ${selectedChildCollection.name}`;
    }
    return selectedParentCollection?.name ?? null;
  }, [selectedChildCollection, selectedParentCollection]);
  const hasSelectedScope = Boolean(selectedScopeLabel);

  const searchInputValue = isScopedMode || isBrowseLanding ? nuggetSearchInputValue : collectionSearchInputValue;
  const activeSearchQuery = isScopedMode || isBrowseLanding ? nuggetSearchQuery : collectionSearchQuery;
  const handleSearchInput = isScopedMode || isBrowseLanding ? handleNuggetSearchInput : handleCollectionSearchInput;

  const appliedFilters = useMemo<AppliedFilterChip[]>(() => {
    const chips: AppliedFilterChip[] = [];
    if (activeSearchQuery) {
      chips.push({
        id: 'search',
        label: `Search: "${activeSearchQuery}"`,
        onRemove: () => {
          if (isScopedMode || isBrowseLanding) {
            setNuggetSearchInputValue('');
            setNuggetSearchQuery('');
          } else {
            setCollectionSearchInputValue('');
            setCollectionSearchQuery('');
          }
        },
      });
    }
    if (selectedScopeLabel) {
      chips.push({
        id: 'scope',
        label: `Scope: ${selectedScopeLabel}`,
        onRemove: () => {
          setSelectedParentId(null);
          setSelectedChildId(null);
        },
      });
    }
    return chips;
  }, [activeSearchQuery, isBrowseLanding, isScopedMode, selectedScopeLabel]);

  const toggleSelectionMode = () => {
    const newMode = !selectionMode;
    setSelectionMode(newMode);
    if (!newMode) setSelectedIds([]);
  };

  const handleScopedSelectChild = useCallback((child: Collection) => {
    setSelectedParentId(child.parentId || null);
    setSelectedChildId(child.id);
  }, []);

  const handleScopedBrowseAll = useCallback(() => {
    setSelectedParentId(null);
    setSelectedChildId(null);
  }, []);

  const handleSelectCollection = useCallback(
    (idOrCollection: string | Collection) => {
      const collection =
        typeof idOrCollection === 'string'
          ? collections.find((candidate) => candidate.id === idOrCollection) ||
            taxonomyCollections.find((candidate) => candidate.id === idOrCollection)
          : idOrCollection;
      if (!collection) return;
      if (collection.parentId) {
        setSelectedParentId(collection.parentId);
        setSelectedChildId(collection.id);
      } else {
        setSelectedParentId(collection.id);
        setSelectedChildId(null);
      }
    },
    [collections, taxonomyCollections],
  );

  const handleSelect = (id: string) => {
    setSelectedIds((previous) => (previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]));
  };

  const handleBulkFollow = async (action: 'follow' | 'unfollow') => {
    if (selectedIds.length === 0) return;
    const previousCollections = [...collections];
    setCollections((previous) =>
      previous.map((collection) => {
        if (!selectedIds.includes(collection.id)) return collection;
        const change = action === 'follow' ? 1 : -1;
        return {
          ...collection,
          followersCount: Math.max(0, collection.followersCount + change),
          followers:
            action === 'follow'
              ? [...(collection.followers || []), 'temp']
              : (collection.followers || []).slice(0, -1),
        };
      }),
    );
    try {
      await Promise.all(
        selectedIds.map((id) => (action === 'follow' ? storageService.followCollection(id) : storageService.unfollowCollection(id))),
      );
      await loadCollections();
      toast.success(`${action === 'follow' ? 'Followed' : 'Unfollowed'} ${selectedIds.length} collections`);
      setSelectionMode(false);
      setSelectedIds([]);
      setIsActionMenuOpen(false);
    } catch (error: any) {
      setCollections(previousCollections);
      toast.error(
        error?.requestId
          ? `Failed to ${action} collections (Request ID: ${error.requestId})`
          : `Failed to ${action} collections`,
      );
    }
  };

  const handleCollectionUpdate = (updatedCollection: Collection) => {
    setCollections((previous) => previous.map((collection) => (collection.id === updatedCollection.id ? updatedCollection : collection)));
  };

  const headerTotalCount = isScopedMode
    ? scopedNuggetTotal
    : isBrowseLanding
      ? browseNuggetTotal
      : totalCount;
  const headerVisibleCount = isScopedMode
    ? scopedNuggetTotal
    : isBrowseLanding
      ? browseNuggetTotal
      : processedCollections.length;
  const headerTitle = isBrowseLanding ? 'Latest Nuggets' : isMobileCollectionLanding ? 'Collections' : 'Community Collections';
  const scopedSummaryTitle = selectedChildCollection?.name || selectedParentCollection?.name || 'Collections';
  const scopedSummaryDescription = selectedChildCollection?.description || selectedParentCollection?.description;
  const layoutGridClass = isTaxonomyCollapsed ? 'lg:grid-cols-[40px_1fr]' : 'lg:grid-cols-[260px_1fr]';
  const searchPlaceholder = isScopedMode
    ? 'Search nuggets in this collection'
    : isBrowseLanding
      ? 'Search latest nuggets'
      : 'Search collections';
  const searchAriaLabel = isScopedMode
    ? 'Search nuggets in the selected collection scope'
    : isBrowseLanding
      ? 'Search latest nuggets'
      : 'Search collections';
  const collectionsEmptyCopy = collectionSearchQuery
    ? {
        title: 'No matching collections',
        description: 'Try a different collection search or clear it to browse all collections.',
      }
    : {
        title: 'No collections available',
        description: 'No collections available yet. Create the first collection to get started.',
      };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TAXONOMY_COLLAPSE_STORAGE_KEY, isTaxonomyCollapsed ? '1' : '0');
  }, [isTaxonomyCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANDING_MODE_STORAGE_KEY, landingMode);
  }, [landingMode]);

  useEffect(() => {
    if (!isAdmin && landingMode === 'manage') {
      setLandingMode('browse');
    }
  }, [isAdmin, landingMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <HeaderSpacer />
        <div className="mx-auto max-w-[1280px] px-3 py-4 sm:px-6 lg:px-8 lg:py-8">
          <CollectionsSkeletonState />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <HeaderSpacer />
      <div
        className={`lg:sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR} border-b border-slate-200/80 bg-slate-50/90 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75 transition-colors dark:border-slate-800 dark:bg-slate-950/85`}
        style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
      >
        <div className="mx-auto max-w-[1280px] px-3 py-2.5 sm:px-6 lg:px-8 lg:py-3">
          <WorkspaceTopSection
            header={
              <CollectionsHeader
                title={headerTitle}
                totalCount={headerTotalCount}
                visibleCount={headerVisibleCount}
                breadcrumb={breadcrumb}
                actions={
                  !selectionMode && isAdmin ? (
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      {!isScopedMode && (
                        <div
                          role="tablist"
                          aria-label="Collections view"
                          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={landingMode === 'browse'}
                            onClick={() => setLandingMode('browse')}
                            className={`inline-flex h-8 items-center rounded-md px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                              landingMode === 'browse'
                                ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
                            }`}
                          >
                            Browse
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={landingMode === 'manage'}
                            onClick={() => setLandingMode('manage')}
                            className={`inline-flex h-8 items-center rounded-md px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                              landingMode === 'manage'
                                ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
                            }`}
                          >
                            Manage
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowInstruction(true)}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[13px] font-semibold text-white transition-all hover:bg-slate-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:flex-initial dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        <Plus size={15} />
                        Create Collection
                      </button>
                    </div>
                  ) : null
                }
              />
            }
            toolbar={
              <CollectionsToolbar
                searchInputValue={searchInputValue}
                onSearchInput={handleSearchInput}
                sortField={sortField}
                sortDirection={sortDirection}
                setSortField={setSortField}
                toggleSortDirection={() => setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))}
                viewMode={viewMode}
                setViewMode={setViewMode}
                selectionMode={selectionMode}
                selectedCount={selectedIds.length}
                canSelect={!isScopedMode && landingMode === 'manage' && collections.length > 0}
                canCreate={isAdmin}
                onToggleSelection={toggleSelectionMode}
                onOpenActions={() => setIsActionMenuOpen((previous) => !previous)}
                onCloseActionMenu={() => setIsActionMenuOpen(false)}
                isActionMenuOpen={isActionMenuOpen}
                actionMenu={
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleBulkFollow('follow');
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-green-600 transition-colors hover:bg-green-50 dark:hover:bg-green-900/10"
                    >
                      Follow selected
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleBulkFollow('unfollow');
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                      Unfollow selected
                    </button>
                  </>
                }
                onOpenFiltersMobile={() => setIsMobileFiltersOpen(true)}
                mobileFilterCount={hasSelectedScope ? 1 : 0}
                appliedFilters={appliedFilters}
                showSortField={!isScopedMode && !isBrowseLanding}
                showMobileSort={isScopedMode}
                searchPlaceholder={searchPlaceholder}
                searchAriaLabel={searchAriaLabel}
                onClearFilters={() => {
                  if (isScopedMode || isBrowseLanding) {
                    setNuggetSearchInputValue('');
                    setNuggetSearchQuery('');
                  } else {
                    setCollectionSearchInputValue('');
                    setCollectionSearchQuery('');
                  }
                  setSelectedParentId(null);
                  setSelectedChildId(null);
                }}
              />
            }
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-3 pb-6 pt-3 sm:px-6 lg:px-8 lg:pb-8 lg:pt-5">
        <div className={`grid gap-4 ${layoutGridClass}`}>
          <TaxonomySidebar
            groups={taxonomyGroups}
            selectedParentId={selectedParentId}
            selectedChildId={selectedChildId}
            onSelectParent={setSelectedParentId}
            onSelectChild={setSelectedChildId}
            isMobileOpen={isMobileFiltersOpen}
            onCloseMobile={() => setIsMobileFiltersOpen(false)}
            resultCount={isScopedMode ? scopedNuggetTotal : processedCollections.length}
            onClearAll={() => {
              setSelectedParentId(null);
              setSelectedChildId(null);
            }}
            isDesktopCollapsed={isTaxonomyCollapsed}
            onExpandDesktop={() => setIsTaxonomyCollapsed(false)}
            onCollapseDesktop={() => setIsTaxonomyCollapsed(true)}
          />

          <section>
            {isScopedMode ? (
              <>
                <ScopedHeader
                  title={scopedSummaryTitle}
                  breadcrumb={
                    selectedChildCollection && selectedParentCollection
                      ? `${selectedParentCollection.name} / ${selectedChildCollection.name}`
                      : undefined
                  }
                  count={scopedNuggetTotal}
                  description={scopedSummaryDescription}
                  childCollections={childCollectionsForSelectedParent}
                  showChildPills={!selectedChildCollection}
                  onSelectChild={handleScopedSelectChild}
                  onBrowseAll={handleScopedBrowseAll}
                  editHref={
                    isAdmin
                      ? `/collections/${selectedChildId || selectedParentId}`
                      : undefined
                  }
                />

                <ScopedNuggetFeed
                  collectionId={selectedChildId || selectedParentId || ''}
                  searchQuery={nuggetSearchQuery}
                  sortOrder={sortDirection === 'asc' ? 'oldest' : 'latest'}
                  onTotalCountChange={setScopedNuggetTotal}
                  onArticleClick={setSelectedArticle}
                />
              </>
            ) : isBrowseLanding ? (
              <BrowseLanding
                topicGroups={topicChipGroups}
                topicsLoading={isTaxonomyLoading}
                searchQuery={nuggetSearchQuery}
                onSelectTopic={handleSelectCollection}
                onArticleClick={setSelectedArticle}
                onTotalCountChange={setBrowseNuggetTotal}
              />
            ) : processedCollections.length === 0 ? (
              <EmptyState
                icon={<Folder />}
                title={collectionsEmptyCopy.title}
                description={collectionsEmptyCopy.description}
              />
            ) : (
              <>
                <div className="lg:hidden">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 dark:border-slate-800 dark:bg-slate-900">
                    <ul className="list-none divide-y divide-slate-100 dark:divide-slate-800" aria-label="Collections">
                      {processedCollections.map((collection) => (
                        <CollectionBrowseRow
                          key={collection.id}
                          collection={collection}
                          onClick={() => handleSelectCollection(collection)}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.includes(collection.id)}
                          onSelect={handleSelect}
                          onCollectionUpdate={handleCollectionUpdate}
                          taxonomyLabel={taxonomyLabelById[collection.id]}
                          parentName={parentNameById[collection.id]}
                        />
                      ))}
                    </ul>
                  </div>
                  {hasMore && !selectionMode && (
                    <LoadMore
                      onClick={() => void loadCollections(currentPage + 1, true)}
                      isLoading={isLoadingMore}
                      remaining={Math.max(0, totalCount - collections.length)}
                    />
                  )}
                </div>
                <div className="hidden lg:block">
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                      {processedCollections.map((collection) => (
                        <CollectionCard
                          key={collection.id}
                          collection={collection}
                          onClick={() => (selectionMode ? handleSelect(collection.id) : handleSelectCollection(collection))}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.includes(collection.id)}
                          onSelect={handleSelect}
                          onCollectionUpdate={handleCollectionUpdate}
                          taxonomyLabel={taxonomyLabelById[collection.id]}
                        />
                      ))}
                    </div>
                  ) : (
                    <CollectionTable
                      collections={processedCollections}
                      taxonomyLabelById={taxonomyLabelById}
                      onClick={(id) => handleSelectCollection(id)}
                    />
                  )}
                  {hasMore && !selectionMode && (
                    <LoadMore
                      onClick={() => void loadCollections(currentPage + 1, true)}
                      isLoading={isLoadingMore}
                      remaining={Math.max(0, totalCount - collections.length)}
                    />
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {showInstruction && (
        <CreateCollectionInstructionModal
          isOpen={showInstruction}
          onClose={() => setShowInstruction(false)}
          isAdmin={isAdmin}
        />
      )}
      {selectedArticle && (
        <ArticleModal
          isOpen={!!selectedArticle}
          onClose={() => setSelectedArticle(null)}
          article={selectedArticle}
        />
      )}
    </div>
  );
};
