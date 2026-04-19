import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { InfiniteData } from '@tanstack/react-query';
import { Article, Collection } from '@/types';
import { storageService } from '@/services/storageService';
import { Loader2, X, Trash2, Lock, Globe, FolderPlus, ChevronDown, Plus } from 'lucide-react';
import { ArticleModal } from '@/components/ArticleModal';
import { AddToCollectionModal } from '@/components/AddToCollectionModal';
import { useToast } from '@/hooks/useToast';
import { ConfirmActionModal } from '@/components/settings/ConfirmActionModal';
import { queryClient } from '@/queryClient';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { useAuth } from '@/hooks/useAuth';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { PaginatedArticlesResponse } from '@/services/adapters/IAdapter';
import { apiClient } from '@/services/apiClient';
import { DropdownPortal } from '@/components/UI/DropdownPortal';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { ContentTabs, type ContentTabItem } from '@/components/workspace/ContentTabs';
import { Z_INDEX } from '@/constants/zIndex';
import { CreateNuggetModal } from '@/components/CreateNuggetModal';
import {
  ContentToolbar,
  type CollectionContentSort,
  type ContentSort,
  type LibraryViewMode,
} from '@/components/workspace/ContentToolbar';
import { NuggetGridCard } from '@/components/workspace/NuggetGridCard';
import { NuggetListRow } from '@/components/workspace/NuggetListRow';
import { CollectionWorkspaceCard } from '@/components/workspace/CollectionWorkspaceCard';
import {
  getWorkspaceDisplayName,
  type ProfilePageUser,
} from '@/components/workspace/workspaceUserDisplay';
import { WorkspaceTopSection } from '@/components/workspace/WorkspaceTopSection';
import { useTagTaxonomy } from '@/hooks/useTagTaxonomy';

interface MySpacePageProps {
  currentUserId: string;
}

function patchMyspacePages(
  oldData: InfiniteData<PaginatedArticlesResponse> | undefined,
  nuggetsToUpdate: Article[],
  visibility: 'public' | 'private'
): InfiniteData<PaginatedArticlesResponse> | undefined {
  if (!oldData?.pages) return oldData;
  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      data: page.data.map((a: Article) =>
        nuggetsToUpdate.some((n) => n.id === a.id) ? { ...a, visibility } : a
      ),
    })),
  };
}

// Infinite Scroll Trigger Component for container-based scrolling
// Modified from Feed.tsx to support custom scroll container root
const InfiniteScrollTrigger: React.FC<{
  onIntersect: () => void;
  isLoading: boolean;
  hasMore: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}> = ({ onIntersect, isLoading, hasMore, scrollContainerRef }) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onIntersect);
  
  useEffect(() => {
    callbackRef.current = onIntersect;
  }, [onIntersect]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          callbackRef.current();
        }
      },
      {
        root: scrollContainerRef?.current ?? null,
        rootMargin: '300px',
        threshold: 0,
      }
    );

    const currentTrigger = triggerRef.current;
    if (currentTrigger) {
      observer.observe(currentTrigger);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, scrollContainerRef]);

  if (!hasMore) return null;

  return (
    <div ref={triggerRef} className="flex justify-center py-6">
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-medium">Loading more...</span>
        </div>
      )}
    </div>
  );
};

