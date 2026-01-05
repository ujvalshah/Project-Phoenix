
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

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Article, SortOrder } from '@/types';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { Loader2, AlertCircle } from 'lucide-react';
import { ArticleModal } from '@/components/ArticleModal';
import { ArticleGrid } from '@/components/ArticleGrid';
import { CategoryFilterBar } from '@/components/header/CategoryFilterBar';
import { PageStack } from '@/components/layouts/PageStack';
import { storageService } from '@/services/storageService';
import { useAuth } from '@/hooks/useAuth';

interface HomePageProps {
  searchQuery: string;
  viewMode: 'grid' | 'masonry' | 'utility';
  setViewMode: (mode: 'grid' | 'masonry' | 'utility') => void;
  selectedCategories: string[];
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

  // Determine active category from selectedCategories (needed for useInfiniteArticles)
  const activeCategory = useMemo(() => {
    if (selectedCategories.length === 0) return 'All';
    if (selectedCategories.includes('Today')) return 'Today';
    return selectedCategories[0] || 'All';
  }, [selectedCategories]);

  // CRITICAL FIX: Use infinite scroll for ALL view modes (grid, feed, masonry, utility)
  // This ensures consistent pagination behavior and allows loading more than 25 items
  const {
    articles: allArticles = [],
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
  });

  // Create query-like object for backward compatibility with error handling
  const query = {
    isLoading: isLoadingArticles,
    isError: !!articlesError,
    error: articlesError,
    refetch: refetchArticles,
    data: null, // Not used for infinite query
  };


  // Fetch tags to get correct casing (rawName) for category display
  const [tagNameMap, setTagNameMap] = useState<Map<string, string>>(new Map());
  
  useEffect(() => {
    const loadTagNames = async () => {
      try {
        // Fetch tags with format=full to get rawName (correct casing)
        // Use type assertion since method exists in RestAdapter
        const adapter = storageService as any;
        if (adapter.getCategoriesWithIds) {
          const tags = await adapter.getCategoriesWithIds();
          const map = new Map<string, string>();
          
          // Create mapping: canonicalName (lowercase) -> rawName (correct casing)
          tags.forEach((tag: any) => {
            const canonical = tag.canonicalName || tag.rawName?.toLowerCase() || '';
            const rawName = tag.rawName || tag.name || '';
            if (canonical && rawName) {
              map.set(canonical, rawName);
            }
          });
          
          setTagNameMap(map);
        }
      } catch (error) {
        console.warn('Failed to load tag names for casing correction:', error);
      }
    };
    
    loadTagNames();
  }, []);

  // Calculate category counts from articles with correct casing from tags
  const categoriesWithCounts = useMemo(() => {
    const categoryCountMap = new Map<string, number>();
    
    allArticles.forEach(article => {
      article.categories?.forEach(cat => {
        // Use canonical name (lowercase) for counting to group case variants
        if (!cat) return;
        const canonical = cat.toLowerCase().trim();
        const count = categoryCountMap.get(canonical) || 0;
        categoryCountMap.set(canonical, count + 1);
      });
    });

    // Map back to correct casing using tagNameMap
    return Array.from(categoryCountMap.entries()).map(([canonical, count]) => {
      // Get correct casing from tagNameMap, fallback to original if not found
      const correctLabel = tagNameMap.get(canonical) || canonical;
      
      return {
        id: canonical.replace(/\s+/g, '-'),
        label: correctLabel, // Use correct casing from backend tags
        count,
      };
    });
  }, [allArticles, tagNameMap]);

  // Calculate tag counts from articles
  // NOTE: Tags are mandatory - all nuggets must have at least one tag
  const tagsWithCounts = useMemo(() => {
    const tagCountMap = new Map<string, number>();
    
    allArticles.forEach(article => {
      const tags = article.tags || [];
      // Count each tag (all nuggets should have tags since they're mandatory)
      tags.forEach(tag => {
        const count = tagCountMap.get(tag) || 0;
        tagCountMap.set(tag, count + 1);
      });
    });

    // Sort tags by count (descending) then alphabetically
    return Array.from(tagCountMap.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]; // Count descending
        return a[0].localeCompare(b[0]); // Alphabetical ascending
      })
      .map(([label, count]) => ({ label, count }));
  }, [allArticles]);

  // Handle tag filtering client-side (backend doesn't support tag filtering)
  // "Today" filter is now handled by backend - no client-side filtering needed
  const articles = useMemo(() => {
    let filtered = allArticles;
    
    // Apply tag filter if selected
    // Tags are mandatory - filter for nuggets containing the selected tag
    if (selectedTag) {
      filtered = filtered.filter(article => {
        const tags = article.tags || [];
        return tags.includes(selectedTag);
      });
    }
    
    return filtered;
  }, [allArticles, activeCategory, selectedTag]);

  // Handle category selection from CategoryFilterBar with toggle behavior
  // TOGGLE LOGIC: Clicking the currently selected tag unselects it (sets to null/empty)
  // Clicking an unselected tag selects it. Only one tag can be active at a time.
  const handleCategorySelect = (categoryLabel: string) => {
    // If clicking the currently active category, unselect it (toggle off)
    if (activeCategory === categoryLabel) {
      setSelectedCategories([]); // Clear selection - will show "All" as active
    } else {
      // Select the clicked category (single-select pattern)
      setSelectedCategories([categoryLabel]);
    }
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

  const toggleCategory = (cat: string) => {
      setSelectedCategories(
          selectedCategories.includes(cat) 
            ? selectedCategories.filter(c => c !== cat) 
            : [...selectedCategories, cat]
      );
  };

  if (query.isError) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center text-slate-500">
        <AlertCircle className="w-10 h-10 mb-2 text-red-500" />
        <p>Something went wrong loading the feed.</p>
        <button onClick={() => query.refetch()} className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700">Try Again</button>
      </div>
    );
  }

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
          categoryToolbar={
            <CategoryFilterBar
              categories={categoriesWithCounts}
              activeCategory={activeCategory}
              onSelect={handleCategorySelect}
            />
          }
          mainContent={
            // Grid/Masonry/Utility View: Full-width for maximum content density
            <div className="max-w-[1800px] mx-auto px-4 lg:px-6 pb-4">
              <ArticleGrid 
                articles={articles}
                viewMode={viewMode}
                isLoading={isLoadingArticles}
                onArticleClick={setSelectedArticle}
                onTagClick={(t) => setSelectedTag(t)}
                onCategoryClick={(c) => toggleCategory(c)}
                currentUserId={currentUserId}
                // Infinite Scroll Props
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={fetchNextPage}
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
