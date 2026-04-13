
/**
 * ============================================================================
 * HOME PAGE: Multi-View Content Browser
 * ============================================================================
 *
 * @see src/LAYOUT_ARCHITECTURE.md for full documentation
 *
 * PURPOSE:
 * - Display articles in multiple view modes (grid, feed, masonry)
 * - Handle view mode switching via Header buttons
 * - Article clicks open modal overlays (NOT side panel like FeedLayoutPage)
 * - Category toolbar filters feed by community collection
 *
 * VIEW MODES:
 * - grid: 4-column ArticleGrid (default)
 * - masonry: Masonry-style ArticleGrid
 *
 * STABILITY RULES:
 * - Use stable grid-cols-{n} classes only (NO arbitrary templates)
 * - Width constraints on children, not grid definitions
 * - This page does NOT use ResponsiveLayoutShell (that's for /feed route)
 *
 * ============================================================================
 */

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Article } from '@/types';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { useTagTaxonomy } from '@/hooks/useTagTaxonomy';
import { Loader2, X, Zap } from 'lucide-react';
import { ArticleModal } from '@/components/ArticleModal';
import { ArticleGrid } from '@/components/ArticleGrid';
import { PageStack } from '@/components/layouts/PageStack';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { DesktopFilterSidebar } from '@/components/header/DesktopFilterSidebar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDesktopFilterSidebar } from '@/context/DesktopFilterSidebarContext';
import { CategoryToolbar, type ActiveFilterChip } from '@/components/CategoryToolbar';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import { articleService } from '@/services/articleService';
import { useFilters } from '@/context/FilterStateContext';
import { useFilterResults } from '@/context/FilterResultsContext';

const VALUEPROP_DISMISSED_KEY = 'nuggets_valueprop_dismissed';
const PULSE_INTRO_DISMISSED_KEY = 'market_pulse_intro_dismissed';

/** Compact value proposition strip shown to first-time visitors */
const ValuePropStrip: React.FC = () => {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(VALUEPROP_DISMISSED_KEY) === '1';
    }
    return false;
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(VALUEPROP_DISMISSED_KEY, '1');
  };

  return (
    <div className="relative mx-4 lg:mx-6 mb-3 px-4 py-3 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200/60 rounded-xl">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <p className="text-sm font-semibold text-gray-900 pr-6">
        Nuggets: The Knowledge App
      </p>
      <p className="text-xs text-gray-600 mt-0.5">
        Curated high-signal insights across Markets, Geopolitics, AI, and Tech. Save time — follow signal, not noise.
      </p>
    </div>
  );
};

/** One-time intro banner for Market Pulse, shown on first visit to the pulse feed */
const MarketPulseIntroBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PULSE_INTRO_DISMISSED_KEY) === '1';
    }
    return false;
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(PULSE_INTRO_DISMISSED_KEY, '1');
  };

  return (
    <div className="relative mx-4 lg:mx-6 mb-3 px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <p className="text-sm font-semibold text-gray-900 pr-6 flex items-center gap-1.5">
        <Zap size={14} className="text-amber-500" /> Market Pulse
      </p>
      <p className="text-xs text-gray-600 mt-0.5">
        Daily stream of high-signal market updates and macro intelligence. Refreshed every day.
      </p>
    </div>
  );
};

interface HomePageProps {
  viewMode: 'grid' | 'masonry';
}

