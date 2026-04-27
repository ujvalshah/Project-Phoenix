
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
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
import { useLocation, useSearchParams } from 'react-router-dom';
import { markRouteContentReady } from '@/utils/routeProfiling';
import { articleService } from '@/services/articleService';
import { shallowEqual, useFilterSelector } from '@/context/FilterStateContext';
import { useFilterResults } from '@/context/FilterResultsContext';
import { useMarkFeedSeen } from '@/hooks/usePulseUnseen';
import { endActiveSearchDraft, recordSearchEvent } from '@/observability/telemetry';
import {
  HOME_MICRO_HEADER_COPY,
  MARKET_PULSE_MICRO_HEADER_COPY,
  MARKET_PULSE_INTRO_COPY,
  PULSE_INTRO_DISMISSED_KEY,
  VALUE_PROP_STRIP_COPY,
  VALUEPROP_DISMISSED_KEY,
} from '@/constants/onboardingCopy';
import { onboardingCopyService } from '@/services/onboardingCopyService';

/** Compact value proposition strip shown to first-time visitors */
const ValuePropStrip: React.FC = () => {
  const [copy, setCopy] = useState(VALUE_PROP_STRIP_COPY);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(VALUEPROP_DISMISSED_KEY) === '1';
    }
    return false;
  });

  useEffect(() => {
    if (dismissed) return;
    let isCancelled = false;
    onboardingCopyService.getValuePropStripCopy()
      .then((remoteCopy) => {
        if (!isCancelled && remoteCopy?.title && remoteCopy?.body) {
          setCopy({
            title: remoteCopy.title,
            body: remoteCopy.body,
            enabled: remoteCopy.enabled ?? true,
          });
        }
      })
      .catch(() => {
        // Keep local constants as fallback when API/config is unavailable.
      });
    return () => {
      isCancelled = true;
    };
  }, [dismissed]);

  if (dismissed || copy.enabled === false) return null;

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
      <p className="text-sm font-semibold text-gray-900 pr-6">{copy.title}</p>
      <p className="text-xs text-gray-600 mt-0.5">{copy.body}</p>
    </div>
  );
};

/** One-time intro banner for Market Pulse, shown on first visit to the pulse feed */
const MarketPulseIntroBanner: React.FC = () => {
  const [copy, setCopy] = useState(MARKET_PULSE_INTRO_COPY);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PULSE_INTRO_DISMISSED_KEY) === '1';
    }
    return false;
  });

  useEffect(() => {
    if (dismissed) return;
    let isCancelled = false;
    onboardingCopyService.getMarketPulseIntroCopy()
      .then((remoteCopy) => {
        if (!isCancelled && remoteCopy?.title && remoteCopy?.body) {
          setCopy({
            title: remoteCopy.title,
            body: remoteCopy.body,
            enabled: remoteCopy.enabled ?? true,
          });
        }
      })
      .catch(() => {
        // Keep local constants as fallback when API/config is unavailable.
      });
    return () => {
      isCancelled = true;
    };
  }, [dismissed]);

  if (dismissed || copy.enabled === false) return null;

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
        <Zap size={14} className="text-amber-500" /> {copy.title}
      </p>
      <p className="text-xs text-gray-600 mt-0.5">{copy.body}</p>
    </div>
  );
};