export const MySpacePage: React.FC<MySpacePageProps> = ({ currentUserId }) => {
  const { isAdmin } = useAuth();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  
  type MainTab = 'library' | 'drafts' | 'collections';
  const [activeTab, setActiveTab] = useState<MainTab>('library');

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const wasEditingRef = useRef(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddToCollection, setShowAddToCollection] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const mySpaceActionsAnchorRef = useRef<HTMLButtonElement>(null);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const requestCountersRef = useRef({
    profile: 0,
    collections: 0,
    counts: 0,
    articles: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<ContentSort>('published-desc');
  const [collectionSort, setCollectionSort] = useState<CollectionContentSort>('updated-desc');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | '7d' | '30d'>('all');
  const [recentUpdatesMode, setRecentUpdatesMode] = useState(false);
  const [contentView, setContentView] = useState<LibraryViewMode>('grid');
  const { data: taxonomy } = useTagTaxonomy();

  const targetUserId = userId || currentUserId;
  const isOwner = currentUserId === targetUserId;
  const nuggetListVisibility: 'public' | 'private' = activeTab === 'drafts' ? 'private' : 'public';
  const showNuggets = activeTab === 'library' || activeTab === 'drafts';
  const myspaceArticlesBaseKey = useMemo(
    () => ['articles', 'myspace', targetUserId] as const,
    [targetUserId]
  );
  const myspaceArticlesKey = useMemo(
    () => [...myspaceArticlesBaseKey, nuggetListVisibility] as const,
    [myspaceArticlesBaseKey, nuggetListVisibility]
  );
  const myspaceCollectionsKey = useMemo(
    () =>
      [
        'collections',
        'myspace',
        targetUserId,
        'scope:public',
        'summary:true',
        'includeEntries:false',
        'page:1',
        'limit:100',
      ] as const,
    [targetUserId]
  );
  const myspaceCountsKey = useMemo(
    () => ['articles', 'myspace', 'counts', targetUserId] as const,
    [targetUserId]
  );

  const getVisibility = (article: Article): 'public' | 'private' => {
    return article.visibility ?? 'public';
  };

  useEffect(() => {
    if (!isOwner && activeTab === 'drafts') {
      setActiveTab('library');
    }
  }, [isOwner, activeTab]);

  useEffect(() => {
    if (recentUpdatesMode) {
      setSort('updated-desc');
    }
  }, [recentUpdatesMode]);

  const profileUserQuery = useQuery({
    queryKey: ['user', 'profile', targetUserId],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        requestCountersRef.current.profile += 1;
        console.debug('[MySpace] profile query', {
          userId: targetUserId,
          count: requestCountersRef.current.profile,
        });
      }
      const user = await storageService.getUserById(targetUserId);
      return user ?? null;
    },
    staleTime: 1000 * 60,
  });

  const collectionsQuery = useQuery<Collection[]>({
    queryKey: myspaceCollectionsKey,
    queryFn: async () => {
      if (import.meta.env.DEV) {
        requestCountersRef.current.collections += 1;
        console.debug('[MySpace] collections query', {
          userId: targetUserId,
          count: requestCountersRef.current.collections,
        });
      }
      const result = await storageService.getCollections({
        type: 'public',
        creatorId: targetUserId,
        includeEntries: false,
        summary: true,
        page: 1,
        limit: 100,
      });
      return Array.isArray(result) ? result : result.data;
    },
    staleTime: 1000 * 30,
  });

  const articleCountsQuery = useQuery({
    queryKey: myspaceCountsKey,
    queryFn: () => {
      if (import.meta.env.DEV) {
        requestCountersRef.current.counts += 1;
        console.debug('[MySpace] owner counts query', {
          userId: targetUserId,
          count: requestCountersRef.current.counts,
        });
      }
      return storageService.getMyArticleCounts();
    },
    enabled: isOwner,
    staleTime: 1000 * 20,
  });

  const infiniteArticlesQuery = useInfiniteQuery<PaginatedArticlesResponse>({
    queryKey: myspaceArticlesKey,
    queryFn: async ({ pageParam = 1 }) => {
      if (import.meta.env.DEV) {
        requestCountersRef.current.articles += 1;
        console.debug('[MySpace] articles page query', {
          userId: targetUserId,
          visibility: nuggetListVisibility,
          page: pageParam,
          count: requestCountersRef.current.articles,
        });
      }
      const queryParams = new URLSearchParams();
      queryParams.set('authorId', targetUserId);
      queryParams.set('visibility', nuggetListVisibility);
      queryParams.set('page', (pageParam as number).toString());
      queryParams.set('limit', '25');

      return apiClient.get<PaginatedArticlesResponse>(`/articles?${queryParams}`);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 30,
    enabled: showNuggets,
  });

  const infiniteArticles = useMemo(() => {
    if (!infiniteArticlesQuery.data?.pages) {
      return [];
    }

    return infiniteArticlesQuery.data.pages.flatMap((page) => page.data);
  }, [infiniteArticlesQuery.data]);

  // Infinite scroll handler (same pattern as Feed.tsx)
  const handleLoadMore = useCallback(() => {
    if (!infiniteArticlesQuery.isFetchingNextPage && infiniteArticlesQuery.hasNextPage) {
      infiniteArticlesQuery.fetchNextPage();
    }
  }, [infiniteArticlesQuery]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds([]);
    setIsActionMenuOpen(false);
  }, [activeTab, nuggetListVisibility]);

  // Ensure list reflects edits after closing edit modal.
  useEffect(() => {
    if (editingArticle) {
      wasEditingRef.current = true;
      return;
    }
    if (!editingArticle && wasEditingRef.current) {
      wasEditingRef.current = false;
      void queryClient.invalidateQueries({ queryKey: myspaceArticlesBaseKey, exact: false });
      if (isOwner) {
        void queryClient.invalidateQueries({ queryKey: myspaceCountsKey, exact: true });
      }
    }
  }, [editingArticle, isOwner, myspaceArticlesBaseKey, myspaceCountsKey]);

  const profileUser = profileUserQuery.data as ProfilePageUser | null;
  const publicCollections = collectionsQuery.data ?? [];
  const ownerCounts = articleCountsQuery.data;
  const visitorPublicCount = infiniteArticlesQuery.data?.pages?.[0]?.total ?? 0;

  const withinDatePreset = (iso: string, preset: 'all' | '7d' | '30d'): boolean => {
    if (preset === 'all') return true;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const ms = preset === '7d' ? 7 * 86400000 : 30 * 86400000;
    return Date.now() - d.getTime() <= ms;
  };

  const sourceTypeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of infiniteArticles) {
      const t = a.source_type?.trim();
      if (t) s.add(t);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [infiniteArticles]);

  const tagOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of infiniteArticles) {
      for (const t of a.tags ?? []) {
        const x = t.trim();
        if (x) s.add(x);
      }
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [infiniteArticles]);

  const filteredNuggets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...infiniteArticles];
    if (q) {
      list = list.filter((a) => {
        const blob = `${a.title ?? ''} ${a.excerpt ?? ''} ${(a.tags ?? []).join(' ')}`.toLowerCase();
        return blob.includes(q);
      });
    }
    if (sourceTypeFilter) {
      list = list.filter((a) => (a.source_type ?? '').trim() === sourceTypeFilter);
    }
    if (tagFilter) {
      list = list.filter((a) => (a.tags ?? []).some((t) => t === tagFilter));
    }
    if (datePreset !== 'all') {
      list = list.filter((a) => withinDatePreset(a.publishedAt, datePreset));
    }
    const dir = sort.endsWith('desc') ? -1 : 1;
    const usePublished = sort.startsWith('published');
    list.sort((a, b) => {
      const ta = usePublished
        ? new Date(a.publishedAt).getTime()
        : new Date(a.updated_at || a.created_at || a.publishedAt).getTime();
      const tb = usePublished
        ? new Date(b.publishedAt).getTime()
        : new Date(b.updated_at || b.created_at || b.publishedAt).getTime();
      if (ta !== tb) return (ta - tb) * dir;
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [infiniteArticles, searchQuery, sourceTypeFilter, tagFilter, datePreset, sort]);

  const filteredCollections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...publicCollections];
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (collectionSort === 'name-asc') return a.name.localeCompare(b.name);
      if (collectionSort === 'name-desc') return b.name.localeCompare(a.name);
      const ta = new Date(a.updatedAt || a.createdAt).getTime();
      const tb = new Date(b.updatedAt || b.createdAt).getTime();
      if (collectionSort === 'updated-desc') return tb - ta;
      return ta - tb;
    });
    return list;
  }, [publicCollections, searchQuery, collectionSort]);

  const contentTabs: ContentTabItem[] = useMemo(() => {
    const loadedPublic = infiniteArticles.filter((a) => getVisibility(a) === 'public').length;
    const loadedPrivate = infiniteArticles.filter((a) => getVisibility(a) === 'private').length;
    const ownerPublic = ownerCounts?.public ?? loadedPublic;
    const ownerPrivate = ownerCounts?.private ?? loadedPrivate;
    const tabs: ContentTabItem[] = [
      {
        id: 'library',
        label: 'Published',
        count: isOwner ? ownerPublic : visitorPublicCount,
      },
    ];
    if (isOwner) {
      tabs.push({
        id: 'drafts',
        label: 'Drafts',
        count: ownerPrivate,
      });
    }
    tabs.push({
      id: 'collections',
      label: 'Collections',
      count: publicCollections.length,
    });
    return tabs;
  }, [isOwner, ownerCounts?.public, ownerCounts?.private, visitorPublicCount, publicCollections.length, infiniteArticles]);

  const publishedCount = isOwner
    ? (ownerCounts?.public ?? infiniteArticles.filter((a) => getVisibility(a) === 'public').length)
    : visitorPublicCount;
  const draftsCount = isOwner
    ? (ownerCounts?.private ?? infiniteArticles.filter((a) => getVisibility(a) === 'private').length)
    : 0;
  // "Total" mirrors the connected set shown in the header row:
  // Published + Drafts (+ Collections for this workspace).
  const totalWorkspaceItems = publishedCount + draftsCount + publicCollections.length;

  const currentList: Article[] | Collection[] =
    activeTab === 'collections' ? filteredCollections : filteredNuggets;

  const taxonomyForTagPicker = useMemo(
    () => ({
      formats: (taxonomy?.formats || []).map((t) => t.rawName),
      domains: (taxonomy?.domains || []).map((t) => t.rawName),
      subtopics: (taxonomy?.subtopics || []).map((t) => t.rawName),
    }),
    [taxonomy],
  );

  const toggleSelectionMode = () => {
      const newMode = !selectionMode;
      setSelectionMode(newMode);
      if (!newMode) setSelectedIds([]);
  };

  const handleSelect = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
      if (selectedIds.length === 0) return;
      
      if (activeTab === 'collections') {
          for (const id of selectedIds) {
              await storageService.deleteCollection(id);
          }
          toast.success(`Deleted ${selectedIds.length} collection${selectedIds.length > 1 ? 's' : ''}`);
      } else {
          // Delete articles (both public and private nuggets)
          for (const id of selectedIds) {
              await storageService.deleteArticle(id);
          }
          toast.success(`Deleted ${selectedIds.length} nugget${selectedIds.length > 1 ? 's' : ''}`);
      }
      
      setShowDeleteConfirm(false);
      setSelectionMode(false);
      setSelectedIds([]);
      await queryClient.invalidateQueries({ queryKey: myspaceCollectionsKey, exact: true });
      await queryClient.invalidateQueries({ queryKey: myspaceArticlesBaseKey, exact: false });
      if (isOwner) {
        await queryClient.invalidateQueries({ queryKey: myspaceCountsKey, exact: true });
      }
  };

  const handleBulkVisibility = async (visibility: 'public' | 'private') => {
      if (!showNuggets || selectedIds.length === 0) return;

      setIsUpdatingVisibility(true);

      const currentListForUpdate = infiniteArticles;

      const nuggetsToUpdate = currentListForUpdate.filter(
          (item: Article) => selectedIds.includes(item.id) && getVisibility(item) !== visibility
      );

      if (nuggetsToUpdate.length === 0) {
          toast.info(`All selected nuggets are already ${visibility}`);
          setIsUpdatingVisibility(false);
          setSelectionMode(false);
          setSelectedIds([]);
          return;
      }

      const previousArticles = [...infiniteArticles];
      const failedIds: string[] = [];

      queryClient.setQueryData<InfiniteData<PaginatedArticlesResponse>>(myspaceArticlesKey, (oldData) =>
        patchMyspacePages(oldData, nuggetsToUpdate, visibility)
      );
      
      try {
          // Parallel PATCH calls
          const updatePromises = nuggetsToUpdate.map(async (nugget: Article) => {
              try {
                  const updated = await storageService.updateArticle(nugget.id, { visibility });
                  if (!updated) {
                      throw new Error('Update failed');
                  }
                  return { id: nugget.id, success: true, article: updated };
              } catch (error: unknown) {
                  failedIds.push(nugget.id);
                  return { id: nugget.id, success: false, error };
              }
          });
          
          const results = await Promise.all(updatePromises);
          const successCount = results.filter(r => r.success).length;
          const failureCount = results.filter(r => !r.success).length;
          
          if (failureCount > 0) {
              queryClient.setQueryData<InfiniteData<PaginatedArticlesResponse>>(myspaceArticlesKey, (oldData) => {
                if (!oldData?.pages) return oldData;
                return {
                  ...oldData,
                  pages: oldData.pages.map((page) => ({
                    ...page,
                    data: page.data.map((a: Article) => {
                      if (failedIds.includes(a.id)) {
                        const original = previousArticles.find((pa) => pa.id === a.id);
                        return original || a;
                      }
                      return a;
                    }),
                  })),
                };
              });
              
              if (successCount > 0) {
                  toast.warning(`Updated ${successCount} nugget${successCount > 1 ? 's' : ''}, ${failureCount} failed`);
              } else {
                  toast.error(`Failed to update ${failureCount} nugget${failureCount > 1 ? 's' : ''}`);
              }
          } else {
              // All succeeded - invalidate query to refetch with updated visibility
              await queryClient.invalidateQueries({ queryKey: myspaceArticlesBaseKey, exact: false });
              if (isOwner) {
                await queryClient.invalidateQueries({ queryKey: myspaceCountsKey, exact: true });
              }
              
              toast.success(`Updated ${successCount} nugget${successCount > 1 ? 's' : ''} to ${visibility}`);
          }
          
          setSelectionMode(false);
          setSelectedIds([]);
          setIsActionMenuOpen(false);
      } catch {
          queryClient.setQueryData<InfiniteData<PaginatedArticlesResponse>>(myspaceArticlesKey, (oldData) => {
            if (!oldData?.pages) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                data: page.data.map((a: Article) => {
                  const original = previousArticles.find((pa) => pa.id === a.id);
                  return original || a;
                }),
              })),
            };
          });

          toast.error('Failed to update visibility. Please try again.');
      } finally {
          setIsUpdatingVisibility(false);
      }
  };

  const handleBulkFollow = async (action: 'follow' | 'unfollow') => {
      if (selectedIds.length === 0 || activeTab !== 'collections') return;
      
      // Store previous state for rollback
      const previousCollections = [...publicCollections];
      
      // Optimistic update
      queryClient.setQueryData<Collection[]>(myspaceCollectionsKey, (prev = []) =>
        prev.map((c) => {
          if (!selectedIds.includes(c.id)) return c;
          const change = action === 'follow' ? 1 : -1;
          return {
            ...c,
            followersCount: Math.max(0, c.followersCount + change),
          };
        })
      );

      try {
          // Parallel API calls
          await Promise.all(
              selectedIds.map(id => 
                  action === 'follow' 
                      ? storageService.followCollection(id)
                      : storageService.unfollowCollection(id)
              )
          );
          
          await queryClient.invalidateQueries({ queryKey: myspaceCollectionsKey, exact: true });
          
          toast.success(`${action === 'follow' ? 'Followed' : 'Unfollowed'} ${selectedIds.length} collections`);
          setSelectionMode(false);
          setSelectedIds([]);
          setIsActionMenuOpen(false);
      } catch {
          queryClient.setQueryData<Collection[]>(myspaceCollectionsKey, previousCollections);
          toast.error(`Failed to ${action} collections`);
      }
  };

  const handleCollectionUpdate = (updatedCollection: Collection) => {
      queryClient.setQueryData<Collection[]>(myspaceCollectionsKey, (prev = []) =>
        prev.map((c) => (c.id === updatedCollection.id ? updatedCollection : c))
      );
  };

  const handleDeleteSingleArticle = async (article: Article) => {
    const ok = window.confirm(`Delete "${article.title || 'this nugget'}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await storageService.deleteArticle(article.id);
      await queryClient.invalidateQueries({ queryKey: myspaceArticlesBaseKey, exact: false });
      if (isOwner) {
        await queryClient.invalidateQueries({ queryKey: myspaceCountsKey, exact: true });
      }
      toast.success('Nugget deleted');
    } catch {
      toast.error('Failed to delete nugget');
    }
  };

  // Early returns for loading and error states
  const isPageLoading =
    profileUserQuery.isLoading ||
    collectionsQuery.isLoading ||
    (showNuggets && infiniteArticlesQuery.isLoading);

  if (isPageLoading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
        <HeaderSpacer />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="animate-spin text-slate-400" />
        </div>
      </div>
    );
  }
  
  if (!profileUser) {
    return (
      <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
        <HeaderSpacer />
        <div className="p-12 text-center text-slate-500">User not found</div>
      </div>
    );
  }

  const pageTagline = isOwner
    ? 'Browse, filter, and manage published work, drafts, and collections.'
    : `Published work and collections from ${getWorkspaceDisplayName(profileUser)}.`;

  const nuggetsInitialLoading =
    showNuggets && infiniteArticlesQuery.isLoading && infiniteArticles.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <HeaderSpacer />
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 gap-x-6">
          <section className="col-span-12" aria-labelledby="library-main-heading">
            <h2 id="library-main-heading" className="sr-only">
              Workspace content
            </h2>

            <div className="sticky top-14 lg:top-16" style={{ zIndex: Z_INDEX.STICKY_SUBHEADER }}>
              <WorkspaceTopSection
                header={
                  <div className="flex flex-col gap-2.5">
                    <WorkspaceHeader
                      title="Workspace"
                      tagline={pageTagline}
                      isOwner={isOwner}
                      selectionMode={selectionMode}
                      onToggleSelect={toggleSelectionMode}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className={`flex flex-wrap items-center gap-2 ${selectionMode ? 'pointer-events-none opacity-50' : ''}`}>
                        <span className="inline-flex min-h-[40px] min-w-[44px] items-center rounded-md border border-slate-200/70 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                          <span className="whitespace-nowrap">Total</span>
                          <span className="ml-1.5 tabular-nums text-xs font-normal text-slate-500 dark:text-slate-400">
                            {totalWorkspaceItems.toLocaleString()}
                          </span>
                        </span>
                        <ContentTabs
                          tabs={contentTabs}
                          activeId={activeTab}
                          onChange={(id) => setActiveTab(id as MainTab)}
                          ariaLabel="Workspace sections"
                        />
                      </div>
                      {isOwner && currentList.length > 0 && selectionMode && (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950/60">
                          <span className="px-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            {selectedIds.length} selected
                          </span>
                          <div className="relative inline-flex">
                            <button
                              ref={mySpaceActionsAnchorRef}
                              type="button"
                              onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                              disabled={selectedIds.length === 0 || isUpdatingVisibility}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                              aria-expanded={isActionMenuOpen}
                              aria-haspopup="menu"
                            >
                              {isUpdatingVisibility ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" /> Updating…
                                </>
                              ) : (
                                <>
                                  Actions <ChevronDown size={14} />
                                </>
                              )}
                            </button>
                            <DropdownPortal
                              isOpen={isActionMenuOpen}
                              anchorRef={mySpaceActionsAnchorRef}
                              align="right"
                              host="dropdown"
                              offsetY={4}
                              onClickOutside={() => setIsActionMenuOpen(false)}
                              className="w-52 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
                            >
                              <div role="menu">
                                {showNuggets && (
                                  <>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        void handleBulkVisibility('public');
                                        setIsActionMenuOpen(false);
                                      }}
                                      disabled={isUpdatingVisibility}
                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                      <Globe size={14} /> Make public
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        void handleBulkVisibility('private');
                                        setIsActionMenuOpen(false);
                                      }}
                                      disabled={isUpdatingVisibility}
                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                      <Lock size={14} /> Make draft
                                    </button>
                                    {isAdmin && (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                          setShowAddToCollection(true);
                                          setIsActionMenuOpen(false);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                      >
                                        <FolderPlus size={14} /> Add to collection
                                      </button>
                                    )}
                                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                                  </>
                                )}
                                {activeTab === 'collections' && (
                                  <>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        void handleBulkFollow('follow');
                                        setIsActionMenuOpen(false);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                      <Plus size={14} /> Follow
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        void handleBulkFollow('unfollow');
                                        setIsActionMenuOpen(false);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                      <X size={14} /> Unfollow
                                    </button>
                                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                                  </>
                                )}
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setShowDeleteConfirm(true);
                                    setIsActionMenuOpen(false);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <Trash2 size={14} /> Delete…
                                </button>
                              </div>
                            </DropdownPortal>
                          </div>
                          <button
                            type="button"
                            onClick={toggleSelectionMode}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            title="Exit selection"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                }
                toolbar={
                  <div className={`pt-0.5 ${selectionMode ? 'pointer-events-none opacity-50' : ''}`}>
                    <ContentToolbar
                      mode={activeTab === 'collections' ? 'collections' : 'nuggets'}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      sort={sort}
                      onSortChange={setSort}
                      collectionSort={collectionSort}
                      onCollectionSortChange={setCollectionSort}
                      sourceTypeFilter={sourceTypeFilter}
                      onSourceTypeChange={setSourceTypeFilter}
                      sourceTypeOptions={[]}
                      tagFilter={tagFilter}
                      onTagChange={setTagFilter}
                      tagOptions={tagOptions}
                      tagTaxonomy={taxonomyForTagPicker}
                      enableGroupedTagPicker
                      datePreset={datePreset}
                      onDatePresetChange={setDatePreset}
                      recentUpdatesMode={recentUpdatesMode}
                      onRecentUpdatesModeChange={setRecentUpdatesMode}
                      showRecentToggle={false}
                      libraryView={contentView}
                      onLibraryViewChange={setContentView}
                      showLibraryViewToggle={showNuggets}
                      disabled={selectionMode || (activeTab !== 'collections' && !showNuggets)}
                    />
                  </div>
                }
              />
            </div>

              <div
                id={`library-panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`library-tab-${activeTab}`}
                className="mt-4"
              >
                {activeTab === 'collections' ? (
                  <>
                    {filteredCollections.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {publicCollections.length === 0
                            ? 'No community collections yet. Curate a public list from the collections hub when you are ready.'
                            : 'No collections match your search.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {filteredCollections.map((col) => (
                          <CollectionWorkspaceCard
                            key={col.id}
                            collection={col}
                            onOpen={() => navigate(`/collections/${col.id}`)}
                            selectionMode={selectionMode}
                            isSelected={selectedIds.includes(col.id)}
                            onSelect={handleSelect}
                            onCollectionUpdate={handleCollectionUpdate}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : nuggetsInitialLoading ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={`sk-${i}`}
                        className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
                      >
                        <div className="aspect-[16/10] animate-pulse bg-slate-200 dark:bg-slate-800" />
                        <div className="space-y-2 p-4">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                          <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800/80" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredNuggets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {infiniteArticles.length === 0
                        ? activeTab === 'drafts'
                          ? 'No drafts yet. Save private work here until it is ready to publish.'
                          : 'Nothing published yet. When you ship a nugget, it will appear here.'
                        : 'No nuggets match your filters. Try clearing search or widening the date range.'}
                    </p>
                  </div>
                ) : contentView === 'grid' ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredNuggets.map((item) => (
                      <NuggetGridCard
                        key={item.id}
                        article={item}
                        selectionMode={selectionMode}
                        isSelected={selectedIds.includes(item.id)}
                        onSelect={handleSelect}
                        onOpen={setSelectedArticle}
                      />
                    ))}
                    <div className="col-span-full">
                      <InfiniteScrollTrigger
                        onIntersect={handleLoadMore}
                        isLoading={infiniteArticlesQuery.isFetchingNextPage}
                        hasMore={infiniteArticlesQuery.hasNextPage ?? false}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {filteredNuggets.map((item) => (
                      <NuggetListRow
                        key={item.id}
                        article={item}
                        selectionMode={selectionMode}
                        isSelected={selectedIds.includes(item.id)}
                        onSelect={handleSelect}
                        onOpen={setSelectedArticle}
                        compact={contentView === 'compact'}
                        canManage={isOwner}
                        onEdit={(article) => setEditingArticle(article)}
                        onDelete={handleDeleteSingleArticle}
                      />
                    ))}
                    <InfiniteScrollTrigger
                      onIntersect={handleLoadMore}
                      isLoading={infiniteArticlesQuery.isFetchingNextPage}
                      hasMore={infiniteArticlesQuery.hasNextPage ?? false}
                    />
                  </div>
                )}
              </div>
            </section>
        </div>
      </main>

      {selectedArticle && (
        <ArticleModal
          isOpen={!!selectedArticle}
          onClose={() => setSelectedArticle(null)}
          article={selectedArticle}
        />
      )}

      <CreateNuggetModal
        isOpen={!!editingArticle}
        onClose={() => setEditingArticle(null)}
        mode="edit"
        initialData={editingArticle ?? undefined}
      />

      <ConfirmActionModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={activeTab === 'collections' ? "Delete Collections?" : "Delete Nuggets?"}
        description={`Are you sure you want to delete ${selectedIds.length} ${activeTab === 'collections' ? 'collection' : 'nugget'}${selectedIds.length > 1 ? 's' : ''}? This cannot be undone.`}
        actionLabel="Delete"
        isDestructive
      />

      {isAdmin && (
        <AddToCollectionModal
          isOpen={showAddToCollection}
          onClose={() => {
            setShowAddToCollection(false);
          }}
          articleIds={selectedIds}
        />
      )}
    </div>
  );
};
