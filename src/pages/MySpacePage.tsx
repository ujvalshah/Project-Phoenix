import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Article, Collection } from '@/types';
import { storageService } from '@/services/storageService';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { TabsBar } from '@/components/profile/TabsBar';
import { NewsCard } from '@/components/NewsCard';
import { CollectionsGrid } from '@/components/profile/CollectionsGrid';
import { Loader2, Layers, CheckSquare, X, Trash2, Lock, Globe, FolderPlus, ChevronDown, Info, Plus } from 'lucide-react';
import { ArticleModal } from '@/components/ArticleModal';
import { AddToCollectionModal } from '@/components/AddToCollectionModal';
import { useToast } from '@/hooks/useToast';
import { ConfirmActionModal } from '@/components/settings/ConfirmActionModal';
import { Tooltip } from '@/components/UI/Tooltip';
import { queryClient } from '@/queryClient';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PaginatedArticlesResponse } from '@/services/adapters/IAdapter';
import { apiClient } from '@/services/apiClient';

interface MySpacePageProps {
  currentUserId: string;
}

// Dynamic descriptions based on state
const getDescription = (tab: string, visibility: 'public' | 'private') => {
  if (tab === 'collections') return "Thematic lists you have curated for the community.";
  if (tab === 'nuggets') {
      return visibility === 'public' 
        ? "Your nuggets that you've shared with the community."
        : "These are nuggets you have created that are not shared publicly.";
  }
  return "";
};

