import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Collection, User } from '@/types';
import { storageService } from '@/services/storageService';
import { Folder, Plus, X } from 'lucide-react';
import { EmptyState } from '@/components/UI/EmptyState';
import { useNavigate } from 'react-router-dom';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { CollectionTable } from '@/components/collections/CollectionTable';
import { CollectionsHeader } from '@/components/collections/CollectionsHeader';
import { CollectionsToolbar } from '@/components/collections/CollectionsToolbar';
import {
  AppliedFilterChip,
  AppliedFiltersBar,
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

type ViewMode = 'grid' | 'table';
type SortField = 'created' | 'updated' | 'followers' | 'nuggets' | 'name';
type SortDirection = 'asc' | 'desc';

// -- Internal Instruction Modal --
const CreateCollectionInstructionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}> = ({ isOpen, onClose, isAdmin }) => (
  <ModalShell isOpen={isOpen} onClose={onClose} wrapperClassName="p-4">
    <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 animate-in zoom-in-95 z-10">
      <button type="button" onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
        <X size={20} />
      </button>

      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mb-4">
          <Folder size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          {isAdmin ? 'How to create a public collection' : 'Public collections'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {isAdmin ? (
            <>
              Collections usually start from a nugget. Use the card menu <strong>Add to collection</strong> (admin) or
              admin tools to add entries. Public collections are editorial — standard visitors browse only.
            </>
          ) : (
            <>
              These pages are curated by the team. To save something for yourself, use the{' '}
              <strong>bookmark</strong> icon and manage items under <strong>Saved</strong> with private folders.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Got it
        </button>
      </div>
    </div>
  </ModalShell>
);

export const CollectionsPage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0); // Backend-provided count
  const [isLoading, setIsLoading] = useState(true);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showInstruction, setShowInstruction] = useState(false);
  // NOTE: This page currently has no visible pagination controls,
  // so we fetch all matching collections across pages.
  const pageLimit = 100;

  // Selection State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Table layout can't breathe on narrow screens; force grid without clobbering the user's
  // explicit desktop preference.
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (event: MediaQueryListEvent) => setIsSmallScreen(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const effectiveViewMode: ViewMode = isSmallScreen ? 'grid' : viewMode;

  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();

  // Debounce search input (300ms) to avoid API call on every keystroke
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearchInput = useCallback((value: string) => {
    setSearchInputValue(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value.trim());
    }, 300);
  }, []);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Reload collections when debounced search/sort changes (backend handles filtering/sorting)
  useEffect(() => {
    loadCollections();
  }, [searchQuery, sortField, sortDirection]);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      const fetchCollectionsPage = (page: number) =>
        storageService.getCollections({
          type: 'public',
          includeCount: true,
          searchQuery: searchQuery || undefined,
          sortField,
          sortDirection,
          page,
          limit: pageLimit,
        });

      // First page gives us total count; fetch remaining pages if needed.
      const firstPageResponse = await fetchCollectionsPage(1);
      const firstPageData = Array.isArray(firstPageResponse)
        ? firstPageResponse
        : (firstPageResponse?.data || []);
      const total = Array.isArray(firstPageResponse)
        ? firstPageData.length
        : (typeof firstPageResponse?.count === 'number' ? firstPageResponse.count : firstPageData.length);

      let collectionsData: Collection[] = [...firstPageData];
      if (total > firstPageData.length) {
        const totalPages = Math.ceil(total / pageLimit);
        const remainingPagePromises: Array<Promise<Collection[] | { data: Collection[]; count: number }>> = [];
        for (let page = 2; page <= totalPages; page++) {
          remainingPagePromises.push(
            storageService.getCollections({
              type: 'public',
              searchQuery: searchQuery || undefined,
              sortField,
              sortDirection,
              page,
              limit: pageLimit,
            })
          );
        }

        const remainingPageResponses = await Promise.all(remainingPagePromises);
        remainingPageResponses.forEach((response) => {
          if (Array.isArray(response)) {
            collectionsData.push(...response);
          } else if (response?.data && Array.isArray(response.data)) {
            collectionsData.push(...response.data);
          }
        });
      }

      // User list requires authentication; guests still see collections without creator hydration
      let allUsers: User[] = [];
      try {
        const allUsersResponse = await storageService.getUsers();
        allUsers = Array.isArray(allUsersResponse) ? allUsersResponse : [];
      } catch {
        allUsers = [];
      }

      const hydrated = collectionsData.map(col => ({
          ...col,
          creator: allUsers.find(u => u.id === col.creatorId)
      }));

      setCollections(hydrated);
      setTotalCount(total);
    } catch (error: any) {
      // Handle cancelled requests gracefully
      if (error?.message !== 'Request cancelled') {
        console.error('Error loading collections:', error);
      }
      setCollections([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  // PHASE 5: Collections are already sorted/filtered by backend, no client-side processing needed
  // Keep this for backward compatibility but collections come pre-sorted from backend
  const processedCollections = useMemo(() => {
    if (selectedChildId) {
      return collections.filter((collection) => collection.id === selectedChildId);
    }

    if (selectedParentId) {
      return collections.filter(
        (collection) => collection.id === selectedParentId || collection.parentId === selectedParentId
      );
    }

    return collections;
  }, [collections, selectedChildId, selectedParentId]);

  const parentCollectionMap = useMemo(() => {
    const map = new Map<string, Collection>();
    collections.forEach((collection) => {
      if (!collection.parentId) {
        map.set(collection.id, collection);
      }
    });
    return map;
  }, [collections]);

  const taxonomyGroups = useMemo<TaxonomyNode[]>(() => {
    const childrenByParent = new Map<string, Collection[]>();
    collections.forEach((collection) => {
      if (collection.parentId) {
        const next = childrenByParent.get(collection.parentId) || [];
        next.push(collection);
        childrenByParent.set(collection.parentId, next);
      }
    });

    const groups: TaxonomyNode[] = [];
    collections
      .filter((collection) => !collection.parentId)
      .forEach((parent) => {
        const children = (childrenByParent.get(parent.id) || []).map((child) => ({
          id: child.id,
          name: child.name,
          count: child.validEntriesCount ?? child.entries?.length ?? 0,
        }));

        groups.push({
          id: parent.id,
          name: parent.name,
          count: parent.validEntriesCount ?? parent.entries?.length ?? 0,
          children,
        });
      });

    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }, [collections]);

  const taxonomyLabelById = useMemo<Record<string, string>>(() => {
    const labels: Record<string, string> = {};
    collections.forEach((collection) => {
      const parent = collection.parentId ? parentCollectionMap.get(collection.parentId) : null;
      labels[collection.id] = parent ? `${parent.name} / ${collection.name}` : collection.name;
    });
    return labels;
  }, [collections, parentCollectionMap]);

  const breadcrumb = useMemo(() => {
    if (selectedChildId) {
      const child = collections.find((collection) => collection.id === selectedChildId);
      if (!child) return [];
      const parent = child.parentId ? parentCollectionMap.get(child.parentId) : null;
      return ['Collections', parent?.name || 'Sub-collection', child.name];
    }

    if (selectedParentId) {
      const parent = collections.find((collection) => collection.id === selectedParentId);
      return parent ? ['Collections', parent.name] : ['Collections'];
    }

    return [];
  }, [selectedChildId, selectedParentId, collections, parentCollectionMap]);

  const appliedFilters = useMemo<AppliedFilterChip[]>(() => {
    const chips: AppliedFilterChip[] = [];

    if (searchQuery) {
      chips.push({
        id: 'search',
        label: `Search: "${searchQuery}"`,
        onRemove: () => {
          setSearchInputValue('');
          setSearchQuery('');
        },
      });
    }

    if (selectedParentId) {
      const selectedParent = collections.find((collection) => collection.id === selectedParentId);
      if (selectedParent) {
        chips.push({
          id: `parent-${selectedParent.id}`,
          label: `Parent: ${selectedParent.name}`,
          onRemove: () => {
            setSelectedParentId(null);
            setSelectedChildId(null);
          },
        });
      }
    }

    if (selectedChildId) {
      const selectedChild = collections.find((collection) => collection.id === selectedChildId);
      if (selectedChild) {
        chips.push({
          id: `child-${selectedChild.id}`,
          label: `Sub-collection: ${selectedChild.name}`,
          onRemove: () => setSelectedChildId(null),
        });
      }
    }

    return chips;
  }, [collections, searchQuery, selectedParentId, selectedChildId]);

  const toggleSelectionMode = () => {
      const newMode = !selectionMode;
      setSelectionMode(newMode);
      if (!newMode) setSelectedIds([]);
  };

  const handleSelect = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkFollow = async (action: 'follow' | 'unfollow') => {
      if (selectedIds.length === 0) return;
      
      // Store previous state for rollback
      const previousCollections = [...collections];
      
      // Optimistic update
      setCollections(prev => prev.map(c => {
          if (selectedIds.includes(c.id)) {
              const change = action === 'follow' ? 1 : -1;
              const newFollowersCount = Math.max(0, c.followersCount + change);
              return { 
                  ...c, 
                  followersCount: newFollowersCount,
                  followers: action === 'follow' 
                      ? [...(c.followers || []), 'temp'] // Temporary, will be updated by backend
                      : (c.followers || []).slice(0, -1) // Remove last (optimistic)
              };
          }
          return c;
      }));

      try {
          // Parallel API calls
          await Promise.all(
              selectedIds.map(id => 
                  action === 'follow' 
                      ? storageService.followCollection(id)
                      : storageService.unfollowCollection(id)
              )
          );
          
          // PHASE 5: Reload collections to get accurate state from backend
          // Preserve current page when reloading
          await loadCollections();
          
          toast.success(`${action === 'follow' ? 'Followed' : 'Unfollowed'} ${selectedIds.length} collections`);
          setSelectionMode(false);
          setSelectedIds([]);
          setIsActionMenuOpen(false);
      } catch (error: any) {
          // PHASE 5: Rollback on error with proper error message
          setCollections(previousCollections);
          const errorMessage = error?.requestId 
            ? `Failed to ${action} collections (Request ID: ${error.requestId})`
            : `Failed to ${action} collections`;
          toast.error(errorMessage);
      }
  };

  const handleCollectionUpdate = (updatedCollection: Collection) => {
      setCollections(prev => prev.map(c => 
          c.id === updatedCollection.id ? updatedCollection : c
      ));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
        <HeaderSpacer />
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CollectionsSkeletonState />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <HeaderSpacer />
      <div
        className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR} border-b border-slate-200/80 bg-slate-50/90 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75 transition-colors dark:border-slate-800 dark:bg-slate-950/85`}
        style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <WorkspaceTopSection
            header={
              <CollectionsHeader
                totalCount={totalCount}
                visibleCount={processedCollections.length}
                breadcrumb={breadcrumb}
                actions={
                  !selectionMode && isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setShowInstruction(true)}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[13px] font-semibold text-white transition-all hover:bg-slate-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:w-auto dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      <Plus size={15} />
                      Create Collection
                    </button>
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
                toggleSortDirection={() =>
                  setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))
                }
                viewMode={viewMode}
                setViewMode={setViewMode}
                selectionMode={selectionMode}
                selectedCount={selectedIds.length}
                canSelect={collections.length > 0}
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
                mobileFilterCount={(selectedParentId ? 1 : 0) + (selectedChildId ? 1 : 0)}
              />
            }
            footer={
              appliedFilters.length > 0 ? (
                <AppliedFiltersBar
                  filters={appliedFilters}
                  onClearAll={() => {
                    setSearchInputValue('');
                    setSearchQuery('');
                    setSelectedParentId(null);
                    setSelectedChildId(null);
                  }}
                />
              ) : undefined
            }
          />
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-5">
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <TaxonomySidebar
            groups={taxonomyGroups}
            selectedParentId={selectedParentId}
            selectedChildId={selectedChildId}
            onSelectParent={setSelectedParentId}
            onSelectChild={setSelectedChildId}
            isMobileOpen={isMobileFiltersOpen}
            onCloseMobile={() => setIsMobileFiltersOpen(false)}
            resultCount={processedCollections.length}
            onClearAll={() => {
              setSelectedParentId(null);
              setSelectedChildId(null);
            }}
          />

          <section>
            {processedCollections.length === 0 ? (
              <EmptyState
                icon={<Folder />}
                title="No matching collections"
                description={
                  appliedFilters.length > 0
                    ? 'Try removing one or more filters, or broaden your search.'
                    : 'No collections available yet. Create the first collection to get started.'
                }
              />
            ) : effectiveViewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                {processedCollections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    onClick={() =>
                      selectionMode
                        ? handleSelect(collection.id)
                        : navigate(`/collections/${collection.id}`)
                    }
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
                onClick={(id) => navigate(`/collections/${id}`)}
              />
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
    </div>
  );
};
