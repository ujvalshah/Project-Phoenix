/**
 * ============================================================================
 * BOOKMARKS PAGE: User's Saved Items
 * ============================================================================
 *
 * Matches HomePage layout exactly:
 * - PageStack with folder toolbar (like TagFilterBar)
 * - ArticleGrid for cards (same grid as homepage)
 * - Infinite scroll pagination
 *
 * Folder toolbar shows:
 * - "All" (default) - shows all bookmarked items
 * - User's custom folders
 * - "+ New" button to create folder
 *
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Check, Columns, LayoutGrid, Loader2, Plus, Search, X } from 'lucide-react';
import { ArticleGrid } from '@/components/ArticleGrid';
import { ArticleModal } from '@/components/ArticleModal';
import { PageStack } from '@/components/layouts/PageStack';
import { EmptyState } from '@/components/UI/EmptyState';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import {
  useInfiniteBookmarks,
  useBookmarkCollections,
  useCreateBookmarkCollection
} from '@/hooks/useBookmarks';
import { LAYOUT_CLASSES } from '@/constants/layout';
import type { Article } from '@/types';
import { SearchInput } from '@/components/header/SearchInput';
import type { BookmarkFilters } from '@/services/bookmarkService';
import { WorkspaceTopSection } from '@/components/workspace/WorkspaceTopSection';
import {
  TOOLBAR_BUTTON,
  TOOLBAR_INPUT,
  TOOLBAR_SELECT,
  TOOLBAR_TOGGLE_GROUP,
  TOOLBAR_TOGGLE_ITEM,
} from '@/components/workspace/toolbarPrimitives';

/**
 * FolderFilterBar — private bookmark folders only (not editorial collections).
 */
interface CollectionFilterBarProps {
  collections: Array<{ id: string; name: string; bookmarkCount: number; isDefault: boolean }>;
  activeCollectionId: string | null;
  onSelect: (collectionId: string | null) => void;
  onCreateCollection: (name: string) => Promise<void>;
  isCreating: boolean;
}