// Infinite Scroll Trigger Component for container-based scrolling
// Modified from Feed.tsx to support custom scroll container root
const InfiniteScrollTrigger: React.FC<{
  onIntersect: () => void;
  isLoading: boolean;
  hasMore: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
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
        root: scrollContainerRef.current, // Use container as root instead of viewport
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
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  
  // Data State
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  // Counts state - independent from articles array to support pagination
  const [articleCounts, setArticleCounts] = useState<{ total: number; public: number; private: number } | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState('nuggets');
  
  // Sub-Navigation State (Hierarchy)
  const [nuggetVisibility, setNuggetVisibility] = useState<'public' | 'private'>('public');

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddToCollection, setShowAddToCollection] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  
  // Context
  const targetUserId = userId || currentUserId;
  const isOwner = currentUserId === targetUserId;

  // Normalize visibility: treat missing visibility as 'private'
  const getVisibility = (article: Article): 'public' | 'private' => {
    return article.visibility ?? 'private';
  };

  // Ref for the scrollable nuggets container
  const nuggetsScrollContainerRef = useRef<HTMLDivElement>(null);

  // Local infinite scroll hook for author-filtered articles (same pattern as useInfiniteArticles)
  // Uses the existing API endpoint with authorId parameter
  const infiniteArticlesQuery = useInfiniteQuery<PaginatedArticlesResponse>({
    queryKey: ['articles', 'myspace', targetUserId, nuggetVisibility],
    queryFn: async ({ pageParam = 1 }) => {
      const queryParams = new URLSearchParams();
      queryParams.set('authorId', targetUserId);
      queryParams.set('page', (pageParam as number).toString());
      queryParams.set('limit', '25');
      
      return apiClient.get<PaginatedArticlesResponse>(`/articles?${queryParams}`);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 30, // 30 seconds
    enabled: activeTab === 'nuggets', // Only fetch when nuggets tab is active
  });

  // Accumulate all pages and filter by visibility
  const infiniteArticles = useMemo(() => {
    if (!infiniteArticlesQuery.data?.pages) {
      return [];
    }
    
    const allArticles = infiniteArticlesQuery.data.pages.flatMap((page) => page.data);
    
    // Filter by visibility on client-side (backend returns all for owner)
    return allArticles.filter((a: Article) => getVisibility(a) === nuggetVisibility);
  }, [infiniteArticlesQuery.data, nuggetVisibility]);

  // Infinite scroll handler (same pattern as Feed.tsx)
  const handleLoadMore = useCallback(() => {
    if (!infiniteArticlesQuery.isFetchingNextPage && infiniteArticlesQuery.hasNextPage) {
      infiniteArticlesQuery.fetchNextPage();
    }
  }, [infiniteArticlesQuery]);

  useEffect(() => {
    const isMounted = { current: true };
    
    loadData(isMounted);
    
    // Cleanup on unmount
    return () => {
      isMounted.current = false;
    };
  }, [targetUserId]);


  // Clear selection when tab changes
  useEffect(() => {
      setSelectionMode(false);
      setSelectedIds([]);
      setIsActionMenuOpen(false);
  }, [activeTab, nuggetVisibility]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    if (isActionMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActionMenuOpen]);

  // Helper function to refresh counts independently
  const refreshCounts = async () => {
    if (!isOwner) return; // Only fetch counts for owner
    
    try {
      const counts = await storageService.getMyArticleCounts();
      setArticleCounts(counts);
    } catch (e: any) {
      console.error("Failed to refresh article counts", e);
      // On error, keep existing counts (don't reset to null)
    }
  };

  const loadData = async (isMounted: { current: boolean } = { current: true }) => {
    setLoading(true);
    
    try {
      // Fetch counts independently (only for owner)
      const fetchCounts = isOwner ? storageService.getMyArticleCounts().catch((e) => {
        console.error("Failed to fetch article counts", e);
        return null; // Return null on error, counts will be undefined
      }) : Promise.resolve(null);

      const [user, userArticles, allCollections, counts] = await Promise.all([
        storageService.getUserById(targetUserId),
        storageService.getArticlesByAuthor(targetUserId),
        storageService.getCollections(),
        fetchCounts
      ]);

      // Only update state if component is still mounted
      if (!isMounted.current) return;

      // Defensive checks: ensure arrays are always arrays
      const safeUserArticles = Array.isArray(userArticles) ? userArticles : [];
      const safeAllCollections = Array.isArray(allCollections) ? allCollections : [];

      setProfileUser(user || null);
      setArticles(safeUserArticles);
      setCollections(safeAllCollections.filter(c => c.creatorId === targetUserId));
      
      // Set counts if fetched successfully (only for owner)
      if (counts && isMounted.current) {
        setArticleCounts(counts);
      }
      

    } catch (e: any) {
      // Ignore cancellation errors - they're expected when component unmounts or new requests start
      if (e?.message === 'Request cancelled') {
        return;
      }
      console.error("Failed to load profile data", e);
      // On error, ensure arrays are set to empty arrays to prevent filter crashes
      if (isMounted.current) {
        setArticles([]);
        setCollections([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Defensive checks: ensure arrays before calling filter
  const safeCollections = Array.isArray(collections) ? collections : [];
  
  // SEGREGATION LOGIC
  const publicCollections = safeCollections.filter(c => c.type === 'public');

  // Hierarchy: Top Level Tabs - Updated per requirements
  // Use counts from API endpoint (independent of pagination) - always use server-provided counts
  const nuggetCount = isOwner 
    ? (articleCounts?.total ?? 0)
    : (articleCounts?.public ?? 0);
  
  const tabs: { id: string; label: string; count?: number }[] = [
    { 
        id: 'nuggets', 
        label: 'My Nuggets', 
        count: nuggetCount
    },
    { 
        id: 'collections', 
        label: 'Community Collections', 
        count: publicCollections.length 
    },
  ];

  const handleUpdateProfile = (updated: User) => setProfileUser(updated);

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
      loadData();
  };

  const handleBulkVisibility = async (visibility: 'public' | 'private') => {
      if (activeTab !== 'nuggets' || selectedIds.length === 0) return;
      
      setIsUpdatingVisibility(true);
      
      // Use infinite scroll data (already filtered by visibility)
      const currentListForUpdate = infiniteArticles;
      
      // Filter out nuggets already in target state
      const nuggetsToUpdate = currentListForUpdate.filter((item: Article) => 
          selectedIds.includes(item.id) && getVisibility(item) !== visibility
      );
      
      if (nuggetsToUpdate.length === 0) {
          toast.info(`All selected nuggets are already ${visibility}`);
          setIsUpdatingVisibility(false);
          setSelectionMode(false);
          setSelectedIds([]);
          return;
      }
      
      // Snapshot previous state for rollback
      const previousArticles = [...infiniteArticles];
      const failedIds: string[] = [];
      
      // Optimistic cache update for infinite query
      queryClient.setQueryData(['articles', 'myspace', targetUserId, nuggetVisibility], (oldData: any) => {
        if (!oldData?.pages) return oldData;
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: PaginatedArticlesResponse) => ({
            ...page,
            data: page.data.map((a: Article) => 
              nuggetsToUpdate.some(n => n.id === a.id) 
                ? { ...a, visibility }
                : a
            )
          }))
        };
      });
      
      try {
          // Parallel PATCH calls
          const updatePromises = nuggetsToUpdate.map(async (nugget: Article) => {
              try {
                  const updated = await storageService.updateArticle(nugget.id, { visibility });
                  if (!updated) {
                      throw new Error('Update failed');
                  }
                  return { id: nugget.id, success: true, article: updated };
              } catch (error: any) {
                  failedIds.push(nugget.id);
                  return { id: nugget.id, success: false, error };
              }
          });
          
          const results = await Promise.all(updatePromises);
          const successCount = results.filter(r => r.success).length;
          const failureCount = results.filter(r => !r.success).length;
          
          if (failureCount > 0) {
              // Rollback failed IDs in React Query cache
              queryClient.setQueryData(['articles', 'myspace', targetUserId, nuggetVisibility], (oldData: any) => {
                if (!oldData?.pages) return oldData;
                
                return {
                  ...oldData,
                  pages: oldData.pages.map((page: PaginatedArticlesResponse) => ({
                    ...page,
                    data: page.data.map((a: Article) => {
                      if (failedIds.includes(a.id)) {
                        const original = previousArticles.find(pa => pa.id === a.id);
                        return original || a;
                      }
                      return a;
                    })
                  }))
                };
              });
              
              if (successCount > 0) {
                  toast.warning(`Updated ${successCount} nugget${successCount > 1 ? 's' : ''}, ${failureCount} failed`);
              } else {
                  toast.error(`Failed to update ${failureCount} nugget${failureCount > 1 ? 's' : ''}`);
              }
          } else {
              // All succeeded - invalidate query to refetch with updated visibility
              await queryClient.invalidateQueries({ queryKey: ['articles', 'myspace', targetUserId] });
              
              // Refresh counts after visibility change
              await refreshCounts();
              
              toast.success(`Updated ${successCount} nugget${successCount > 1 ? 's' : ''} to ${visibility}`);
          }
          
          setSelectionMode(false);
          setSelectedIds([]);
          setIsActionMenuOpen(false);
      } catch (error: any) {
          // Full rollback on unexpected error - restore React Query cache
          queryClient.setQueryData(['articles', 'myspace', targetUserId, nuggetVisibility], (oldData: any) => {
            if (!oldData?.pages) return oldData;
            
            return {
              ...oldData,
              pages: oldData.pages.map((page: PaginatedArticlesResponse) => ({
                ...page,
                data: page.data.map((a: Article) => {
                  const original = previousArticles.find(pa => pa.id === a.id);
                  return original || a;
                })
              }))
            };
          });
          
          queryClient.setQueryData(['articles'], (oldData: any) => {
              if (!oldData) return oldData;
              
              if (oldData.data && Array.isArray(oldData.data)) {
                  return {
                      ...oldData,
                      data: oldData.data.map((a: Article) => {
                          const original = previousArticles.find(pa => pa.id === a.id);
                          return original || a;
                      })
                  };
              }
              
              if (Array.isArray(oldData)) {
                  return oldData.map((a: Article) => {
                      const original = previousArticles.find(pa => pa.id === a.id);
                      return original || a;
                  });
              }
              
              return oldData;
          });
          
          toast.error('Failed to update visibility. Please try again.');
      } finally {
          setIsUpdatingVisibility(false);
      }
  };

  const handleBulkFollow = async (action: 'follow' | 'unfollow') => {
      if (selectedIds.length === 0 || activeTab !== 'collections') return;
      
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
          
          // Reload data to get accurate state from backend
          await loadData();
          
          toast.success(`${action === 'follow' ? 'Followed' : 'Unfollowed'} ${selectedIds.length} collections`);
          setSelectionMode(false);
          setSelectedIds([]);
          setIsActionMenuOpen(false);
      } catch (error: any) {
          // Rollback on error
          setCollections(previousCollections);
          toast.error(`Failed to ${action} collections`);
      }
  };

  const handleCollectionUpdate = (updatedCollection: Collection) => {
      setCollections(prev => prev.map(c => 
          c.id === updatedCollection.id ? updatedCollection : c
      ));
  };

  // Early returns for loading and error states
  if (loading) {
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

  // --- HIERARCHY LOGIC ---
  // Determine what list to show based on Tab + Sub-Filter
  // For nuggets, use infinite scroll data; for collections, use regular array
  let currentList: any[] = [];
  
  if (activeTab === 'nuggets') {
      // Use infinite scroll data for nuggets
      currentList = infiniteArticles;
  } else if (activeTab === 'collections') {
      currentList = publicCollections;
  }

  // Determine current description
  const tabDescription = getDescription(activeTab, nuggetVisibility);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-gray-900 dark:text-white pb-32">
      <HeaderSpacer />
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        
        <div className="flex flex-col lg:flex-row items-start">
          
          {/* Left Column: Sidebar */}
          <div className="w-full lg:w-[270px] flex-shrink-0 mb-8 lg:mb-0">
            <ProfileCard 
                user={profileUser} 
                nuggetCount={isOwner ? (articleCounts?.public ?? 0) : 0} 
                isOwner={isOwner}
                onUpdate={handleUpdateProfile}
            />
          </div>

          {/* Right Column: Content */}
          <div className="flex-grow min-w-0 lg:ml-10 w-full relative">
            
            {/* Header / Toolbar Area */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-h-[44px]">
                    
                    {/* Tabs */}
                    <div className={`overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto transition-opacity duration-200 ${selectionMode ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        <TabsBar 
                            tabs={tabs} 
                            activeTab={activeTab} 
                            onTabChange={(t) => {
                                setActiveTab(t);
                                // Reset visibility filter to public when switching back to nuggets tab
                                if (t === 'nuggets') setNuggetVisibility('public');
                            }} 
                        />
                    </div>
                    
                    {/* Contextual Toolbar */}
                    {isOwner && currentList.length > 0 && (
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            
                            {selectionMode ? (
                                // --- SELECTION ACTIVE STATE ---
                                <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 animate-in slide-in-from-right-2 duration-200">
                                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400 ml-2">
                                        {selectedIds.length} Selected
                                    </span>

                                    {/* Dropdown Menu */}
                                    <div className="relative" ref={actionMenuRef}>
                                        <button 
                                            onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                                            disabled={selectedIds.length === 0 || isUpdatingVisibility}
                                            className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-gray-900 rounded-lg text-xs font-bold shadow-sm hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isUpdatingVisibility ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" /> Updating...
                                                </>
                                            ) : (
                                                <>
                                                    Actions <ChevronDown size={14} />
                                                </>
                                            )}
                                        </button>

                                        {isActionMenuOpen && (
                                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 overflow-hidden animate-in zoom-in-95 duration-100 origin-top-right">
                                                {activeTab === 'nuggets' && (
                                                    <>
                                                        <button 
                                                            onClick={() => { handleBulkVisibility('public'); setIsActionMenuOpen(false); }} 
                                                            disabled={isUpdatingVisibility}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <Globe size={14} className="text-blue-500" /> Make Public
                                                        </button>
                                                        <button 
                                                            onClick={() => { handleBulkVisibility('private'); setIsActionMenuOpen(false); }} 
                                                            disabled={isUpdatingVisibility}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <Lock size={14} className="text-amber-500" /> Make Private
                                                        </button>
                                                        <button onClick={() => { setShowAddToCollection(true); setIsActionMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                                            <FolderPlus size={14} className="text-indigo-500" /> Add to Collection
                                                        </button>
                                                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                    </>
                                                )}
                                                

                                                {activeTab === 'collections' && (
                                                    <>
                                                        <button onClick={() => { handleBulkFollow('follow'); setIsActionMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors">
                                                            <Plus size={14} /> Follow Selected
                                                        </button>
                                                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                        <button onClick={() => { handleBulkFollow('unfollow'); setIsActionMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                                                            <X size={14} /> Unfollow Selected
                                                        </button>
                                                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                                                    </>
                                                )}

                                                <button 
                                                    onClick={() => { setShowDeleteConfirm(true); setIsActionMenuOpen(false); }} 
                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                >
                                                    <Trash2 size={14} /> Delete Items
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={toggleSelectionMode}
                                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                                        title="Cancel Selection"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                // --- DEFAULT STATE ---
                                <>
                                    <Tooltip content="Import links or CSV files">
                                        <button 
                                            onClick={() => navigate('/bulk-create')}
                                            className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white rounded-xl text-xs font-bold transition-colors"
                                        >
                                            <Layers size={16} /> Batch Import
                                        </button>
                                    </Tooltip>
                                    
                                    <Tooltip content="Select multiple items to organize or delete">
                                        <button 
                                            onClick={toggleSelectionMode}
                                            className="flex items-center gap-2 px-3 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-900/30 rounded-xl text-xs font-bold transition-all shadow-sm"
                                        >
                                            <CheckSquare size={16} /> Select
                                        </button>
                                    </Tooltip>
                                </>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                        {/* Hierarchy Sub-Navigation (For Nuggets Tab Only) - MOVED TO LEFT */}
                        {activeTab === 'nuggets' && isOwner && (
                            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shrink-0">
                                <button
                                    onClick={() => setNuggetVisibility('public')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${nuggetVisibility === 'public' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                                >
                                    <Globe size={12} /> Public <span className="opacity-60 text-[10px]">{articleCounts?.public ?? 0}</span>
                                </button>
                                <button
                                    onClick={() => setNuggetVisibility('private')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${nuggetVisibility === 'private' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                                >
                                    <Lock size={12} /> Private <span className="opacity-60 text-[10px]">{articleCounts?.private ?? 0}</span>
                                </button>
                            </div>
                        )}

                        {/* Tab Description Helper */}
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 px-1 animate-in fade-in">
                            <Info size={12} className="shrink-0" />
                            {tabDescription}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
              {activeTab === 'collections' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="col-span-full">
                    <CollectionsGrid 
                      collections={currentList} 
                      onCollectionClick={(id) => selectionMode ? handleSelect(id) : navigate(`/collections/${id}`)}
                      selectionMode={selectionMode}
                      selectedIds={selectedIds}
                      onSelect={handleSelect}
                      onCollectionUpdate={handleCollectionUpdate}
                    />
                  </div>
                  {currentList.length === 0 && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-gray-400 text-sm">Nothing to see here yet.</p>
                    </div>
                  )}
                </div>
              ) : (
                // Scrollable container for nuggets grid with infinite scroll
                <div 
                  ref={nuggetsScrollContainerRef}
                  className="overflow-y-auto"
                  style={{ maxHeight: 'calc(100vh - 400px)' }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pr-2">
                    {currentList.map(item => (
                      <NewsCard 
                        key={item.id} 
                        article={item as Article}
                        viewMode="grid"
                        onTagClick={() => {}}
                        onCategoryClick={() => {}}
                        onClick={() => setSelectedArticle(item as Article)}
                        currentUserId={currentUserId}
                        selectionMode={selectionMode}
                        isSelected={selectedIds.includes(item.id)}
                        onSelect={handleSelect}
                      />
                    ))}
                    
                    {/* Infinite Scroll Trigger - inside container */}
                    {currentList.length > 0 && (
                      <div className="col-span-full">
                        <InfiniteScrollTrigger
                          onIntersect={handleLoadMore}
                          isLoading={infiniteArticlesQuery.isFetchingNextPage}
                          hasMore={infiniteArticlesQuery.hasNextPage ?? false}
                          scrollContainerRef={nuggetsScrollContainerRef}
                        />
                      </div>
                    )}
                  </div>

                  {currentList.length === 0 && !infiniteArticlesQuery.isLoading && (
                    <div className="py-16 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-gray-400 text-sm">Nothing to see here yet.</p>
                    </div>
                  )}
                </div>
              )}

          </div>
        </div>
      </div>

      {selectedArticle && (
        <ArticleModal
          isOpen={!!selectedArticle}
          onClose={() => setSelectedArticle(null)}
          article={selectedArticle}
        />
      )}

      <ConfirmActionModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={activeTab === 'collections' ? "Delete Collections?" : "Delete Nuggets?"}
        description={`Are you sure you want to delete ${selectedIds.length} ${activeTab === 'collections' ? 'collection' : 'nugget'}${selectedIds.length > 1 ? 's' : ''}? This cannot be undone.`}
        actionLabel="Delete"
        isDestructive
      />

      <AddToCollectionModal 
        isOpen={showAddToCollection}
        onClose={() => {
          setShowAddToCollection(false);
        }}
        articleIds={selectedIds}
        mode="public" 
      />
    </div>
  );
};
