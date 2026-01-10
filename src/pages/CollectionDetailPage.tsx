import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Collection, Article, Contributor } from '@/types';
import { storageService } from '@/services/storageService';
import { ArrowLeft, Folder, Users, Layers, Plus, Info, Pencil, Check, X } from 'lucide-react';
import { ArticleGrid } from '@/components/ArticleGrid';
import { useToast } from '@/hooks/useToast';
import { ArticleModal } from '@/components/ArticleModal';
import { getCollectionTheme } from '@/constants/theme';
import { ShareMenu } from '@/components/shared/ShareMenu';
import { useAuth } from '@/hooks/useAuth';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';

export const CollectionDetailPage: React.FC = () => {
  // URL params are the single source of truth for selected collection
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUserId } = useAuth();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [nuggets, setNuggets] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // PHASE 5: Track nuggets length for polling comparison
  const nuggetsRef = useRef<Article[]>([]);
  useEffect(() => {
    nuggetsRef.current = nuggets;
  }, [nuggets]);

  // URL-driven fetching: collectionId from useParams is the ONLY fetch trigger
  // Effect depends ONLY on collectionId to prevent render loops
  useEffect(() => {
    // If no collectionId in URL, redirect to collections page
    if (!collectionId) {
      navigate('/collections', { replace: true });
      return;
    }

    // Clear previous state when collectionId changes (prevents stale data)
    setCollection(null);
    setNuggets([]);
    setIsLoading(true);
    setSelectedArticle(null);

    // Track if this effect is still valid (prevents race conditions)
    let isMounted = true;

    const loadData = async (id: string) => {
      setIsLoading(true);
      try {
        // Fetch collection first
        const col = await storageService.getCollectionById(id);
        
        // Check if component is still mounted and collectionId hasn't changed
        if (!isMounted || collectionId !== id) return;
        
        if (!col) { 
          navigate('/collections', { replace: true }); 
          return; 
        }
        
        // Extract unique user IDs needed for contributor resolution
        const uniqueUserIds = [...new Set(col.entries.map(entry => entry.addedByUserId))];
        
        // Fetch only required users in parallel
        const userPromises = uniqueUserIds.map(userId => 
          storageService.getUserById(userId).catch(() => undefined)
        );
        const users = await Promise.all(userPromises);
        const userMap = new Map(users.filter((u): u is NonNullable<typeof u> => u !== undefined).map(u => [u.id, u]));

        // Fetch specific articles in parallel using Promise.all
        const articlePromises = col.entries.map(async (entry) => {
          try {
            const article = await storageService.getArticleById(entry.articleId);
            if (!article) return null;
            
            // Inject addedBy data for display
            const adder = userMap.get(entry.addedByUserId);
            const contributor: Contributor | undefined = adder ? {
                userId: adder.id,
                name: adder.name,
                username: adder.username || (adder.email ? adder.email.split('@')[0] : undefined), 
                avatarUrl: adder.avatarUrl,
                addedAt: entry.addedAt
            } : undefined;

            return {
                ...article,
                addedBy: contributor
            };
          } catch (error) {
            // Handle case where article was deleted but entry still exists
            console.warn(`Failed to fetch article ${entry.articleId}:`, error);
            return null;
          }
        });

        // Wait for all article fetches to complete and filter out nulls
        const articleResults = await Promise.all(articlePromises);
        const collectionNuggets = articleResults.filter((article): article is Article => article !== null);

        // Only update state if still mounted and collectionId hasn't changed
        if (isMounted && collectionId === id) {
          setCollection(col);
          setNuggets(collectionNuggets);
        }
      } catch (e) { 
        // Only show error if still mounted and collectionId hasn't changed
        if (isMounted && collectionId === id) {
          console.error('Failed to load collection data:', e);
          toast.error('Failed to load collection', {
            description: 'Please try again later.'
          });
        }
      } finally { 
        // Only update loading state if still mounted and collectionId hasn't changed
        if (isMounted && collectionId === id) {
          setIsLoading(false);
        }
      }
    };

    loadData(collectionId);

    // PHASE 5: Add polling for real-time updates (poll every 30 seconds)
    // This ensures the detail page stays in sync when entries are added/removed elsewhere
    const pollInterval = setInterval(() => {
      if (isMounted && collectionId) {
        // Silently refetch collection data
        storageService.getCollectionById(collectionId)
          .then(col => {
            if (col && isMounted && collectionId === col.id) {
              setCollection(col);
              // Refetch articles if entries changed (compare with ref to avoid stale closure)
              if (col.entries.length !== nuggetsRef.current.length) {
                loadData(collectionId);
              }
            }
          })
          .catch(() => {
            // Silently fail - don't show error for background polling
          });
      }
    }, 30000); // Poll every 30 seconds

    // Cleanup: mark as unmounted and clear polling interval
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]); // Only collectionId triggers fetch - navigate and toast are stable and don't need to be in deps


  const handleAddNugget = () => {
      toast.info("To add a nugget:", {
          description: "Find any nugget in your feed, click the 'Add to Collection' folder icon, and select this collection.",
          duration: 5000
      });
  };

  const handleStartEdit = () => {
    if (collection) {
      setEditName(collection.name || '');
      setEditDescription(collection.description || '');
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
    setEditDescription('');
  };

  const handleSaveEdit = async () => {
    if (!collection || !editName.trim()) {
      toast.error('Collection name is required');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await storageService.updateCollection(collection.id, {
        name: editName.trim(),
        description: editDescription.trim()
      });
      if (updated) {
        setCollection(updated);
        toast.success('Collection updated');
      }
      setIsEditing(false);
    } catch (e: any) {
      const errorMessage = e?.response?.data?.message || e?.message || 'Failed to update collection';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if current user is the owner
  const isOwner = collection && currentUserId === collection.creatorId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <HeaderSpacer />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
        </div>
      </div>
    );
  }
  if (!collection) return null;

  const theme = getCollectionTheme(collection.id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <HeaderSpacer />
      {/* Unified Light Theme Header */}
      <div 
        className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR}`}
        style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
      >
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <button onClick={() => navigate('/collections')} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white mb-6 transition-colors">
                <ArrowLeft size={16} /> Back to Collections
            </button>
            <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
                <div className="flex gap-5">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${theme.light} ${theme.text} dark:bg-slate-800`}>
                        <Folder size={32} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Collection name"
                              className="w-full text-2xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              autoFocus
                            />
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Description (optional)"
                              rows={2}
                              className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleSaveEdit}
                                disabled={isSaving || !editName.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm font-bold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <Check size={14} /> {isSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              >
                                <X size={14} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                {collection.name}
                              </h1>
                              {isOwner && (
                                <button
                                  onClick={handleStartEdit}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Edit collection"
                                >
                                  <Pencil size={16} />
                                </button>
                              )}
                            </div>
                            <p className="text-gray-500 dark:text-slate-400 max-w-2xl leading-relaxed">{collection.description || "No description provided."}</p>
                            <div className="flex items-center gap-6 mt-4 text-sm text-gray-500 dark:text-slate-400 font-medium">
                              <span className="flex items-center gap-1.5"><Layers size={16} /> {nuggets.length} nuggets</span>
                              <span className="flex items-center gap-1.5"><Users size={16} /> {collection.followersCount} followers</span>
                              <span className="flex items-center gap-1.5"><Info size={16} /> Created by u1</span>
                            </div>
                          </>
                        )}
                    </div>
                </div>
                <div className="flex gap-3 shrink-0 items-center">
                    <ShareMenu 
                        data={{
                            type: 'collection',
                            id: collection.id,
                            title: collection.name,
                            shareUrl: `${window.location.origin}/#/collections/${collection.id}`
                        }}
                        meta={{
                            text: collection.description
                        }}
                        className="hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-white w-10 h-10"
                        iconSize={20}
                    />
                    <button onClick={handleAddNugget} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-sm">
                        <Plus size={16} /> Add Nugget
                    </button>
                </div>
            </div>
        </div>
      </div>
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ArticleGrid 
            articles={nuggets}
            viewMode="grid"
            isLoading={false}
            onArticleClick={setSelectedArticle}
            onCategoryClick={() => {}}
            emptyTitle="Empty Collection"
            emptyMessage="This collection has no nuggets yet. Be the first to add one!"
            currentUserId={currentUserId}
        />
      </div>
      {selectedArticle && <ArticleModal isOpen={!!selectedArticle} onClose={() => setSelectedArticle(null)} article={selectedArticle} />}
    </div>
  );
};