const CollectionFilterBar: React.FC<CollectionFilterBarProps> = ({
  collections,
  activeCollectionId,
  onSelect,
  onCreateCollection,
  isCreating
}) => {
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (showCreateInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreateInput]);

  const handleCreate = async () => {
    if (newName.trim()) {
      await onCreateCollection(newName.trim());
      setNewName('');
      setShowCreateInput(false);
    }
  };

  const isAllActive = activeCollectionId === null;

  return (
    <div
      className={`bg-white/90 dark:bg-slate-950/70 ${LAYOUT_CLASSES.CATEGORY_BAR_HEIGHT} border-b border-gray-200/80 dark:border-slate-800/70 backdrop-blur-md`}
      aria-label="Bookmark folders"
    >
      <div className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} flex h-full items-center`}>
        <div className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-white/95 to-transparent dark:from-slate-950/70"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-white/95 to-transparent dark:from-slate-950/70"
            aria-hidden="true"
          />
          <div
            className="no-scrollbar-visual flex flex-nowrap items-center gap-1 overflow-x-auto scroll-smooth py-1 [scroll-padding-inline:0.75rem]"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
          {/* "All" button */}
          <button
            onClick={() => onSelect(null)}
            className={`
              whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] leading-snug font-medium transition-all duration-150 shrink-0
              ${isAllActive
                ? 'bg-gray-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:shadow-none'
                : 'bg-gray-100/80 text-gray-700 hover:bg-gray-200/70 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900'
              }
            `}
            aria-pressed={isAllActive}
          >
            All
          </button>

          {/* Divider */}
          {collections.length > 0 && (
            <div
              className="h-[14px] w-px bg-gray-300 dark:bg-slate-600 mx-1 shrink-0"
              aria-hidden="true"
            />
          )}

          {/* Folder buttons */}
          {collections.map((collection) => {
            const isActive = activeCollectionId === collection.id;
            return (
              <button
                key={collection.id}
                onClick={() => onSelect(collection.id)}
                className={`
                  whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] leading-snug font-medium transition-all duration-150 shrink-0
                  ${isActive
                    ? 'bg-gray-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:shadow-none'
                    : 'bg-gray-100/80 text-gray-700 hover:bg-gray-200/70 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900'
                  }
                `}
                aria-pressed={isActive}
              >
                {collection.name}
                {collection.bookmarkCount > 0 && (
                  <span className="ml-1 opacity-60 text-[10px]">({collection.bookmarkCount})</span>
                )}
              </button>
            );
          })}

          {/* Create folder input or button */}
          {showCreateInput ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') {
                    setShowCreateInput(false);
                    setNewName('');
                  }
                }}
                placeholder="Folder name"
                maxLength={50}
                className="w-28 px-2 py-1 text-[12px] rounded-md border border-gray-300/80 dark:border-slate-700 bg-white/90 dark:bg-slate-950/40 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || isCreating}
                className="p-1 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {isCreating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              </button>
              <button
                onClick={() => {
                  setShowCreateInput(false);
                  setNewName('');
                }}
                className="p-1 rounded-md bg-gray-100/90 dark:bg-slate-900/60 text-gray-600 dark:text-slate-300 hover:bg-gray-200/80 dark:hover:bg-slate-900"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateInput(true)}
              className="whitespace-nowrap rounded-md px-2 py-1 text-[12px] leading-snug font-medium transition-all duration-150 shrink-0 bg-gray-100/80 text-gray-600 hover:bg-gray-200/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-900 flex items-center gap-1"
            >
              <Plus size={12} />
              <span className="hidden sm:inline">New</span>
            </button>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

type BookmarkViewMode = 'grid' | 'masonry';

/**
 * SavedPage (Bookmarks Page)
 */
export const SavedPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, currentUserId } = useAuth();

  // State
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [viewMode, setViewMode] = useState<BookmarkViewMode>('grid');
  const [sort, setSort] = useState<NonNullable<BookmarkFilters['sort']>>('lastAccessedAt');
  const [order, setOrder] = useState<NonNullable<BookmarkFilters['order']>>('desc');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchCommitted, setSearchCommitted] = useState('');
  const [searchResetSignal, setSearchResetSignal] = useState(0);

  // Queries
  const { data: collections = [], isLoading: collectionsLoading } = useBookmarkCollections();

  const {
    data: bookmarksData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: bookmarksLoading,
    error: bookmarksError,
    refetch: refetchBookmarks
  } = useInfiniteBookmarks({
    collectionId: activeCollectionId || undefined,
    limit: 25,
    sort,
    order,
    q: searchCommitted || undefined,
  });

  // Mutations
  const createCollectionMutation = useCreateBookmarkCollection();

  // Flatten paginated bookmarks and extract articles
  const bookmarks = useMemo(() => {
    return bookmarksData?.pages.flatMap(page => page.data) ?? [];
  }, [bookmarksData]);

  // Convert bookmarks to articles for ArticleGrid
  const articles = useMemo(() => {
    return bookmarks
      .filter(bookmark => bookmark.article !== null)
      .map(bookmark => bookmark.article as Article);
  }, [bookmarks]);

  const activeCollectionName = useMemo(() => {
    if (!activeCollectionId) return 'All saved nuggets';
    return collections.find((c) => c.id === activeCollectionId)?.name ?? 'Folder';
  }, [activeCollectionId, collections]);

  const activeCollectionCount = useMemo(() => {
    if (!activeCollectionId) return bookmarksData?.pages?.[0]?.meta?.total ?? 0;
    const col = collections.find((c) => c.id === activeCollectionId);
    return col?.bookmarkCount ?? (bookmarksData?.pages?.[0]?.meta?.total ?? 0);
  }, [activeCollectionId, bookmarksData?.pages, collections]);

  const defaultCollectionName = useMemo(() => {
    const def = collections.find((c) => c.isDefault);
    return def?.name || 'Saved';
  }, [collections]);

  // Handlers
  const handleCreateCollection = async (name: string) => {
    try {
      await createCollectionMutation.mutateAsync({ name });
      toast.success(`Created "${name}"`);
    } catch (error: any) {
      if (error?.message?.includes('already exists')) {
        toast.error('A folder with this name already exists');
      } else {
        toast.error('Failed to create folder');
      }
    }
  };

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
  };

  const handleCategoryClick = (category: string) => {
    const params = new URLSearchParams();
    params.append('cat', category);
    navigate(`/?${params.toString()}`);
  };

  // Redirect if not logged in
  if (!user) {
    return (
      <PageStack
        mainContent={
          <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-20">
            <EmptyState
              icon={<Bookmark className="w-12 h-12" />}
              title="Sign in to see your bookmarks"
              description="Save nuggets to read later by clicking the bookmark icon"
              action={{
                label: 'Sign In',
                onClick: () => navigate('/login')
              }}
            />
          </div>
        }
      />
    );
  }

  const isLoading = collectionsLoading || bookmarksLoading;

  return (
    <>
      <PageStack
        categoryToolbar={
          <CollectionFilterBar
            collections={collections}
            activeCollectionId={activeCollectionId}
            onSelect={setActiveCollectionId}
            onCreateCollection={handleCreateCollection}
            isCreating={createCollectionMutation.isPending}
          />
        }
        mainContent={
          <div className="mx-auto max-w-[1280px] px-4 pb-6 sm:px-6 lg:px-8">
            <div className="sticky top-14 lg:top-16" style={{ zIndex: 20 }}>
              <WorkspaceTopSection
                header={
                  <header className="flex flex-col gap-2.5 sm:gap-2 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h1 className="truncate text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-slate-900 dark:text-slate-50 sm:text-[1.55rem]">
                          {activeCollectionName}
                        </h1>
                        <span className="inline-flex h-5 items-center rounded-md border border-slate-200/70 bg-slate-50 px-1.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          {activeCollectionCount.toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                        {activeCollectionId
                          ? `Items in this private folder. ${defaultCollectionName} is your default bucket.`
                          : `Everything you saved across private folders. ${defaultCollectionName} is the default bucket - custom folders are optional.`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex min-h-[32px] items-center rounded-md border border-slate-200/70 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        Folders
                        <span className="ml-1 tabular-nums text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          {collections.length.toLocaleString()}
                        </span>
                      </span>
                    </div>
                  </header>
                }
                toolbar={
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-[420px]">
                      <SearchInput
                        initialValue={searchDraft}
                        externalValue={searchDraft}
                        resetSignal={searchResetSignal}
                        onSearch={(v) => setSearchDraft(v)}
                        onSubmit={(q) => setSearchCommitted(q)}
                        placeholder="Search saved nuggets…"
                        className="w-full"
                        inputClassName={`${TOOLBAR_INPUT} w-full pl-9 pr-10 text-[13px] dark:bg-slate-900`}
                        iconSize={15}
                        ariaLabel="Search bookmarks"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                      <label htmlFor="bookmark-sort" className="sr-only">
                        Sort bookmarks
                      </label>
                      <select
                        id="bookmark-sort"
                        value={`${sort}:${order}`}
                        onChange={(e) => {
                          const [nextSort, nextOrder] = e.target.value.split(':');
                          setSort(nextSort as NonNullable<BookmarkFilters['sort']>);
                          setOrder(nextOrder as NonNullable<BookmarkFilters['order']>);
                        }}
                        className={`${TOOLBAR_SELECT} h-9 max-w-full px-2.5 text-[13px]`}
                        aria-label="Sort"
                      >
                        <option value="lastAccessedAt:desc">Last opened · Newest</option>
                        <option value="lastAccessedAt:asc">Last opened · Oldest</option>
                        <option value="createdAt:desc">Saved · Newest</option>
                        <option value="createdAt:asc">Saved · Oldest</option>
                      </select>

                      <div
                        className={`${TOOLBAR_TOGGLE_GROUP} hidden h-9 p-0.5 lg:flex dark:bg-slate-900`}
                        role="radiogroup"
                        aria-label="Layout"
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={viewMode === 'grid'}
                          onClick={() => setViewMode('grid')}
                          className={[
                            TOOLBAR_TOGGLE_ITEM,
                            'h-7 px-2 text-[12px]',
                            viewMode === 'grid'
                              ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                          ].join(' ')}
                          title="Grid"
                        >
                          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                          <span className="hidden sm:inline">Grid</span>
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={viewMode === 'masonry'}
                          onClick={() => setViewMode('masonry')}
                          className={[
                            TOOLBAR_TOGGLE_ITEM,
                            'h-7 px-2 text-[12px]',
                            viewMode === 'masonry'
                              ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                          ].join(' ')}
                          title="Masonry"
                        >
                          <Columns className="h-3.5 w-3.5" aria-hidden />
                          <span className="hidden sm:inline">Masonry</span>
                        </button>
                      </div>

                      {(searchDraft.trim().length > 0 || searchCommitted.trim().length > 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchDraft('');
                            setSearchCommitted('');
                            setSearchResetSignal((n) => n + 1);
                          }}
                          className={`${TOOLBAR_BUTTON} text-[13px]`}
                          aria-label="Clear search"
                          title="Clear search"
                        >
                          <X className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                }
                footer={
                  searchCommitted.trim() ? (
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
                      <Search className="h-3.5 w-3.5" aria-hidden />
                      <span>Showing results for “{searchCommitted.trim()}”</span>
                    </div>
                  ) : undefined
                }
              />
            </div>

            <div className="-mt-0.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : articles.length === 0 ? (
              <EmptyState
                icon={<Bookmark className="w-12 h-12" />}
                title={activeCollectionId ? "No items in this folder" : "No bookmarks yet"}
                description={
                  activeCollectionId
                    ? "Move items here from your bookmarks"
                    : "Tap the bookmark icon on any nugget to save it for later"
                }
              />
            ) : (
              <ArticleGrid
                articles={articles}
                viewMode={viewMode}
                isLoading={false}
                onArticleClick={handleArticleClick}
                onCategoryClick={handleCategoryClick}
                currentUserId={currentUserId}
                searchHighlightQuery={searchCommitted}
                // Infinite Scroll Props
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={fetchNextPage}
                // Error Handling
                error={bookmarksError || null}
                onRetry={refetchBookmarks}
              />
            )}
            </div>
          </div>
        }
      />

      {/* Article Modal */}
      {selectedArticle && (
        <ArticleModal
          isOpen={!!selectedArticle}
          onClose={() => setSelectedArticle(null)}
          article={selectedArticle}
        />
      )}
    </>
  );
};

export default SavedPage;
