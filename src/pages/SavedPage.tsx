/**
 * ============================================================================
 * BOOKMARKS PAGE: User's Saved Items
 * ============================================================================
 *
 * Matches HomePage layout exactly:
 * - PageStack with collection toolbar (like TagFilterBar)
 * - ArticleGrid for cards (same grid as homepage)
 * - Infinite scroll pagination
 *
 * Collection toolbar shows:
 * - "All" (default) - shows all bookmarked items
 * - User's custom collections
 * - "+ New" button to create collection
 *
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Plus, Loader2, X, Check } from 'lucide-react';
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

/**
 * CollectionFilterBar - Collection toolbar matching TagFilterBar style
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
    <div className={`bg-white dark:bg-slate-950 ${LAYOUT_CLASSES.CATEGORY_BAR_HEIGHT} border-b border-gray-200 dark:border-slate-700`}>
      <div className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} flex items-center py-1`}>
        <div
          className="flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden items-center scroll-smooth"
          style={{
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
            minHeight: 'fit-content',
          }}
        >
          {/* "All" button */}
          <button
            onClick={() => onSelect(null)}
            className={`
              whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] leading-snug font-medium transition-all duration-150 shrink-0
              ${isAllActive
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
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

          {/* Collection buttons */}
          {collections.map((collection) => {
            const isActive = activeCollectionId === collection.id;
            return (
              <button
                key={collection.id}
                onClick={() => onSelect(collection.id)}
                className={`
                  whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] leading-snug font-medium transition-all duration-150 shrink-0
                  ${isActive
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
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

          {/* Create collection input or button */}
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
                placeholder="Collection name"
                maxLength={50}
                className="w-28 px-2 py-1 text-[12px] rounded-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || isCreating}
                className="p-1 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {isCreating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              </button>
              <button
                onClick={() => {
                  setShowCreateInput(false);
                  setNewName('');
                }}
                className="p-1 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateInput(true)}
              className="whitespace-nowrap rounded-full px-2 py-1 text-[12px] leading-snug font-medium transition-all duration-150 shrink-0 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 flex items-center gap-1"
            >
              <Plus size={12} />
              <span className="hidden sm:inline">New</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

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
    limit: 25
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

  // Handlers
  const handleCreateCollection = async (name: string) => {
    try {
      await createCollectionMutation.mutateAsync({ name });
      toast.success(`Created "${name}"`);
    } catch (error: any) {
      if (error?.message?.includes('already exists')) {
        toast.error('A collection with this name already exists');
      } else {
        toast.error('Failed to create collection');
      }
    }
  };

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
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
          <div className="max-w-[1800px] mx-auto px-4 lg:px-6 pb-4">
            {/* Page Title - Only shown on bookmarks page */}
            <div className="py-4">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {activeCollectionId
                  ? collections.find(c => c.id === activeCollectionId)?.name || 'Collection'
                  : 'All Bookmarks'
                }
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeCollectionId
                  ? 'Items in this collection'
                  : 'All your saved nuggets'
                }
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : articles.length === 0 ? (
              <EmptyState
                icon={<Bookmark className="w-12 h-12" />}
                title={activeCollectionId ? "No items in this collection" : "No bookmarks yet"}
                description={
                  activeCollectionId
                    ? "Move items here from your bookmarks"
                    : "Tap the bookmark icon on any nugget to save it for later"
                }
              />
            ) : (
              <ArticleGrid
                articles={articles}
                viewMode="grid"
                isLoading={false}
                onArticleClick={handleArticleClick}
                currentUserId={currentUserId}
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
