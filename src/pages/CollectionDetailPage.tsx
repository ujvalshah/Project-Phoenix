import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Collection, Article } from '@/types';
import { storageService } from '@/services/storageService';
import { ArrowLeft, Folder, Users, Layers, Plus, Info, Pencil, Check, X, CheckSquare } from 'lucide-react';
import { ArticleGrid } from '@/components/ArticleGrid';
import { useToast } from '@/hooks/useToast';
import { ArticleModal } from '@/components/ArticleModal';
import { getCollectionTheme } from '@/constants/theme';
import { ShareMenu } from '@/components/shared/ShareMenu';
import { useAuth } from '@/hooks/useAuth';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';
import { BulkActionBar } from '@/components/shared/BulkActionBar';
import { AddToCollectionModal } from '@/components/AddToCollectionModal';
import { ModalShell } from '@/components/UI/ModalShell';
import { buildCollectionShareUrl } from '@/sharing/urlBuilder';

export const CollectionDetailPage: React.FC = () => {
  // URL params are the single source of truth for selected collection
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUserId, isAdmin } = useAuth();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [nuggets, setNuggets] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSize = 30;

  const loadCollectionPage = useCallback(
    async (id: string, pageToLoad: number, append: boolean) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setLoadError(null);

      try {
        const col = await storageService.getCollectionById(id, { includeEntries: false });
        if (!col) {
          navigate('/collections', { replace: true });
          return;
        }
        setCollection(col);
        const articlesPage = await storageService.getCollectionArticles(id, {
          page: pageToLoad,
          limit: pageSize,
          sort: 'latest',
        });
        setNuggets((prev) => (append ? [...prev, ...articlesPage.data] : articlesPage.data));
        setHasMore(Boolean(articlesPage.hasMore));
        setPage(pageToLoad);
      } catch (e) {
        console.error('Failed to load collection data:', e);
        setLoadError('Could not load collection nuggets right now.');
        if (!append) {
          setNuggets([]);
          setHasMore(false);
        }
        toast.error('Failed to load collection', {
          description: 'Please try again later.',
        });
      } finally {
        if (append) setIsLoadingMore(false);
        else setIsLoading(false);
      }
    },
    [navigate, toast]
  );

  useEffect(() => {
    if (!collectionId) {
      navigate('/collections', { replace: true });
      return;
    }

    setCollection(null);
    setNuggets([]);
    setPage(1);
    setHasMore(false);
    setIsLoading(true);
    setSelectedArticle(null);
    setSelectionMode(false);
    setSelectedIds([]);
    void loadCollectionPage(collectionId, 1, false);
  }, [collectionId, navigate, loadCollectionPage]);


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

  // --- Selection mode handlers ---
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(nuggets.map(n => n.id));
  }, [nuggets]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
    setShowRemoveConfirm(false);
  }, []);

  const handleBulkSaveTo = useCallback(() => {
    setBulkModalOpen(true);
  }, []);

  const handleBulkModalClose = useCallback(async () => {
    setBulkModalOpen(false);
    if (collectionId) {
      await loadCollectionPage(collectionId, 1, false);
    }
    exitSelectionMode();
  }, [collectionId, exitSelectionMode, loadCollectionPage]);

  const handleBulkRemove = useCallback(async () => {
    if (!collectionId || selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await storageService.removeBatchEntriesFromCollection(collectionId, selectedIds, currentUserId);
      setNuggets(prev => prev.filter(n => !selectedIds.includes(n.id)));
      toast.success(`Removed ${selectedIds.length} nugget${selectedIds.length > 1 ? 's' : ''}`);
      exitSelectionMode();
    } catch {
      toast.error('Failed to remove some nuggets');
    } finally {
      setIsBulkProcessing(false);
      setShowRemoveConfirm(false);
    }
  }, [collectionId, selectedIds, currentUserId, toast, exitSelectionMode]);

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

  /** Public editorial collections: only admins curate. Private: owner curates. */
  const canCurateCollection =
    collection.type === 'public' ? isAdmin : currentUserId === collection.creatorId;

  const canEditMetadata =
    collection.type === 'public' ? isAdmin : currentUserId === collection.creatorId;

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
                              {canEditMetadata && (
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
                    {collection.type !== 'private' && (
                      <ShareMenu
                          data={{
                              type: 'collection',
                              id: collection.id,
                              title: collection.name,
                              shareUrl: buildCollectionShareUrl(collection.id)
                          }}
                          surface="collection_detail_page"
                          meta={{
                              text: collection.description
                          }}
                          className="hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-white w-10 h-10"
                          iconSize={20}
                      />
                    )}
                    {canCurateCollection && nuggets.length > 0 && selectionMode && (
                      <button
                        onClick={selectedIds.length === nuggets.length ? handleDeselectAll : handleSelectAll}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <CheckSquare size={16} /> {selectedIds.length === nuggets.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                    {canCurateCollection && nuggets.length > 0 && (
                      <button
                        onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm ${
                          selectionMode
                            ? 'bg-primary-500 text-white hover:bg-primary-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <CheckSquare size={16} /> {selectionMode ? 'Cancel' : 'Select'}
                      </button>
                    )}
                    {canCurateCollection && (
                    <button onClick={handleAddNugget} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-sm">
                        <Plus size={16} /> Add Nugget
                    </button>
                    )}
                </div>
            </div>
        </div>
      </div>
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            {loadError}
          </div>
        )}
        <ArticleGrid
            articles={nuggets}
            viewMode="grid"
            isLoading={isLoading}
            isFetchingNextPage={isLoadingMore}
            hasNextPage={hasMore}
            onLoadMore={collectionId ? () => void loadCollectionPage(collectionId, page + 1, true) : undefined}
            onArticleClick={setSelectedArticle}
            onCategoryClick={() => {}}
            emptyTitle="Empty Collection"
            emptyMessage="This collection has no nuggets yet. Be the first to add one!"
            currentUserId={currentUserId}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onSelect={handleToggleSelect}
        />
      </div>
      {selectedArticle && <ArticleModal isOpen={!!selectedArticle} onClose={() => setSelectedArticle(null)} article={selectedArticle} />}

      {/* Bulk Selection Action Bar */}
      {canCurateCollection && selectionMode && (
        <BulkActionBar
          selectedCount={selectedIds.length}
          totalCount={nuggets.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onSaveTo={handleBulkSaveTo}
          onRemove={() => setShowRemoveConfirm(true)}
          onCancel={exitSelectionMode}
        />
      )}

      {/* Bulk Save To — editorial / owner tools only */}
      {canCurateCollection && (
      <AddToCollectionModal
        isOpen={bulkModalOpen}
        onClose={handleBulkModalClose}
        articleIds={selectedIds}
        title={`Save ${selectedIds.length} nugget${selectedIds.length > 1 ? 's' : ''} to...`}
        currentCollectionId={collectionId}
      />
      )}

      <ModalShell
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        wrapperClassName="p-4"
      >
        <div
          className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Remove nuggets?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Remove {selectedIds.length} nugget{selectedIds.length > 1 ? 's' : ''} from &quot;{collection.name}&quot;? The
            nuggets won&apos;t be deleted, just removed from this collection.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkRemove}
              disabled={isBulkProcessing}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isBulkProcessing ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
};
