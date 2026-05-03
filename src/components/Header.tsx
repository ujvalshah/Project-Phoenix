// NOTE: Do not add multiple React imports in this file.
// Consolidate all hooks into the single import below.
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
  lazy,
  useLayoutEffect,
} from 'react';
import { Sparkles, LogOut, Settings, Shield, LogIn, User as UserIcon, BookOpen, Menu, LayoutGrid, Columns, Filter, ArrowUpDown, Maximize, Sun, Moon, Search, Mail, MoreHorizontal } from 'lucide-react';
import {
  HeaderSearchSlot,
  type HeaderDesktopSearchSlotHandle,
} from './header/HeaderSearchSlot';
import { HeaderMobileSearchSession } from './header/HeaderMobileSearchSession';
import { NotificationBell } from './NotificationBell';
import { Link, useLocation } from 'react-router-dom';
import { Avatar } from './shared/Avatar';
import { FilterPopover } from './header/FilterPopover';
import { useFilterPanelHandlers } from '@/hooks/useFilterPanelHandlers';
import { useDesktopFilterSidebar } from '@/context/DesktopFilterSidebarContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from 'lucide-react';
import { Z_INDEX } from '@/constants/zIndex';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { DropdownPortal } from './UI/DropdownPortal';
import { shallowEqual as shallowEqualFilters, useFilterSelector } from '@/context/FilterStateContext';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
import { isFeatureEnabled } from '@/constants/featureFlags';
import { useLegalPages } from '@/hooks/useLegalPages';
import { usePulseUnseenCount, useStandardUnseenCount } from '@/hooks/usePulseUnseen';
import { formatNavBadgeCount, hasNavBadge } from '@/utils/navBadge';
import { twMerge } from 'tailwind-merge';
import { useAppChromeScroll } from '@/context/AppChromeScrollContext';
import { setNarrowHeaderHidden } from '@/constants/layoutScrollBridge';
import { useFilterResults } from '@/context/FilterResultsContext';
import { recordSearchEvent } from '@/observability/telemetry';
import { takePendingSuggestionArticleId } from '@/observability/searchTelemetryIds';
import { normalizeSearchQuery } from '@/utils/searchQuery';
import {
  HEADER_PERF_SURFACES,
  headerPerfSurfaceTrigger,
} from '@/dev/perfMarks';
import { prefetchNavigationDrawerChunk } from '@/utils/headerChunkPrefetch';

const LazyMobileFilterSheet = lazy(() => import('./header/MobileFilterSheet'));
const LazyNavigationDrawer = lazy(() => import('./header/NavigationDrawer'));

/** Yellow “N” tile — matches NavigationDrawer / app favicon treatment */
const NuggetsLogoMark: React.FC<{ showName?: boolean }> = ({ showName }) => (
  <span className="flex items-center gap-2" title="Nuggets — The Knowledge App">
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-400 text-sm font-bold text-gray-900 shadow-sm"
      aria-hidden
    >
      N
    </span>
    {showName && (
      <span className="text-[17px] font-semibold tracking-tight text-gray-800 dark:text-slate-100" style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, system-ui, sans-serif" }}>
        Nuggets
      </span>
    )}
  </span>
);

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
  viewMode: 'grid' | 'masonry';
  setViewMode: (mode: 'grid' | 'masonry') => void;
  onCreateNugget: () => void;
}

/** Small legal links section for the user menu dropdown */
const UserMenuLegalLinks: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { enabledPages } = useLegalPages();
  if (enabledPages.length === 0) return null;
  return (
    <div className="border-t border-gray-100 px-4 py-2 dark:border-slate-700">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {enabledPages.map((page) => (
          <Link
            key={page.slug}
            to={`/legal/${page.slug}`}
            onClick={onClose}
            className="text-[11px] text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            {page.title}
          </Link>
        ))}
      </div>
    </div>
  );
};

