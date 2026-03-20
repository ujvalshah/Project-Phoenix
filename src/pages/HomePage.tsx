
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

import React, { useState, useRef, useMemo } from 'react';
import { Article, SortOrder } from '@/types';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { Loader2 } from 'lucide-react';
import { ArticleModal } from '@/components/ArticleModal';
import { ArticleGrid } from '@/components/ArticleGrid';
import { PageStack } from '@/components/layouts/PageStack';
import { useAuth } from '@/hooks/useAuth';

interface HomePageProps {
  searchQuery: string;
  viewMode: 'grid' | 'masonry' | 'utility';
  setViewMode: (mode: 'grid' | 'masonry' | 'utility') => void;
  selectedCategories: string[]; // CATEGORY PHASE-OUT: Kept name for backward compatibility, but now represents tags
  setSelectedCategories: (c: string[]) => void;
  selectedTag: string | null;
  setSelectedTag: (t: string | null) => void;
  sortOrder: SortOrder;
}

export const HomePage: React.FC<HomePageProps> = ({
  searchQuery,
  viewMode,
  selectedCategories,
  setSelectedCategories,
  selectedTag,
  setSelectedTag,
  sortOrder
}) => {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { currentUserId } = useAuth();

  // CATEGORY PHASE-OUT: Determine active tag from selectedCategories (needed for useInfiniteArticles)
  // Note: selectedCategories is kept for backward compatibility but now represents tags
  const activeCategory = useMemo(() => {
    if (selectedCategories.length === 0) return 'All';
    if (selectedCategories.includes('Today')) return 'Today';
    return selectedCategories[0] || 'All';
  }, [selectedCategories]);

  // CRITICAL FIX: Use infinite scroll for ALL view modes (grid, feed, masonry, utility)
  // This ensures consistent pagination behavior and allows loading more than 25 items
  // Tag filtering is now server-side — no client-side filtering needed
  const {
    articles = [],
    isLoading: isLoadingArticles,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: articlesError,
    refetch: refetchArticles,
  } = useInfiniteArticles({
    searchQuery,
    activeCategory,
    sortOrder,
    limit: 25,
    tag: selectedTag,
  });

  // Create query-like object for backward compatibility with error handling
  const query = {
    isLoading: isLoadingArticles,
    isError: !!articlesError,
    error: articlesError,
    refetch: refetchArticles,
    data: null, // Not used for infinite query
  };

  const handleRefreshFeed = async () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await query.refetch();
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

  // CATEGORY PHASE-OUT: Renamed toggleCategory to toggleTag
  const toggleTag = (tag: string) => {
      setSelectedCategories(
          selectedCategories.includes(tag)
            ? selectedCategories.filter(c => c !== tag)
            : [...selectedCategories, tag]
      );
  };

  // Error handling is now delegated to ArticleGrid for better inline UX
  // No page-level error handling needed

  return (
    <main className="w-full flex flex-col relative" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} ref={containerRef}>
      
      {/* Refresh Indicator */}
      <div className="absolute top-0 left-0 w-full flex justify-center pointer-events-none z-10" style={{ height: `${pullY}px`, opacity: pullY > 0 ? 1 : 0, transition: isRefreshing ? 'height 0.3s ease' : 'none' }}>
        <div className="mt-6 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 h-10 w-10 flex items-center justify-center transform transition-transform" style={{ transform: isRefreshing ? 'scale(1)' : `scale(${Math.min(pullY / 60, 1)}) rotate(${pullY * 3}deg)` }}>
          <Loader2 size={20} className={`text-primary-600 dark:text-primary-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      </div>

      <div className="w-full transition-transform duration-300 ease-out origin-top" style={{ transform: `translateY(${pullY}px)` }}>
        {/* 
          Layout Contract:
          Header owns the top (fixed, rendered in App.tsx).
          PageStack owns vertical order.
          Content must never overlap siblings.
          
          LAYOUT INVARIANT:
          Fixed headers do not reserve space.
          All fixed/sticky elements require explicit spacers.
          
          Sticky elements do not reserve space.
          Always add explicit spacing before content.
        */}
        <PageStack
          mainContent={
            // Grid/Masonry/Utility View: Full-width for maximum content density
            <div className="max-w-[1800px] mx-auto px-4 lg:px-6 pb-4">
              <ArticleGrid
                articles={articles}
                viewMode={viewMode}
                isLoading={isLoadingArticles}
                onArticleClick={setSelectedArticle}
                onTagClick={(t) => setSelectedTag(t)}
                onCategoryClick={(c) => toggleTag(c)} // CATEGORY PHASE-OUT: onCategoryClick now handles tags
                currentUserId={currentUserId}
                // Infinite Scroll Props
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={fetchNextPage}
                // Error Handling Props
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