const PublicHomeIntro: React.FC<{ isPulseStream: boolean }> = ({ isPulseStream }) => {
  const [homeCopy, setHomeCopy] = useState(HOME_MICRO_HEADER_COPY);
  const [marketPulseCopy, setMarketPulseCopy] = useState(MARKET_PULSE_MICRO_HEADER_COPY);

  useEffect(() => {
    let isCancelled = false;
    onboardingCopyService.getHomeMicroHeaderCopy()
      .then((remoteCopy) => {
        if (!isCancelled && remoteCopy?.title && remoteCopy?.body) {
          setHomeCopy(remoteCopy);
        }
      })
      .catch(() => {
        // Keep local constants as fallback when API/config is unavailable.
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    onboardingCopyService.getMarketPulseMicroHeaderCopy()
      .then((remoteCopy) => {
        if (!isCancelled && remoteCopy?.title && remoteCopy?.body) {
          setMarketPulseCopy(remoteCopy);
        }
      })
      .catch(() => {
        // Keep local constants as fallback when API/config is unavailable.
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  const activeCopy = isPulseStream ? marketPulseCopy : homeCopy;

  return (
    <section className="mx-4 mb-0.5 px-0 pt-0.5 pb-0 lg:mx-6" aria-label="Nuggets homepage intro">
      <h1 className="max-w-[62ch] text-[15px] font-medium leading-5 tracking-tight text-slate-950 dark:text-white sm:text-base lg:max-w-none">
        {activeCopy.title}
      </h1>
      <p className="mt-0.5 max-w-[62ch] text-[11.5px] leading-4 text-slate-500 dark:text-slate-400 sm:text-xs lg:max-w-none lg:whitespace-nowrap">
        {activeCopy.body}
      </p>
    </section>
  );
};

interface HomePageProps {
  viewMode: 'grid' | 'masonry';
}

export const HomePage: React.FC<HomePageProps> = ({
  viewMode,
}) => {
  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const firstContentMarkedRef = useRef(false);
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
  } = useFilterSelector(
    (s) => ({
      searchQuery: s.searchQuery,
      selectedCategories: s.selectedCategories,
      setSelectedCategories: s.setSelectedCategories,
      selectedTag: s.selectedTag,
      setSelectedTag: s.setSelectedTag,
      sortOrder: s.sortOrder,
      collectionId: s.collectionId,
      favorites: s.favorites,
      unread: s.unread,
      formats: s.formats,
      timeRange: s.timeRange,
      formatTagIds: s.formatTagIds,
      domainTagIds: s.domainTagIds,
      subtopicTagIds: s.subtopicTagIds,
      toggleFormatTag: s.toggleFormatTag,
      toggleDomainTag: s.toggleDomainTag,
      toggleSubtopicTag: s.toggleSubtopicTag,
      contentStream: s.contentStream,
    }),
    shallowEqual,
  );
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { setResultCount } = useFilterResults();
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isSmallViewport = useMediaQuery('(max-width: 640px)');
  const { setInlineDesktopFiltersActive } = useDesktopFilterSidebar();

  const { currentUserId, isAuthenticated } = useAuthSelector(
    (a) => ({
      currentUserId: a.user?.id || '',
      isAuthenticated: a.isAuthenticated,
    }),
    shallowEqualAuth,
  );
  const markFeedSeen = useMarkFeedSeen();

  // Clear the matching unseen badge when an authenticated user lands on that
  // stream. Guarded by isAuthenticated to avoid 401s on anonymous visits;
  // re-runs each time contentStream changes so switching streams re-marks once.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (contentStream === 'pulse') markFeedSeen.mutate('market-pulse');
    else if (contentStream === 'standard') markFeedSeen.mutate('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentStream, isAuthenticated]);

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
    isFeedRefetching,
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
    performance.mark('home:feed:query-state');
  }, [isLoadingArticles, isFeedRefetching, contentStream]);

  /** Feed dimensions excluding committed text search — for telemetry when results are empty. */
  const hasStructuralFilters = useMemo(
    () =>
      selectedCategories.length > 0 ||
      !!selectedTag ||
      sortOrder !== 'latest' ||
      !!collectionId ||
      favorites ||
      unread ||
      formats.length > 0 ||
      timeRange !== 'all' ||
      formatTagIds.length > 0 ||
      domainTagIds.length > 0 ||
      subtopicTagIds.length > 0,
    [
      selectedCategories,
      selectedTag,
      sortOrder,
      collectionId,
      favorites,
      unread,
      formats,
      timeRange,
      formatTagIds,
      domainTagIds,
      subtopicTagIds,
    ],
  );

  const homeFilterSignature = useMemo(
    () =>
      JSON.stringify({
        sortOrder,
        selectedTag,
        collectionId,
        favorites,
        unread,
        formats: [...formats].sort(),
        timeRange,
        formatTagIds: [...formatTagIds].sort(),
        domainTagIds: [...domainTagIds].sort(),
        subtopicTagIds: [...subtopicTagIds].sort(),
        contentStream,
        activeCategory,
        categories: [...selectedCategories].sort(),
      }),
    [
      sortOrder,
      selectedTag,
      collectionId,
      favorites,
      unread,
      formats,
      timeRange,
      formatTagIds,
      domainTagIds,
      subtopicTagIds,
      contentStream,
      activeCategory,
      selectedCategories,
    ],
  );

  const prevHomeFilterSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevHomeFilterSignatureRef.current === null) {
      prevHomeFilterSignatureRef.current = homeFilterSignature;
      return;
    }
    if (prevHomeFilterSignatureRef.current === homeFilterSignature) return;
    prevHomeFilterSignatureRef.current = homeFilterSignature;
    recordSearchEvent({
      name: 'search_filter_applied',
      payload: { surface: 'home-feed' },
    });
  }, [homeFilterSignature]);

  const routeContentMarkedRef = useRef<string | null>(null);
  const pathname = useLocation().pathname;
  useEffect(() => {
    if (articles.length === 0) return;
    // Initial-boot measurement (first ever paint of feed).
    if (!firstContentMarkedRef.current) {
      firstContentMarkedRef.current = true;
      performance.mark('home:feed:first-content');
      try {
        performance.measure(
          'home:feed:first-content-visible',
          'app:boot:start',
          'home:feed:first-content',
        );
      } catch {
        // app:boot:start only exists on initial load.
      }
    }
    // Per-route measurement: closes the window opened by RouteTransitionProfiler.
    if (routeContentMarkedRef.current !== pathname) {
      routeContentMarkedRef.current = pathname;
      markRouteContentReady(pathname);
    }
  }, [articles.length, pathname]);

  useEffect(() => {
    setResultCount(totalCount);
  }, [setResultCount, totalCount]);

  const committedQuery = searchQuery.trim();
  const isCommittedSearch = committedQuery.length > 0;
  const isPulseStream = contentStream === 'pulse';
  const summaryNoun = isPulseStream ? 'updates' : 'nuggets';
  const loadedCount = articles.length;
  const safeTotalCount = totalCount ?? 0;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count += selectedCategories.length;
    if (selectedTag) count += 1;
    if (collectionId) count += 1;
    if (favorites) count += 1;
    if (unread) count += 1;
    if (formats.length > 0) count += formats.length;
    if (timeRange !== 'all') count += 1;
    count += formatTagIds.length;
    count += domainTagIds.length;
    count += subtopicTagIds.length;
    return count;
  }, [
    selectedCategories,
    selectedTag,
    collectionId,
    favorites,
    unread,
    formats,
    timeRange,
    formatTagIds,
    domainTagIds,
    subtopicTagIds,
  ]);

  const sortLabel = sortOrder === 'oldest' ? 'Oldest first' : null;

  const resultSummaryText = useMemo(() => {
    const formattedLoaded = numberFormatter.format(loadedCount);
    const formattedTotal = numberFormatter.format(safeTotalCount);
    const filterContext =
      activeFilterCount > 0
        ? ` in ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''}`
        : '';
    const compactFilterContext = activeFilterCount > 0 ? ` in ${activeFilterCount}` : '';

    if (isLoadingArticles || isFeedRefetching) {
      if (isCommittedSearch) {
        return `Searching for "${committedQuery}"...`;
      }
      return `Updating ${summaryNoun}...`;
    }

    if (articlesError) {
      if (isCommittedSearch) {
        return `Search failed for "${committedQuery}". Please retry.`;
      }
      return 'Could not update nuggets. Please retry.';
    }

    if (safeTotalCount === 0) {
      if (isCommittedSearch && activeFilterCount > 0) {
        if (isSmallViewport) return `No results for "${committedQuery}"`;
        return `No ${summaryNoun} found for "${committedQuery}" in the current filters`;
      }
      if (isCommittedSearch) {
        if (isSmallViewport) return `No results for "${committedQuery}"`;
        return `No ${summaryNoun} found for "${committedQuery}"`;
      }
      if (activeFilterCount > 0) {
        if (isSmallViewport) return `No ${summaryNoun} in filters`;
        return `No ${summaryNoun} found in the current filters`;
      }
      return `No ${summaryNoun} available yet`;
    }

    if (isCommittedSearch) {
      if (loadedCount < safeTotalCount) {
        if (isSmallViewport) {
          return `${formattedLoaded} of ${formattedTotal} ${summaryNoun} for "${committedQuery}"`;
        }
        return `${formattedLoaded} of ${formattedTotal} ${summaryNoun} for "${committedQuery}"${filterContext}`;
      }
      if (isSmallViewport) {
        return `${formattedTotal} ${summaryNoun} for "${committedQuery}"${compactFilterContext}`;
      }
      return `${formattedTotal} ${summaryNoun} for "${committedQuery}"${filterContext}`;
    }

    if (loadedCount < safeTotalCount) {
      if (isSmallViewport) return `${formattedLoaded} of ${formattedTotal} ${summaryNoun}${compactFilterContext}`;
      return `${formattedLoaded} of ${formattedTotal} ${summaryNoun}${filterContext}`;
    }

    if (isSmallViewport) {
      return compactFilterContext
        ? `${formattedTotal} ${summaryNoun}${compactFilterContext}`
        : `${formattedTotal} ${summaryNoun}`;
    }
    return filterContext ? `${formattedTotal} ${summaryNoun}${filterContext}` : `${formattedTotal} ${summaryNoun}`;
  }, [
    activeFilterCount,
    articlesError,
    committedQuery,
    summaryNoun,
    isSmallViewport,
    isCommittedSearch,
    isFeedRefetching,
    isLoadingArticles,
    loadedCount,
    numberFormatter,
    safeTotalCount,
  ]);

  /** Suppress duplicate success/rendered/zero when infinite scroll finishes (same committed search). */
  const suppressResultsTelemetryAfterAppendRef = useRef(false);

  /** Last committed query seen when emitting search_request_started (vs feed-only param changes). */
  const prevCommittedQueryForRequestTelemetryRef = useRef<string | null>(null);

  useEffect(() => {
    suppressResultsTelemetryAfterAppendRef.current = false;
  }, [committedQuery]);

  useEffect(() => {
    if (!isCommittedSearch) {
      prevCommittedQueryForRequestTelemetryRef.current = null;
    }
  }, [isCommittedSearch]);

  useEffect(() => {
    if (!isCommittedSearch) return;

    const prevQ = prevCommittedQueryForRequestTelemetryRef.current;
    const feedRefetchCause =
      prevQ !== committedQuery ? 'committed_query_changed' : 'feed_params_changed';
    prevCommittedQueryForRequestTelemetryRef.current = committedQuery;

    recordSearchEvent({
      name: 'search_request_started',
      payload: {
        query: committedQuery,
        surface: 'home-feed',
        feedRefetchCause,
      },
    });
  }, [
    isCommittedSearch,
    committedQuery,
    sortOrder,
    selectedTag,
    collectionId,
    activeCategory,
    selectedCategories,
    favorites,
    unread,
    formats,
    timeRange,
    formatTagIds,
    domainTagIds,
    subtopicTagIds,
    contentStream,
  ]);

  useEffect(() => {
    if (!isCommittedSearch || isLoadingArticles || isFeedRefetching) return;

    if (isFetchingNextPage) {
      suppressResultsTelemetryAfterAppendRef.current = true;
      return;
    }
    if (suppressResultsTelemetryAfterAppendRef.current) {
      suppressResultsTelemetryAfterAppendRef.current = false;
      return;
    }

    if (articlesError) {
      recordSearchEvent({
        name: 'search_request_failed',
        payload: { query: committedQuery, message: articlesError.message },
      });
      endActiveSearchDraft();
      return;
    }
    recordSearchEvent({
      name: 'search_request_succeeded',
      payload: { query: committedQuery, total: totalCount ?? 0 },
    });
    recordSearchEvent({
      name: 'search_results_rendered',
      payload: { query: committedQuery, total: totalCount ?? 0, visible: articles.length },
    });
    if ((totalCount ?? 0) === 0) {
      recordSearchEvent({
        name: 'search_zero_results',
        payload: {
          query: committedQuery,
          hasStructuralFilters,
        },
      });
    }
    endActiveSearchDraft();
    // Intentionally omit `articles.length`: infinite scroll appends must not re-fire
    // success/rendered/zero (handled via isFetchingNextPage + suppressResultsTelemetryAfterAppendRef).
  }, [
    isCommittedSearch,
    isLoadingArticles,
    isFeedRefetching,
    isFetchingNextPage,
    articlesError,
    committedQuery,
    totalCount,
    hasStructuralFilters,
  ]);

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
      {!isAuthenticated && <PublicHomeIntro isPulseStream={isPulseStream} />}
      {contentStream === 'pulse' ? <MarketPulseIntroBanner /> : <ValuePropStrip />}
      <div className="px-4 lg:px-6">
        <div
          className="mt-0.5 mb-2 text-[10.5px] leading-4 tabular-nums text-slate-500/90 dark:text-slate-400 sm:text-[11px]"
          role="status"
          aria-live="polite"
        >
          {resultSummaryText}
          {!isSmallViewport && sortLabel && safeTotalCount > 0 && ` · Sorted by ${sortLabel.toLowerCase()}`}
        </div>
        <ArticleGrid
          articles={articles}
          viewMode={viewMode}
          isLoading={isLoadingArticles}
          isFeedRefetching={isFeedRefetching}
          searchHighlightQuery={isCommittedSearch ? committedQuery : undefined}
          onArticleClick={(article) => {
            if (isCommittedSearch) {
              const rank = articles.findIndex((a) => a.id === article.id) + 1;
              recordSearchEvent({
                name: 'search_result_clicked',
                payload: {
                  query: committedQuery,
                  resultId: article.id,
                  rank: rank > 0 ? rank : undefined,
                  sourceType: article.source_type || null,
                },
              });
            }
            setSelectedArticle(article);
          }}
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
                <PageStack
                  suppressHeaderSpacer
                  categoryToolbar={categoryToolbarEl}
                  mainContent={feedMain}
                  contentTopSpacerClassName="h-1 shrink-0"
                />
              </div>
            </div>
          </>
        ) : (
          <PageStack
            categoryToolbar={categoryToolbarEl}
            mainContent={feedMain}
            contentTopSpacerClassName="h-1 shrink-0"
          />
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