const HeaderComponent: React.FC<HeaderProps> = ({
  onCreateNugget,
  sidebarOpen,
  setSidebarOpen,
  viewMode,
  setViewMode,
  isDark,
  toggleTheme,
}) => {
  // Consume filter state from context — no prop drilling required
  const filters = useFilterSelector(
    (s) => ({
      searchQuery: s.searchQuery,
      setSearchInput: s.setSearchInput,
      commitSearch: s.commitSearch,
      sortOrder: s.sortOrder,
      setSortOrder: s.setSortOrder,
      hasActiveFilters: s.hasActiveFilters,
      activeFilterCount: s.activeFilterCount,
      contentStream: s.contentStream,
      setContentStream: s.setContentStream,
    }),
    shallowEqualFilters,
  );
  const {
    searchQuery,
    setSearchInput: setSearchDraft,
    commitSearch,
    sortOrder,
    setSortOrder,
  } = filters;
  const { data: pulseUnseenCount } = usePulseUnseenCount();
  const { data: standardUnseenCount } = useStandardUnseenCount();
  const { narrowHeaderHidden } = useAppChromeScroll();
  const { resultCount } = useFilterResults();

  useEffect(() => {
    setNarrowHeaderHidden(narrowHeaderHidden);
    return () => setNarrowHeaderHidden(false);
  }, [narrowHeaderHidden]);

  // Dropdown state - managed by DropdownPortal
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [mobileFilterSheetEverOpened, setMobileFilterSheetEverOpened] = useState(false);
  const [navigationDrawerEverOpened, setNavigationDrawerEverOpened] = useState(false);
  const [mobileSearchSessionEverOpened, setMobileSearchSessionEverOpened] = useState(false);

  const { filterState, handleFilterChange, handleFilterClear } = useFilterPanelHandlers();

  const {
    isInlineDesktopFiltersActive,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
  } = useDesktopFilterSidebar();

  
  // Dropdown anchor refs - DropdownPortal handles positioning
  // Separate refs for desktop and mobile to avoid ref collision
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const mobileAvatarButtonRef = useRef<HTMLButtonElement>(null);
  // The desktop filter button is rendered twice: inside the xl+ search cluster
  // and inside the lg-to-xl tools cluster (xl:hidden). Both DOM nodes mount even
  // when CSS-hidden, so a single ref would be claimed by whichever rendered last
  // (the xl:hidden one), pointing the FilterPopover anchor at a display:none node
  // at xl+ widths. Use one ref per layout and pick by viewport.
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const lgFilterButtonRef = useRef<HTMLButtonElement>(null);
  const mobileFilterButtonRef = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const desktopSearchSlotRef = useRef<HeaderDesktopSearchSlotHandle>(null);

  // Sync initial viewport from window so the first paint matches breakpoint (avoids
  // treating mobile as desktop until the resize effect runs — breaks mobile filter
  // perf triggers and sheet gating on fast interactions).
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth;
    return w >= 768 && w < 1024;
  });
  // xl breakpoint (1280px) splits the two desktop filter button placements.
  const [isXl, setIsXl] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : false,
  );

  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
      setIsXl(window.innerWidth >= 1280); // xl breakpoint
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const mobileFilterSheetOpen = isFilterPopoverOpen && (isTablet || isMobile);
  const mobileFilterSheetMount = mobileFilterSheetEverOpened || mobileFilterSheetOpen;
  const navigationDrawerMount = navigationDrawerEverOpened || sidebarOpen;
  const mobileSearchSessionMount = mobileSearchSessionEverOpened || isMobileSearchOpen;

  useLayoutEffect(() => {
    if (mobileFilterSheetOpen) setMobileFilterSheetEverOpened(true);
  }, [mobileFilterSheetOpen]);

  useLayoutEffect(() => {
    if (sidebarOpen) setNavigationDrawerEverOpened(true);
  }, [sidebarOpen]);

  useLayoutEffect(() => {
    if (isMobileSearchOpen) setMobileSearchSessionEverOpened(true);
  }, [isMobileSearchOpen]);

  // Use the appropriate ref for the current viewport
  const activeAvatarRef = isMobile ? mobileAvatarButtonRef : avatarButtonRef;
  const activeFilterButtonRef = isXl ? filterButtonRef : lgFilterButtonRef;
  
  const location = useLocation();
  const { currentUser, isAuthenticated, openAuthModal, logout } = useAuthSelector(
    (a) => ({
      currentUser: a.user,
      isAuthenticated: a.isAuthenticated,
      openAuthModal: a.openAuthModal,
      logout: a.logout,
    }),
    shallowEqualAuth,
  );
  const currentUserId = currentUser?.id;
  const onPreloadNuggetModal = useCallback(() => {
    void import('@/components/createNuggetModalChunk.js').then((m) =>
      m.preloadCreateNuggetModalChunk({ userId: currentUserId ?? null }),
    );
  }, [currentUserId]);
  const headerToast = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * Single source of truth for logout UX. Wraps the async AuthContext logout
   * with a loading flag, toast feedback, and a hard reload on success so any
   * in-memory auth caches (React Query, context, lazy modules) are fully
   * reset. Hard reload also guarantees the browser has honored the server's
   * Set-Cookie clear headers before the next auth attempt.
   */
  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      headerToast.success('Signed out', 'You have been logged out.');
      // Hard reload to flush all in-memory state. Use a microtask delay so
      // the toast has a chance to mount before navigation.
      setTimeout(() => {
        window.location.assign('/');
      }, 150);
    } catch (error: any) {
      setIsLoggingOut(false);
      const message =
        typeof error?.message === 'string' && error.message
          ? error.message
          : 'Could not sign you out. Please try again.';
      headerToast.error('Sign out failed', message);
    }
  }, [isLoggingOut, logout, headerToast]);
  const { withAuth } = useRequireAuth();

  const isAdmin = currentUser?.role === 'admin';
  const currentPath = location.pathname;
  const isHome = currentPath === '/';
  const isCollections = currentPath === '/collections';
  const isBookmarks = currentPath === '/bookmarks';

  const inlineDesktopFilters = isHome && isInlineDesktopFiltersActive && !isMobile;

  const triggerMobileFilterPerfIfOpening = useCallback(() => {
    if ((isTablet || isMobile) && !isFilterPopoverOpen) {
      headerPerfSurfaceTrigger(HEADER_PERF_SURFACES.MOBILE_FILTER_SHEET);
    }
  }, [isTablet, isMobile, isFilterPopoverOpen]);

  // DropdownPortal handles positioning, scroll/resize updates, and click-outside detection
  // Only keyboard shortcuts need manual handling

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Save search to recent searches (localStorage only — the MobileSearchOverlay reads it)
  const saveRecentSearch = useCallback((query: string) => {
    if (typeof window === 'undefined') return;
    const trimmed = normalizeSearchQuery(query);
    if (!trimmed) return;
    try {
      const stored = localStorage.getItem('recent_searches');
      const prev: string[] = stored ? JSON.parse(stored) : [];
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 5);
      localStorage.setItem('recent_searches', JSON.stringify(updated));
    } catch {
      // localStorage may be full or disabled
    }
  }, []);

  // Handle search submit (Enter key or recent-search click)
  const handleSearchSubmit = useCallback((query: string, closeMobileOverlay = true) => {
    const trimmed = normalizeSearchQuery(query);
    const suggestionArticleId = takePendingSuggestionArticleId();
    if (trimmed) saveRecentSearch(trimmed);
    commitSearch(trimmed);
    setSearchDraft(trimmed);
    recordSearchEvent({
      name: 'search_submitted',
      payload: {
        query: trimmed,
        surface: closeMobileOverlay ? 'mobile-overlay' : 'desktop',
        ...(suggestionArticleId
          ? { suggestionArticleId, commitSource: 'suggestion_row' as const }
          : { commitSource: 'typed_submit' as const }),
      },
    });
    if (searchQuery && searchQuery !== trimmed) {
      recordSearchEvent({
        name: 'search_query_reformulated',
        payload: { from: searchQuery, to: trimmed },
      });
    }
    if (closeMobileOverlay) {
      setIsMobileSearchOpen(false);
    }
  }, [saveRecentSearch, commitSearch, setSearchDraft, searchQuery]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Search shortcut (⌘K / Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // On mobile, open search overlay; on desktop, focus search input
        if (window.innerWidth < 768) {
          recordSearchEvent({
            name: 'search_opened',
            payload: { surface: 'keyboard-shortcut', forceNewQueryTrace: true },
          });
          if (!isMobileSearchOpen) {
            headerPerfSurfaceTrigger(HEADER_PERF_SURFACES.MOBILE_SEARCH_OVERLAY);
          }
          setIsMobileSearchOpen(true);
        } else {
          desktopSearchSlotRef.current?.focus();
        }
      }
      // Escape to close dropdowns and mobile search
      if (e.key === 'Escape') {
        if (desktopSearchSlotRef.current?.isActiveForEscape()) {
          desktopSearchSlotRef.current.dismiss();
        } else if (isMobileSearchOpen) {
          setIsMobileSearchOpen(false);
        } else if (isSortOpen) setIsSortOpen(false);
        else if (isUserMenuOpen) setIsUserMenuOpen(false);
        else if (inlineDesktopFilters && !sidebarCollapsed) {
          setSidebarCollapsed(true);
        } else if (isFilterPopoverOpen) setIsFilterPopoverOpen(false);
        else if (isMoreMenuOpen) setIsMoreMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isSortOpen,
    isUserMenuOpen,
    isFilterPopoverOpen,
    isMobileSearchOpen,
    isMoreMenuOpen,
    inlineDesktopFilters,
    sidebarCollapsed,
    setSidebarCollapsed,
  ]);

  // Use global filter hook as single source of truth for active filter state
  const hasActiveFilters = filters.hasActiveFilters;
  const activeFilterCount = filters.activeFilterCount;

  const desktopSearchTrailingToolbar = useMemo(
    () => (
      <>
        <button
          ref={filterButtonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (inlineDesktopFilters) {
              toggleSidebarCollapsed();
            } else {
              triggerMobileFilterPerfIfOpening();
              setIsFilterPopoverOpen((o) => !o);
            }
          }}
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 ${
            (inlineDesktopFilters ? !sidebarCollapsed : isFilterPopoverOpen) || hasActiveFilters
              ? 'bg-yellow-50 text-yellow-500 dark:bg-yellow-950/40 dark:text-yellow-400'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'
          }`}
          aria-label="Filter"
          title="Filter"
          aria-expanded={inlineDesktopFilters ? !sidebarCollapsed : isFilterPopoverOpen}
        >
          <Filter
            size={16}
            fill={
              (inlineDesktopFilters ? !sidebarCollapsed : isFilterPopoverOpen) || hasActiveFilters
                ? 'currentColor'
                : 'none'
            }
          />
          {hasActiveFilters && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-gray-500 px-0.5 text-[9px] font-medium text-white dark:bg-slate-500">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          ref={sortButtonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsSortOpen((o) => !o);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-1 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 dark:focus-visible:ring-offset-slate-900"
          aria-label="Sort"
          title="Sort"
        >
          <ArrowUpDown size={16} />
        </button>
      </>
    ),
    [
      activeFilterCount,
      hasActiveFilters,
      inlineDesktopFilters,
      isFilterPopoverOpen,
      sidebarCollapsed,
      toggleSidebarCollapsed,
      triggerMobileFilterPerfIfOpening,
    ],
  );

  return (
    <>
      {/* Glass header — fixed (layout invariant); z-50 via Z_INDEX.HEADER */}
      <header
        className={twMerge(
          'fixed left-0 right-0 top-0 w-full border-b border-gray-200 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-[transform,opacity] duration-300 ease-out will-change-transform dark:border-slate-800 dark:bg-slate-900/80',
          LAYOUT_CLASSES.HEADER_HEIGHT,
          narrowHeaderHidden && 'pointer-events-none -translate-y-full opacity-0',
        )}
        style={{ zIndex: Z_INDEX.HEADER }}
      >
        {/* Desktop Layout (lg+) - resilient priority layout */}
        <div className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} h-full hidden lg:flex items-center gap-3 min-w-0`}>
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onPointerEnter={prefetchNavigationDrawerChunk}
              onPointerDown={prefetchNavigationDrawerChunk}
              onFocus={prefetchNavigationDrawerChunk}
              onClick={() => {
                if (!sidebarOpen) {
                  headerPerfSurfaceTrigger(HEADER_PERF_SURFACES.NAV_DRAWER);
                }
                setSidebarOpen(true);
              }}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Open Menu"
            >
              <Menu size={18} aria-hidden />
            </button>

            <Link
              to="/"
              className="shrink-0"
              aria-label="Nuggets"
              onClick={() => filters.setContentStream('standard')}
            >
              <NuggetsLogoMark showName />
            </Link>

          </div>

          {/* Center: content-width primary nav + flexible search (nav must not flex-grow) */}
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {/* Desktop primary nav — width hugs tabs; horizontal scroll only if many tabs / tight width */}
            <div className="relative max-w-full shrink-0 min-w-0">
            <nav
                className="no-scrollbar-visual hidden w-max max-w-full min-w-0 gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-gray-200/80 bg-gray-100 p-1 [scroll-padding-inline:0.75rem] dark:border-slate-700/80 dark:bg-slate-800/90 lg:flex"
              role="navigation"
              aria-label="Main navigation"
            >
              {/* REGRESSION CHECK: Header nav labels must be text-sm (14px) font-medium - do not change */}
              <Link
                to="/"
                onClick={() => filters.setContentStream('standard')}
                className={`flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                  isHome && filters.contentStream === 'standard'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                    : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                aria-current={isHome && filters.contentStream === 'standard' ? 'page' : undefined}
              >
                Nuggets
                {hasNavBadge(standardUnseenCount) && (
                  <span
                    className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary-500 text-gray-900 text-[10px] font-normal leading-none"
                    aria-label={`${formatNavBadgeCount(standardUnseenCount)} unseen Nuggets updates`}
                  >
                    {formatNavBadgeCount(standardUnseenCount)}
                  </span>
                )}
              </Link>
              {isFeatureEnabled('MARKET_PULSE') && (
                <Link
                  to="/"
                  onClick={() => filters.setContentStream('pulse')}
                  className={`flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                    isHome && filters.contentStream === 'pulse'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                      : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                  aria-current={isHome && filters.contentStream === 'pulse' ? 'page' : undefined}
                >
                  Market Pulse
                  {hasNavBadge(pulseUnseenCount) && (
                    <span
                      className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-normal leading-none"
                      aria-label={`${formatNavBadgeCount(pulseUnseenCount)} unseen Market Pulse updates`}
                    >
                      {formatNavBadgeCount(pulseUnseenCount)}
                    </span>
                  )}
                </Link>
              )}
              <Link
                to="/collections"
                className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                  isCollections
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                    : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                aria-current={isCollections ? 'page' : undefined}
              >
                Collections
              </Link>
              {isAuthenticated && (
                <Link
                  to={`/profile/${currentUser?.id || ''}`}
                  className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                    currentPath.includes('/profile') || currentPath === '/myspace'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                      : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                  aria-current={(currentPath.includes('/profile') || currentPath === '/myspace') ? 'page' : undefined}
                >
                  Workspace
                </Link>
              )}
              {isAuthenticated && (
                <Link
                  to="/bookmarks"
                  className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                    isBookmarks
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                      : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                  aria-current={isBookmarks ? 'page' : undefined}
                >
                  Bookmarks
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                    currentPath.startsWith('/admin')
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                      : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                  aria-current={currentPath.startsWith('/admin') ? 'page' : undefined}
                >
                  Admin
                </Link>
              )}
            </nav>
            </div>

            {/* Search — grows into space between nav and right cluster (xl+); min width keeps field usable */}
            <div className="hidden min-w-0 flex-1 basis-0 items-stretch xl:flex">
              <HeaderSearchSlot
                ref={desktopSearchSlotRef}
                committedSearchQuery={searchQuery}
                onSearchSubmit={handleSearchSubmit}
                trailingToolbar={desktopSearchTrailingToolbar}
              />
            </div>

          {/* Right: Tools Cluster - Desktop */}
          <div className="flex items-center justify-end gap-1.5 min-w-0 shrink-0">
                <button
              type="button"
              onClick={() => {
                recordSearchEvent({
                  name: 'search_opened',
                  payload: { surface: 'desktop-trigger', forceNewQueryTrace: true },
                });
                if (!isMobileSearchOpen) {
                  headerPerfSurfaceTrigger(HEADER_PERF_SURFACES.MOBILE_SEARCH_OVERLAY);
                }
                setIsMobileSearchOpen(true);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 xl:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Search"
              title="Search"
            >
              <Search size={18} aria-hidden />
            </button>

            <button
              type="button"
              ref={lgFilterButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                if (inlineDesktopFilters) {
                  toggleSidebarCollapsed();
                } else {
                  triggerMobileFilterPerfIfOpening();
                  setIsFilterPopoverOpen(!isFilterPopoverOpen);
                }
              }}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all xl:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 ${
                (inlineDesktopFilters ? !sidebarCollapsed : isFilterPopoverOpen) || hasActiveFilters
                  ? 'bg-yellow-50 text-yellow-500 dark:bg-yellow-950/40 dark:text-yellow-400'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
              aria-label="Filter"
              title="Filter"
              aria-expanded={inlineDesktopFilters ? !sidebarCollapsed : isFilterPopoverOpen}
            >
              <Filter
                size={16}
                fill={
                  (inlineDesktopFilters ? !sidebarCollapsed : isFilterPopoverOpen) || hasActiveFilters
                    ? 'currentColor'
                    : 'none'
                }
              />
              {hasActiveFilters && (
                <span className="absolute right-1 top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-gray-500 px-0.5 text-[8px] font-medium text-white dark:bg-slate-500">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              type="button"
              ref={sortButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                setIsSortOpen((o) => !o);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 xl:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Sort"
              title="Sort"
            >
              <ArrowUpDown size={16} />
            </button>

            {/* Create button — preload editor chunk on intent (hover / press) before click */}
            <button
              type="button"
              data-testid="create-nugget-button"
              onPointerEnter={onPreloadNuggetModal}
              onPointerDown={onPreloadNuggetModal}
              onClick={withAuth(onCreateNugget)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors dark:text-slate-200 dark:hover:text-white"
              aria-label="Create Nugget"
            >
              <Sparkles size={16} strokeWidth={2.5} className="text-yellow-500" fill="currentColor" />
            </button>

            {/* View mode buttons - Desktop only (lg+) */}
            <div className="hidden xl:flex items-center rounded-lg border border-gray-200/80 bg-gray-100 p-1 dark:border-slate-700/80 dark:bg-slate-800/90">
              <button
                onClick={() => setViewMode('grid')}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                    : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                title="Grid View"
                aria-label="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('masonry')}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded transition-all ${
                  viewMode === 'masonry'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                    : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                title="Masonry View"
                aria-label="Masonry View"
              >
                <Columns size={16} />
              </button>
            </div>

            {/* Fullscreen button */}
            <button
              onClick={toggleFullScreen}
              className="hidden xl:flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-gray-500 hover:text-gray-700 transition-colors dark:text-slate-400 dark:hover:text-slate-200"
              title="Toggle Fullscreen"
              aria-label="Toggle Fullscreen"
            >
              <Maximize size={16} />
            </button>

            {/* Notification Bell */}
            <NotificationBell
              bellIconSize={18}
              buttonClassName="rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="hidden xl:flex min-h-[44px] min-w-[44px] items-center justify-center p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              ref={moreMenuButtonRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMoreMenuOpen(!isMoreMenuOpen);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 xl:hidden"
              aria-label="More actions"
              title="More actions"
              aria-expanded={isMoreMenuOpen}
            >
              <MoreHorizontal size={18} />
            </button>

            {/* Avatar/Login */}
            {isAuthenticated ? (
              <button
                ref={avatarButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                className="p-0.5 rounded-full border-2 border-transparent hover:border-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:border-slate-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="User menu"
                aria-expanded={isUserMenuOpen}
              >
                <Avatar 
                  name={currentUser?.name || 'User'} 
                  src={currentUser?.avatarUrl}
                  size="md"
                  className="w-8 h-8"
                />
              </button>
            ) : (
              <button
                onClick={() => openAuthModal('login')}
                className="min-h-[44px] min-w-[44px] p-2 text-sm font-medium bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors flex items-center justify-center dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                aria-label="Sign In"
              >
                <LogIn size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
        </div>
        </div>

        {/* Mobile/Tablet (<lg): single row — menu + logo | search, filter, theme, bell, profile (extra view/theme in drawer) */}
        <div
          className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} flex h-full min-h-0 items-center justify-between gap-3 lg:hidden`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onPointerEnter={prefetchNavigationDrawerChunk}
              onPointerDown={prefetchNavigationDrawerChunk}
              onFocus={prefetchNavigationDrawerChunk}
              onClick={() => {
                if (!sidebarOpen) {
                  headerPerfSurfaceTrigger(HEADER_PERF_SURFACES.NAV_DRAWER);
                }
                setSidebarOpen(true);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Open Menu"
            >
              <Menu size={18} strokeWidth={2} aria-hidden />
            </button>
            <Link
              to="/"
              className="flex shrink-0 items-center"
              aria-label="Nuggets"
              onClick={() => filters.setContentStream('standard')}
            >
              <NuggetsLogoMark />
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                recordSearchEvent({
                  name: 'search_opened',
                  payload: { surface: 'mobile-header', forceNewQueryTrace: true },
                });
                if (!isMobileSearchOpen) {
                  headerPerfSurfaceTrigger(HEADER_PERF_SURFACES.MOBILE_SEARCH_OVERLAY);
                }
                setIsMobileSearchOpen(true);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Search"
            >
              <Search size={18} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              ref={mobileFilterButtonRef}
              data-testid="header-mobile-filter-button"
              onClick={(e) => {
                e.stopPropagation();
                triggerMobileFilterPerfIfOpening();
                setIsFilterPopoverOpen(!isFilterPopoverOpen);
              }}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                isFilterPopoverOpen || hasActiveFilters
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
              aria-label={`Filter${hasActiveFilters ? ` (${activeFilterCount} active)` : ''}`}
              title="Filter"
            >
              <Filter
                size={18}
                strokeWidth={2}
                fill={isFilterPopoverOpen || hasActiveFilters ? 'currentColor' : 'none'}
                aria-hidden
              />
              {hasActiveFilters && (
                <span className="absolute right-1 top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-primary-500 px-0.5 text-[7px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={18} strokeWidth={2} aria-hidden /> : <Moon size={18} strokeWidth={2} aria-hidden />}
            </button>
            <NotificationBell
              bellIconSize={18}
              buttonClassName="flex h-10 w-10 min-h-0 min-w-0 items-center justify-center rounded-full p-0 hover:bg-gray-100 dark:hover:bg-slate-800"
            />
            {isAuthenticated ? (
              <button
                type="button"
                ref={mobileAvatarButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                className="flex h-10 w-10 min-h-0 min-w-0 items-center justify-center rounded-full border-2 border-transparent p-0 transition-colors hover:border-gray-300 hover:bg-gray-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                aria-label="User menu"
                aria-expanded={isUserMenuOpen}
              >
                <Avatar
                  name={currentUser?.name || 'User'}
                  src={currentUser?.avatarUrl}
                  size="md"
                  className="h-8 w-8"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white shadow-sm transition-colors hover:bg-gray-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                aria-label="Sign In"
              >
                <LogIn size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Filter chips are now rendered inline inside CategoryToolbar — no separate bar */}

      {/* Avatar Menu - uses DropdownPortal for positioning and click-outside */}
      <DropdownPortal
        isOpen={isUserMenuOpen}
        anchorRef={activeAvatarRef}
        onClickOutside={() => setIsUserMenuOpen(false)}
        className="w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        {/* User Info */}
        <div className="border-b border-gray-100 px-4 py-3 dark:border-slate-700">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
            {currentUser?.name}
          </p>
          {currentUser?.email && (
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-slate-400">
              {currentUser.email}
            </p>
          )}
        </div>

        {/* Menu Items */}
        <div className="py-1">
          <Link
            to={`/profile/${currentUser?.id || ''}`}
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <UserIcon size={16} />
            Workspace
          </Link>
          <Link
            to="/bookmarks"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <BookOpen size={16} />
            Bookmarks
          </Link>
          <Link
            to="/account"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Settings size={16} />
            Settings
          </Link>
          <Link
            to="/contact"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Mail size={16} />
            Contact Us
          </Link>
          {isAdmin && (
            <>
              <div className="my-1 h-px bg-gray-100 dark:bg-slate-700" />
              <Link
                to="/admin"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Shield size={16} />
                Admin Panel
              </Link>
            </>
          )}
        </div>

        {/* Logout */}
        <div className="border-t border-gray-100 py-1 dark:border-slate-700">
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsUserMenuOpen(false);
              await handleLogout();
            }}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            {isLoggingOut ? 'Signing out…' : 'Log Out'}
          </button>
        </div>

        {/* Legal Links */}
        <UserMenuLegalLinks onClose={() => setIsUserMenuOpen(false)} />
      </DropdownPortal>

      {/* Filter Popover - Desktop (lg+) - mega dropdown */}
      <DropdownPortal
        isOpen={
          isFilterPopoverOpen &&
          !isTablet &&
          !isMobile &&
          !(isHome && isInlineDesktopFiltersActive)
        }
        anchorRef={activeFilterButtonRef}
        onClickOutside={() => setIsFilterPopoverOpen(false)}
        className=""
      >
        <FilterPopover
          filters={filterState}
          onChange={handleFilterChange}
          onClear={handleFilterClear}
          resultCount={resultCount}
        />
      </DropdownPortal>

      {/* Sort Dropdown - uses DropdownPortal */}
      <DropdownPortal
        isOpen={isSortOpen}
        anchorRef={sortButtonRef}
        onClickOutside={() => setIsSortOpen(false)}
        className="w-40 overflow-hidden rounded-lg border border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-900"
      >
        {([
          { value: 'latest' as const, label: 'Latest' },
          { value: 'oldest' as const, label: 'Oldest' },
        ]).map(opt => (
          <button
            key={opt.value}
            onClick={() => { setSortOrder(opt.value); setIsSortOpen(false); }}
            className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800 ${
              sortOrder === opt.value ? 'bg-gray-50 dark:bg-slate-800' : ''
            }`}
            aria-label={`Sort by ${opt.label}`}
          >
            {opt.label}
          </button>
        ))}
      </DropdownPortal>

      {/* Tablet More Menu - uses DropdownPortal */}
      <DropdownPortal
        isOpen={isMoreMenuOpen}
        anchorRef={moreMenuButtonRef}
        onClickOutside={() => setIsMoreMenuOpen(false)}
        className="w-48 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="py-1">
          {isAuthenticated && (
            <Link
              to={`/profile/${currentUser?.id || ''}`}
              onClick={() => setIsMoreMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 ${
                currentPath.includes('/profile') || currentPath === '/myspace'
                  ? 'bg-gray-50 text-gray-900 dark:bg-slate-800 dark:text-slate-50'
                  : 'text-gray-700 dark:text-slate-200'
              }`}
            >
              <UserIcon size={16} />
              Workspace
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setIsMoreMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 ${
                currentPath.startsWith('/admin')
                  ? 'bg-gray-50 text-gray-900 dark:bg-slate-800 dark:text-slate-50'
                  : 'text-gray-700 dark:text-slate-200'
              }`}
            >
              <Shield size={16} />
              Admin
            </Link>
          )}
          <div className="my-1 h-px bg-gray-100 dark:bg-slate-700" />
          <button
            type="button"
            onClick={() => {
              setViewMode('grid');
              setIsMoreMenuOpen(false);
            }}
            className={`flex w-full items-center gap-3 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 ${
              viewMode === 'grid'
                ? 'bg-gray-50 text-gray-900 dark:bg-slate-800 dark:text-slate-50'
                : 'text-gray-700 dark:text-slate-200'
            }`}
          >
            <LayoutGrid size={16} />
            Grid view
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('masonry');
              setIsMoreMenuOpen(false);
            }}
            className={`flex w-full items-center gap-3 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 ${
              viewMode === 'masonry'
                ? 'bg-gray-50 text-gray-900 dark:bg-slate-800 dark:text-slate-50'
                : 'text-gray-700 dark:text-slate-200'
            }`}
          >
            <Columns size={16} />
            Masonry view
          </button>
          <button
            type="button"
            onClick={() => {
              toggleFullScreen();
              setIsMoreMenuOpen(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Maximize size={16} />
            Fullscreen
          </button>
          <button
            type="button"
            onClick={() => {
              toggleTheme();
              setIsMoreMenuOpen(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            Toggle theme
          </button>
        </div>
      </DropdownPortal>

      {/* Tablet/Mobile filter sheet — lazy chunk + mount after first open */}
      {mobileFilterSheetMount && (
        <Suspense fallback={null}>
          <LazyMobileFilterSheet
            isOpen={mobileFilterSheetOpen}
            filters={filterState}
            onChange={handleFilterChange}
            onClearAll={handleFilterClear}
            onClose={() => setIsFilterPopoverOpen(false)}
            triggerRef={mobileFilterButtonRef}
            resultCount={resultCount}
          />
        </Suspense>
      )}

      {mobileSearchSessionMount && (
        <HeaderMobileSearchSession
          isOpen={isMobileSearchOpen}
          onRequestClose={() => setIsMobileSearchOpen(false)}
          onSearchSubmit={handleSearchSubmit}
        />
      )}

      {navigationDrawerMount && (
        <Suspense fallback={null}>
          <LazyNavigationDrawer
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            isAuthenticated={isAuthenticated}
            currentUser={currentUser}
            isAdmin={isAdmin}
            logout={handleLogout}
            isLoggingOut={isLoggingOut}
            openAuthModal={() => openAuthModal('login')}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />
        </Suspense>
      )}
    </>
  );
};

HeaderComponent.displayName = 'Header';

export const Header = React.memo(HeaderComponent);