export const HomePage: React.FC<HomePageProps> = ({
  viewMode,
}) => {
  // Consume filter state from context — no prop drilling required
  const {
    searchQuery,
    selectedCategories,
    setSelectedCategories,
    selectedTag,
    setSelectedTag,
    sortOrder,
    collectionId,
    favorites,
    unread,
    formats,
    timeRange,
    formatTagIds,
    domainTagIds,
    subtopicTagIds,
    toggleFormatTag,
    toggleDomainTag,
    toggleSubtopicTag,
    contentStream,
  } = useFilters();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { setResultCount } = useFilterResults();
  const isLg = useMediaQuery('(min-width: 1024px)');
  const { setInlineDesktopFiltersActive } = useDesktopFilterSidebar();

  const { currentUserId } = useAuth();

  useEffect(() => {
    setInlineDesktopFiltersActive(isLg);
    return () => {
      setInlineDesktopFiltersActive(false);
    };
  }, [isLg, setInlineDesktopFiltersActive]);

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

  // Fetch tag taxonomy for the category toolbar (Format + Domain tags)
  const { data: taxonomy, isLoading: isLoadingTaxonomy } = useTagTaxonomy();

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
    totalCount,
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
    formatTagIds,
    domainTagIds,
    subtopicTagIds,
    contentStream,
  });

  useEffect(() => {
    setResultCount(totalCount);
  }, [setResultCount, totalCount]);

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

  const handleClearToolbar = useCallback(() => {
    if (toggleFormatTag) {
      for (const id of formatTagIds) toggleFormatTag(id);
    }
    if (toggleDomainTag) {
      for (const id of domainTagIds) toggleDomainTag(id);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [formatTagIds, domainTagIds, toggleFormatTag, toggleDomainTag]);

  // Build inline filter chips for non-toolbar filters (subtopics, free-form tag, etc.)
  const activeFilters = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (selectedTag) {
      chips.push({ key: 'tag', label: `Tag: ${selectedTag}`, onRemove: () => setSelectedTag(null) });
    }
    // Subtopic tag chips (not in toolbar, show as filter chips)
    if (taxonomy && subtopicTagIds.length > 0) {
      for (const sid of subtopicTagIds) {
        const tag = taxonomy.subtopics.find(t => t.id === sid);
        if (tag && toggleSubtopicTag) {
          chips.push({ key: `st-${sid}`, label: tag.rawName, onRemove: () => toggleSubtopicTag(sid) });
        }
      }
    }
    return chips;
  }, [selectedTag, setSelectedTag, subtopicTagIds, taxonomy, toggleSubtopicTag]);

  // Show toolbar when taxonomy is loading or has format/domain tags
  const showToolbar = isLoadingTaxonomy || (taxonomy && (taxonomy.formats.length > 0 || taxonomy.domains.length > 0));

  const categoryToolbarEl = showToolbar ? (
    <CategoryToolbar
      formatTags={taxonomy?.formats ?? []}
      domainTags={taxonomy?.domains ?? []}
      selectedFormatIds={formatTagIds}
      selectedDomainIds={domainTagIds}
      onToggleFormat={toggleFormatTag}
      onToggleDomain={toggleDomainTag}
      onClearAll={handleClearToolbar}
      isLoading={isLoadingTaxonomy}
      activeFilters={activeFilters}
    />
  ) : undefined;

  const feedMain = (
    <div className="max-w-[1800px] mx-auto pb-4">
      {contentStream === 'pulse' ? <MarketPulseIntroBanner /> : <ValuePropStrip />}
      <div className="px-4 lg:px-6">
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
    </div>
  );

  return (
    <main
      className="relative flex min-h-screen w-full flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      ref={containerRef}
    >

      {/* Refresh Indicator */}
      <div className="absolute top-0 left-0 w-full flex justify-center pointer-events-none z-10" style={{ height: `${pullY}px`, opacity: pullY > 0 ? 1 : 0, transition: isRefreshing ? 'height 0.3s ease' : 'none' }}>
        <div className="mt-6 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 h-10 w-10 flex items-center justify-center transform transition-transform" style={{ transform: isRefreshing ? 'scale(1)' : `scale(${Math.min(pullY / 60, 1)}) rotate(${pullY * 3}deg)` }}>
          <Loader2 size={20} className={`text-primary-600 dark:text-primary-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      </div>

      <div
        className="flex w-full min-h-0 flex-1 flex-col transition-transform duration-300 ease-out origin-top"
        style={{ transform: `translateY(${pullY}px)` }}
      >
        {isLg ? (
          <>
            <HeaderSpacer />
            <div className="flex w-full min-w-0 flex-1 items-stretch">
              <DesktopFilterSidebar />
              <div className="min-h-0 min-w-0 flex-1">
                <PageStack suppressHeaderSpacer categoryToolbar={categoryToolbarEl} mainContent={feedMain} />
              </div>
            </div>
          </>
        ) : (
          <PageStack categoryToolbar={categoryToolbarEl} mainContent={feedMain} />
        )}
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
