
/**
 * ============================================================================
 * HOME PAGE: Multi-View Content Browser
 * ============================================================================
 *
 * @see src/LAYOUT_ARCHITECTURE.md for full documentation
 *
 * PURPOSE:
 * - Display articles in multiple view modes (grid, feed, masonry, utility)
 * - Handle view mode switching via Header buttons
 * - Article clicks open modal overlays (NOT side panel like FeedLayoutPage)
 * - Category toolbar filters feed by community collection
 *
 * VIEW MODES:
 * - grid: 4-column ArticleGrid (default)
 * - masonry: Masonry-style ArticleGrid
 * - utility: Compact utility ArticleGrid
 *
 * STABILITY RULES:
 * - Use stable grid-cols-{n} classes only (NO arbitrary templates)
 * - Width constraints on children, not grid definitions
 * - This page does NOT use ResponsiveLayoutShell (that's for /feed route)
 *
 * ============================================================================
 */

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Article, SortOrder, TimeRange } from '@/types';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { useFeaturedCollections } from '@/hooks/useFeaturedCollections';
import { Loader2 } from 'lucide-react';
import { ArticleModal } from '@/components/ArticleModal';
import { ArticleGrid } from '@/components/ArticleGrid';
import { PageStack } from '@/components/layouts/PageStack';
import { CategoryToolbar } from '@/components/CategoryToolbar';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import { articleService } from '@/services/articleService';

interface HomePageProps {
  searchQuery: string;
  viewMode: 'grid' | 'masonry' | 'utility';
  setViewMode: (mode: 'grid' | 'masonry' | 'utility') => void;
  selectedCategories: string[];
  setSelectedCategories: (c: string[]) => void;
  selectedTag: string | null;
  setSelectedTag: (t: string | null) => void;
  sortOrder: SortOrder;
  /** Active community collection ID from useFilterState (URL-persisted) */
  collectionId: string | null;
  setCollectionId: (id: string | null) => void;
  favorites?: boolean;
  unread?: boolean;
  formats?: string[];
  timeRange?: TimeRange;
}

export const HomePage: React.FC<HomePageProps> = ({
  searchQuery,
  viewMode,
  selectedCategories,
  setSelectedCategories,
  selectedTag,
  setSelectedTag,
  sortOrder,
  collectionId,
  setCollectionId,
  favorites = false,
  unread = false,
  formats = [],
  timeRange = 'all',
}) => {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { currentUserId } = useAuth();

  // Handle ?openArticle=<id> query param (from push notifications / shared links)
  useEffect(() => {
    const articleId = searchParams.get('openArticle');
    if (!articleId) return;
    // Clear the param immediately to avoid re-triggering
    searchParams.delete('openArticle');
    setSearchParams(searchParams, { replace: true });
    // Fetch and open the article in the modal
    articleService.getArticleById(articleId).then((article) => {
      if (article) setSelectedArticle(article);
    });
  }, [searchParams, setSearchParams]);

  // Fetch featured collections for the category toolbar
  const {
    data: featuredCollections = [],
    isLoading: isLoadingCollections,
  } = useFeaturedCollections();

  // Determine active tag from selectedCategories (needed for useInfiniteArticles)
  const activeCategory = useMemo(() => {
    if (selectedCategories.length === 0) return 'All';
    if (selectedCategories.includes('Today')) return 'Today';
    return selectedCategories[0] || 'All';
  }, [selectedCategories]);

  // Single unified feed — collectionId is just another filter param
  // When collectionId is set, backend filters articles by collection membership
  // Tag filter continues to work alongside collection filter
  const {
    articles = [],
    isLoading: isLoadingArticles,
    isFilterRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: articlesError,
    refetch: refetchArticles,
  } = useInfiniteArticles({
    searchQuery,
    activeCategory,
    selectedCategories,
    sortOrder,
    limit: 25,
    tag: selectedTag,
    collectionId,
    favorites,
    unread,
    formats,
    timeRange,
  });

  const handleRefreshFeed = async () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await refetchArticles();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      touchStartRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;
    if (window.scrollY === 0 && diff > 0 && touchStartRef.current > 0) {
      const newPullY = Math.min(diff * 0.4, 120);
      setPullY(newPullY);
    }
  };

  const handleTouchEnd = async () => {
    if (pullY > 60) {
      setIsRefreshing(true);
      setPullY(60);
      await handleRefreshFeed();
      setIsRefreshing(false);
      setPullY(0);
    } else {
      setPullY(0);
    }
    touchStartRef.current = 0;
  };

  const toggleTag = (tag: string) => {
    setSelectedCategories(
      selectedCategories.includes(tag)
        ? selectedCategories.filter(c => c !== tag)
        : [...selectedCategories, tag]
    );
  };

  const handleCategorySelect = useCallback((id: string | null) => {
    setCollectionId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setCollectionId]);

  // Only show toolbar if there are featured collections (or still loading)
  const showToolbar = isLoadingCollections || featuredCollections.length > 0;

  return (
    <main className="w-full flex flex-col relative" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} ref={containerRef}>

      {/* Refresh Indicator */}
      <div className="absolute top-0 left-0 w-full flex justify-center pointer-events-none z-10" style={{ height: `${pullY}px`, opacity: pullY > 0 ? 1 : 0, transition: isRefreshing ? 'height 0.3s ease' : 'none' }}>
        <div className="mt-6 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 h-10 w-10 flex items-center justify-center transform transition-transform" style={{ transform: isRefreshing ? 'scale(1)' : `scale(${Math.min(pullY / 60, 1)}) rotate(${pullY * 3}deg)` }}>
          <Loader2 size={20} className={`text-primary-600 dark:text-primary-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      </div>

      <div className="w-full transition-transform duration-300 ease-out origin-top" style={{ transform: `translateY(${pullY}px)` }}>
        <PageStack
          categoryToolbar={showToolbar ? (
            <CategoryToolbar
              collections={featuredCollections}
              isLoading={isLoadingCollections}
              selectedCollectionId={collectionId}
              onSelect={handleCategorySelect}
            />
          ) : undefined}
          mainContent={
            <div className="max-w-[1800px] mx-auto px-4 lg:px-6 pb-4">
              <ArticleGrid
                articles={articles}
                viewMode={viewMode}
                isLoading={isLoadingArticles}
                isFilterRefetching={isFilterRefetching}
                onArticleClick={setSelectedArticle}
                onTagClick={(t) => setSelectedTag(t)}
                onCategoryClick={(c) => toggleTag(c)}
                currentUserId={currentUserId}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={fetchNextPage}
                error={articlesError || null}
                onRetry={refetchArticles}
              />
            </div>
          }
        />
      </div>

      {selectedArticle && (
        <ArticleModal
          isOpen={!!selectedArticle}
          onClose={() => setSelectedArticle(null)}
          article={selectedArticle}
        />
      )}
    </main>
  );
};
