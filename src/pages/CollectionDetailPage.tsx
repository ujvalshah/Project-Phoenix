import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { collectionKeys } from '@/services/queryKeys/collectionKeys';
import { feedKeys } from '@/services/queryKeys/feedKeys';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { DEFAULT_QUERY_STALE_MS } from '@/constants/reactQueryTiming';
import type { Article, SortOrder } from '@/types';

export const CollectionDetailPage: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { currentUserId, isAdmin } = useAuth();

  const sortOrder: SortOrder = useMemo(() => {
    return searchParams.get('sort') === 'oldest' ? 'oldest' : 'latest';
  }, [searchParams]);

  const setCollectionSortOrder = useCallback(
    (next: SortOrder) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === 'latest') {
            p.delete('sort');
          } else {
            p.set('sort', 'oldest');
          }
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const collectionQuery = useQuery({
    queryKey: collectionId
      ? collectionKeys.detail(collectionId)
      : ([...collectionKeys.all, 'detail', '__none'] as const),
    queryFn: async () => {
      if (!collectionId) return undefined;
      return storageService.getCollectionById(collectionId, { includeEntries: false });
    },
    enabled: Boolean(collectionId),
    staleTime: DEFAULT_QUERY_STALE_MS,
  });

  const collection = collectionQuery.data ?? null;

  const articlesQuery = useInfiniteArticles({
    searchQuery: '',
    activeCategory: 'All',
    selectedCategories: [],
    sortOrder,
    limit: 30,
    tag: null,
    collectionId: collection?.id ?? null,
    favorites: false,
    unread: false,
    formats: [],
    timeRange: 'all',
    formatTagIds: [],
    domainTagIds: [],
    subtopicTagIds: [],
    contentStream: undefined,
    enabled: Boolean(collection),
  });

  useEffect(() => {
    if (!collectionId) {
      navigate('/collections', { replace: true });
      return;
    }

    if (
      collectionQuery.fetchStatus === 'idle' &&
      collectionQuery.status === 'success' &&
      !collectionQuery.data
    ) {
      navigate('/collections', { replace: true });
    }
  }, [collectionId, collectionQuery.fetchStatus, collectionQuery.status, collectionQuery.data, navigate]);

  useEffect(() => {
    if (!collectionId) return;
    setSelectedArticle(null);
    setSelectionMode(false);
    setSelectedIds([]);
  }, [collectionId]);

  const lastArticleErrorToastAt = useRef(0);
  useEffect(() => {
    if (!articlesQuery.error || articlesQuery.errorUpdatedAt === 0) return;
    if (lastArticleErrorToastAt.current === articlesQuery.errorUpdatedAt) return;
    lastArticleErrorToastAt.current = articlesQuery.errorUpdatedAt;
    toast.error('Failed to load collection', {
      description: 'Please try again later.',
    });
  }, [articlesQuery.error, articlesQuery.errorUpdatedAt, toast]);

  const invalidateCollectionArticles = useCallback(async () => {
    if (!collectionId) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: feedKeys.collectionEntriesInfiniteRoot(collectionId),
      }),
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as readonly unknown[];
          if (k.length < 3 || k[0] !== 'articles' || k[1] !== 'infinite') {
            return false;
          }
          const params = k[2];
          if (!params || typeof params !== 'object') {
            return false;
          }
          const cid = (params as Record<string, unknown>).collectionId;
          return String(cid ?? '') === String(collectionId);
        },
      }),
    ]);
  }, [collectionId, queryClient]);

  /** Mirrors prior `loadCollectionPage(..., append: false)` full-page spinner: initial fetch + invalidate refetch, not pagination. */
  const showBootstrapSpinner =
    Boolean(collectionId) &&
    (collectionQuery.isPending ||
      (Boolean(collection) &&
        !articlesQuery.error &&
        (articlesQuery.isPending ||
          (articlesQuery.isFetched &&
            articlesQuery.isFetching &&
            !articlesQuery.isFetchingNextPage))));

  const handleAddNugget = () => {
    toast.info('To add a nugget:', {
      description:
        "Find any nugget in your feed, click the 'Add to Collection' folder icon, and select this collection.",
      duration: 5000,
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
        description: editDescription.trim(),
      });
      if (updated) {
        queryClient.setQueryData(collectionKeys.detail(collection.id), updated);
        toast.success('Collection updated');
      }
      setIsEditing(false);
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
          : '';
      const fallback = e instanceof Error ? e.message : 'Failed to update collection';
      toast.error(errorMessage || fallback);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(articlesQuery.articles.map((n) => n.id));
  }, [articlesQuery.articles]);

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
    await invalidateCollectionArticles();
    exitSelectionMode();
  }, [exitSelectionMode, invalidateCollectionArticles]);

  const handleBulkRemove = useCallback(async () => {
    if (!collectionId || selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await storageService.removeBatchEntriesFromCollection(collectionId, selectedIds, currentUserId);
      await invalidateCollectionArticles();
      toast.success(`Removed ${selectedIds.length} nugget${selectedIds.length > 1 ? 's' : ''}`);
      exitSelectionMode();
    } catch {
      toast.error('Failed to remove some nuggets');
    } finally {
      setIsBulkProcessing(false);
      setShowRemoveConfirm(false);
    }
  }, [
    collectionId,
    selectedIds,
    currentUserId,
    toast,
    exitSelectionMode,
    invalidateCollectionArticles,
  ]);

  if (!collectionId) {
    return null;
  }

  if (collectionQuery.isError) {
    return null;
  }

  if (showBootstrapSpinner) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <HeaderSpacer />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return null;
  }

  const canCurateCollection =
    collection.type === 'public' ? isAdmin : currentUserId === collection.creatorId;

  const canEditMetadata =
    collection.type === 'public' ? isAdmin : currentUserId === collection.creatorId;

  const theme = getCollectionTheme(collection.id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <HeaderSpacer />
      <div
        className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR}`}
        style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
      >
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/collections')}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Collections
          </button>
          <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
            <div className="flex gap-5">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${theme.light} ${theme.text} dark:bg-slate-800`}
              >
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
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{collection.name}</h1>
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
                    <p className="text-gray-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                      {collection.description || 'No description provided.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 text-sm text-gray-500 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Layers size={16} /> {articlesQuery.articles.length} nuggets
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users size={16} /> {collection.followersCount} followers
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Info size={16} /> Created by u1
                      </span>
                      <div className="flex items-center gap-2 ml-auto sm:ml-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 shrink-0">
                          Order
                        </span>
                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900/80">
                          <button
                            type="button"
                            onClick={() => setCollectionSortOrder('latest')}
                            aria-pressed={sortOrder === 'latest'}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                              sortOrder === 'latest'
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            Latest
                          </button>
                          <button
                            type="button"
                            onClick={() => setCollectionSortOrder('oldest')}
                            aria-pressed={sortOrder === 'oldest'}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                              sortOrder === 'oldest'
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            Oldest
                          </button>
                        </div>
                      </div>
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
                    shareUrl: buildCollectionShareUrl(collection.id),
                  }}
                  surface="collection_detail_page"
                  meta={{
                    text: collection.description,
                  }}
                  className="hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-white w-10 h-10"
                  iconSize={20}
                />
              )}
              {canCurateCollection && articlesQuery.articles.length > 0 && selectionMode && (
                <button
                  onClick={
                    selectedIds.length === articlesQuery.articles.length
                      ? handleDeselectAll
                      : handleSelectAll
                  }
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <CheckSquare size={16} />{' '}
                  {selectedIds.length === articlesQuery.articles.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
              {canCurateCollection && articlesQuery.articles.length > 0 && (
                <button
                  onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
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
                <button
                  onClick={handleAddNugget}
                  className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Plus size={16} /> Add Nugget
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ArticleGrid
          articles={articlesQuery.articles}
          viewMode="grid"
          isLoading={articlesQuery.isPending}
          isFeedRefetching={articlesQuery.isFeedRefetching}
          isFetchingNextPage={articlesQuery.isFetchingNextPage}
          hasNextPage={articlesQuery.hasNextPage}
          onLoadMore={
            articlesQuery.hasNextPage
              ? () => {
                  void articlesQuery.fetchNextPage();
                }
              : undefined
          }
          onArticleClick={setSelectedArticle}
          onCategoryClick={() => {}}
          error={articlesQuery.error}
          onRetry={() => {
            void articlesQuery.refetch();
          }}
          emptyTitle="Empty Collection"
          emptyMessage="This collection has no nuggets yet. Be the first to add one!"
          currentUserId={currentUserId}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onSelect={handleToggleSelect}
        />
      </div>
      {selectedArticle && (
        <ArticleModal isOpen={!!selectedArticle} onClose={() => setSelectedArticle(null)} article={selectedArticle} />
      )}

      {canCurateCollection && selectionMode && (
        <BulkActionBar
          selectedCount={selectedIds.length}
          totalCount={articlesQuery.articles.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onSaveTo={handleBulkSaveTo}
          onRemove={() => setShowRemoveConfirm(true)}
          onCancel={exitSelectionMode}
        />
      )}

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
            Remove {selectedIds.length} nugget{selectedIds.length > 1 ? 's' : ''} from &quot;
            {collection.name}&quot;? The nuggets won&apos;t be deleted, just removed from this collection.
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
