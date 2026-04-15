// NOTE: Do not add multiple React imports in this file.
// Consolidate all hooks into the single import below.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, LogOut, Settings, Shield, LogIn, User as UserIcon, BookOpen, MessageSquare, Menu, X, LayoutGrid, Columns, Filter, ArrowUpDown, Maximize, Sun, Moon, Send, CheckCircle2, Search, Mail } from 'lucide-react';
import { SearchInput, SearchInputHandle } from './header/SearchInput';
import { MobileSearchOverlay } from './header/MobileSearchOverlay';
import { NotificationBell } from './NotificationBell';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom'; // Still needed for NavigationDrawer
import { Avatar } from './shared/Avatar';
import { FilterPopover } from './header/FilterPopover';
import { useFilterPanelHandlers } from '@/hooks/useFilterPanelHandlers';
import { useDesktopFilterSidebar } from '@/context/DesktopFilterSidebarContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from 'lucide-react';
import { adminFeedbackService } from '@/admin/services/adminFeedbackService';
import { Z_INDEX } from '@/constants/zIndex';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { getOverlayHost } from '@/utils/overlayHosts';
import { DropdownPortal } from './UI/DropdownPortal';
import { shallowEqual as shallowEqualFilters, useFilterSelector } from '@/context/FilterStateContext';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
import { isFeatureEnabled } from '@/constants/featureFlags';
import { useLegalPages } from '@/hooks/useLegalPages';
import { usePulseUnseenCount, useStandardUnseenCount } from '@/hooks/usePulseUnseen';
import { twMerge } from 'tailwind-merge';
import { useAppChromeScroll } from '@/context/AppChromeScrollContext';
import { setNarrowHeaderHidden } from '@/constants/layoutScrollBridge';
import MobileFilterSheet from './header/MobileFilterSheet';
import { useFilterResults } from '@/context/FilterResultsContext';

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

export const Header: React.FC<HeaderProps> = ({
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
      searchInputValue: s.searchInputValue,
      setSearchInput: s.setSearchInput,
      sortOrder: s.sortOrder,
      setSortOrder: s.setSortOrder,
      hasActiveFilters: s.hasActiveFilters,
      activeFilterCount: s.activeFilterCount,
      contentStream: s.contentStream,
      setContentStream: s.setContentStream,
    }),
    shallowEqualFilters,
  );
  const { searchInputValue: searchQuery, setSearchInput: setSearchQuery, sortOrder, setSortOrder } = filters;
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
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const mobileFilterButtonRef = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const desktopSearchRef = useRef<SearchInputHandle>(null);

  // Determine which avatar ref to use based on viewport width
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Use the appropriate ref for the current viewport
  const activeAvatarRef = isMobile ? mobileAvatarButtonRef : avatarButtonRef;
  
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
    if (!query.trim() || typeof window === 'undefined') return;
    const trimmed = query.trim();
    try {
      const stored = localStorage.getItem('recent_searches');
      const prev: string[] = stored ? JSON.parse(stored) : [];
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 5);
      localStorage.setItem('recent_searches', JSON.stringify(updated));
    } catch {
      // localStorage may be full or disabled
    }
  }, []);

  // Stable callback: SearchInput calls this after its internal debounce.
  // This propagates the trimmed value up to useFilterState (which triggers the API query).
  const handleDebouncedSearch = useCallback((value: string) => {
    setSearchQuery(value);
  }, [setSearchQuery]);

  // Handle search submit (Enter key or recent-search click)
  const handleSearchSubmit = useCallback((query: string, closeMobileOverlay = true) => {
    if (query.trim()) {
      saveRecentSearch(query);
      setSearchQuery(query.trim());
    }
    if (closeMobileOverlay) {
      setIsMobileSearchOpen(false);
    }
  }, [saveRecentSearch, setSearchQuery]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Search shortcut (⌘K / Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // On mobile, open search overlay; on desktop, focus search input
        if (window.innerWidth < 768) {
          setIsMobileSearchOpen(true);
        } else {
          desktopSearchRef.current?.focus();
        }
      }
      // Escape to close dropdowns and mobile search
      if (e.key === 'Escape') {
        if (isMobileSearchOpen) {
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

  // Track window size for tablet detection
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkTablet = () => {
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    checkTablet();
    window.addEventListener('resize', checkTablet);
    return () => window.removeEventListener('resize', checkTablet);
  }, []);

  return (
    <>
      {/* Glass header — fixed (layout invariant); z-50 via Z_INDEX.HEADER */}
      <header
        className={twMerge(
          'fixed left-0 right-0 top-0 w-full border-b border-gray-200 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-[transform,opacity,background-color,border-color] duration-300 ease-out will-change-transform dark:border-slate-800 dark:bg-slate-900/80',
          LAYOUT_CLASSES.HEADER_HEIGHT,
          narrowHeaderHidden &&
            'pointer-events-none -translate-y-full border-transparent bg-transparent opacity-0 backdrop-blur-none dark:bg-transparent',
        )}
        style={{ zIndex: Z_INDEX.HEADER }}
      >
        {/* Desktop Layout (lg+) - Original layout preserved */}
        <div className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} h-full hidden lg:flex items-center gap-3 min-w-0`}>
          {/* Left: Menu + Logo + Navigation */}
          <div className="flex items-center gap-3 min-w-0 shrink">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Open Menu"
            >
              <Menu size={18} aria-hidden />
            </button>

            <Link
              to="/"
              className="shrink-0"
              aria-label="Home"
              onClick={() => filters.setContentStream('standard')}
            >
              <NuggetsLogoMark showName />
            </Link>

            {/* Desktop Navigation (lg+) */}
            <nav
              className="rounded-lg border border-gray-200/80 bg-gray-100 p-1 hidden lg:flex gap-1 overflow-x-auto min-w-0 shrink dark:border-slate-700/80 dark:bg-slate-800/90"
              role="navigation"
              aria-label="Main navigation"
            >
              {/* REGRESSION CHECK: Header nav labels must be text-sm (14px) font-medium - do not change */}
              <Link
                to="/"
                onClick={() => filters.setContentStream('standard')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 ${
                  isHome && filters.contentStream === 'standard'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                    : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
                aria-current={isHome && filters.contentStream === 'standard' ? 'page' : undefined}
              >
                Home
                {standardUnseenCount != null && standardUnseenCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary-500 text-gray-900 text-[10px] font-normal leading-none"
                    aria-label={`${standardUnseenCount > 99 ? '99+' : standardUnseenCount} unseen Home updates`}
                  >
                    {standardUnseenCount > 99 ? '99+' : standardUnseenCount}
                  </span>
                )}
              </Link>
              {isFeatureEnabled('MARKET_PULSE') && (
                <Link
                  to="/"
                  onClick={() => filters.setContentStream('pulse')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 ${
                    isHome && filters.contentStream === 'pulse'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                      : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                  aria-current={isHome && filters.contentStream === 'pulse' ? 'page' : undefined}
                >
                  Market Pulse
                  {pulseUnseenCount != null && pulseUnseenCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-normal leading-none"
                      aria-label={`${pulseUnseenCount > 99 ? '99+' : pulseUnseenCount} unseen Market Pulse updates`}
                    >
                      {pulseUnseenCount > 99 ? '99+' : pulseUnseenCount}
                    </span>
                  )}
                </Link>
              )}
              <Link
                to="/collections"
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 ${
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
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 ${
                    currentPath.includes('/profile') || currentPath === '/myspace'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 dark:shadow-none'
                      : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                  aria-current={(currentPath.includes('/profile') || currentPath === '/myspace') ? 'page' : undefined}
                >
                  Library
                </Link>
              )}
              {isAuthenticated && (
                <Link
                  to="/bookmarks"
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 ${
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
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 ${
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

          {/* Center: Search - Desktop (lg+) */}
          <div className="hidden lg:flex flex-1 items-center justify-center min-w-0">
            <div className="relative w-full max-w-2xl min-w-0">
              <SearchInput
                ref={desktopSearchRef}
                initialValue={searchQuery}
                onSearch={handleDebouncedSearch}
                onSubmit={(q) => handleSearchSubmit(q, false)}
                placeholder="Search..."
                showClearButton={false}
                className="w-full"
                inputClassName="w-full h-9 pl-10 pr-28 text-sm font-medium bg-gray-50 border border-gray-100 rounded-lg text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-yellow-400 focus:bg-white focus:outline-none transition-all dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-yellow-500/50"
                iconSize={16}
              />

              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                <button
                  ref={filterButtonRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inlineDesktopFilters) {
                      toggleSidebarCollapsed();
                    } else {
                      setIsFilterPopoverOpen(!isFilterPopoverOpen);
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
                    setIsSortOpen(!isSortOpen);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-1 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 dark:focus-visible:ring-offset-slate-900"
                  aria-label="Sort"
                  title="Sort"
                >
                  <ArrowUpDown size={16} />
                </button>
              </div>
            </div>
          </div>


          {/* Right: Tools Cluster - Desktop */}
          <div className="flex items-center justify-end gap-2 min-w-0 shrink-0">
            {/* Create button */}
            <button
              onClick={withAuth(onCreateNugget)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors dark:text-slate-200 dark:hover:text-white"
              aria-label="Create Nugget"
            >
              <Sparkles size={16} strokeWidth={2.5} className="text-yellow-500" fill="currentColor" />
            </button>

            {/* View mode buttons - Desktop only (lg+) */}
            <div className="flex items-center rounded-lg border border-gray-200/80 bg-gray-100 p-1 dark:border-slate-700/80 dark:bg-slate-800/90">
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
              className="min-h-[44px] min-w-[44px] items-center justify-center p-2 text-gray-500 hover:text-gray-700 transition-colors flex dark:text-slate-400 dark:hover:text-slate-200"
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
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

        {/* Mobile/Tablet (<lg): single row — menu + logo | search, filter, theme, bell, profile (extra view/theme in drawer) */}
        <div
          className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} flex h-full min-h-0 items-center justify-between gap-3 lg:hidden`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Open Menu"
            >
              <Menu size={18} strokeWidth={2} aria-hidden />
            </button>
            <Link
              to="/"
              className="flex shrink-0 items-center"
              aria-label="Home"
              onClick={() => filters.setContentStream('standard')}
            >
              <NuggetsLogoMark />
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Search"
            >
              <Search size={18} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              ref={mobileFilterButtonRef}
              onClick={(e) => {
                e.stopPropagation();
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
            Library
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
        anchorRef={filterButtonRef}
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
              Library
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
        </div>
      </DropdownPortal>

      {/* Tablet/Mobile filter sheet */}
      <MobileFilterSheet
        isOpen={isFilterPopoverOpen && (isTablet || isMobile)}
        filters={filterState}
        onChange={handleFilterChange}
        onClearAll={handleFilterClear}
        onClose={() => setIsFilterPopoverOpen(false)}
        triggerRef={mobileFilterButtonRef}
        resultCount={resultCount}
      />

      {/* Mobile Search Overlay — extracted to its own component */}
      <MobileSearchOverlay
        isOpen={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
        initialValue={searchQuery}
        onSearch={handleDebouncedSearch}
      />

      <NavigationDrawer
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
    </>
  );
};

// --- Internal Feedback Form Component ---
interface DrawerFeedbackFormProps {
  isAuthenticated: boolean;
  currentUser?: { id?: string; name?: string; email?: string; avatarUrl?: string } | null;
}

const DrawerFeedbackForm: React.FC<DrawerFeedbackFormProps> = ({ isAuthenticated, currentUser }) => {
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!feedback.trim()) return;
    
    setIsSending(true);
    try {
      const feedbackUser =
        currentUser?.id && currentUser?.name
          ? {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
              avatarUrl: currentUser.avatarUrl,
            }
          : undefined;

      await adminFeedbackService.submitFeedback(
        feedback.trim(),
        'general',
        feedbackUser,
        !feedbackUser ? email : undefined
      );
      
      setSent(true);
      toast.success('Feedback sent!');
      
      setTimeout(() => {
          setSent(false);
          setFeedback('');
          setEmail('');
      }, 3000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
      return (
        <div className="mx-3 my-2 flex h-32 items-center justify-center gap-2 rounded-xl border border-green-100 bg-green-50 p-4 text-center text-xs font-bold text-green-600 animate-in fade-in dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
           <CheckCircle2 size={24} />
           <div>
             Thanks for your thoughts! <br/> We read every message.
           </div>
        </div>
      );
  }

  return (
    <div
      className="mx-3 my-4 rounded-xl border border-yellow-100/50 bg-yellow-50/40 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/25"
      onClick={(e) => e.stopPropagation()}
    >
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:text-amber-200/90">
            <MessageSquare size={12} className="text-yellow-500 dark:text-amber-400" /> Feedback
        </p>
        <p className="mb-3 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
            Have an idea? Send suggestions directly to us.
        </p>
        <form onSubmit={handleSubmit} className="space-y-2">
            <textarea 
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="I wish this app had..."
                className="h-24 w-full cursor-text resize-none rounded-xl border border-yellow-100 bg-white p-3 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-amber-500/40"
                onKeyDown={(e) => e.stopPropagation()}
            />
            {!isAuthenticated && (
                <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email (optional)"
                    className="w-full rounded-xl border border-yellow-100 bg-white p-2.5 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-amber-500/40"
                    onKeyDown={(e) => e.stopPropagation()}
                />
            )}
            <button 
                type="submit"
                disabled={!feedback.trim() || isSending}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-200 bg-yellow-100 py-2 text-xs font-bold text-yellow-900 shadow-sm transition-all hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/60 dark:bg-amber-900/35 dark:text-amber-100 dark:hover:bg-amber-900/55"
                onClick={(e) => e.stopPropagation()}
            >
                {isSending ? 'Sending...' : <><Send size={12} /> Send</>}
            </button>
        </form>
    </div>
  );
};

// --- Navigation Drawer Component ---
interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  currentUser: { id?: string; name?: string; email?: string; avatarUrl?: string } | null | undefined;
  isAdmin: boolean;
  logout: () => Promise<void> | void;
  isLoggingOut: boolean;
  openAuthModal: () => void;
  viewMode: 'grid' | 'masonry';
  setViewMode: (mode: 'grid' | 'masonry') => void;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  currentUser,
  isAdmin,
  logout,
  isLoggingOut,
  openAuthModal,
  viewMode,
  setViewMode,
}) => {
  // Two booleans replace the previous 4-state machine:
  //   • isMounted — controls portal lifetime (delayed unmount for exit anim)
  //   • isVisible — controls data-state; flipped one frame after mount so the
  //                 enter transition actually has a starting state to leave from
  // All visual styling is `data-state` driven, including motion-reduce.
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const drawerRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    // Fallback unmount: transitionend will not fire under prefers-reduced-motion
    // (transition-none), so guarantee cleanup on a matching timeout.
    const t = window.setTimeout(() => setIsMounted(false), 250);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  // Unmount once the drawer's exit transform finishes. Using onTransitionEnd
  // on the actual element (vs. a hardcoded timeout) keeps mount lifetime in
  // sync with the real animation, including motion-reduce overrides.
  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== drawerRef.current) return;
    if (event.propertyName !== 'transform') return;
    if (!isOpen) setIsMounted(false);
  };

  if (!isMounted) return null;
  if (typeof document === 'undefined') return null;

  const state = isVisible && isOpen ? 'open' : 'closed';

  return createPortal(
    <div className="fixed inset-0 pointer-events-auto" data-state={state}>
      <div
        data-state={state}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none data-[state=closed]:opacity-0 data-[state=open]:opacity-100"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        data-state={state}
        onTransitionEnd={handleTransitionEnd}
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 top-0 flex w-[280px] flex-col border-r border-gray-200 bg-white shadow-2xl transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none data-[state=closed]:-translate-x-full data-[state=closed]:opacity-0 data-[state=open]:translate-x-0 data-[state=open]:opacity-100 dark:border-slate-700 dark:bg-slate-900"
      >
        
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-400 text-sm font-bold text-gray-900 shadow-sm">
              N
            </div>
            <span className="truncate text-lg font-bold text-gray-900 dark:text-slate-100">Nuggets</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="hide-scrollbar-mobile flex-1 space-y-1 overflow-y-auto px-3 py-4">
           <p className="px-4 pb-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Feed layout</p>
           <div className="grid grid-cols-3 gap-2 px-3">
             <button
               type="button"
               onClick={() => setViewMode('grid')}
               className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${
                 viewMode === 'grid'
                   ? 'border-primary-300 bg-primary-50 text-gray-900 dark:border-primary-700 dark:bg-primary-900/20 dark:text-white'
                   : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
               }`}
             >
               <LayoutGrid size={18} />
               Grid
             </button>
             <button
               type="button"
               onClick={() => setViewMode('masonry')}
               className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${
                 viewMode === 'masonry'
                   ? 'border-primary-300 bg-primary-50 text-gray-900 dark:border-primary-700 dark:bg-primary-900/20 dark:text-white'
                   : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
               }`}
             >
               <Columns size={18} />
               Masonry
             </button>
           </div>

           {!isAuthenticated && (
             <>
               <div className="mx-4 my-2 h-px bg-gray-100 dark:bg-slate-800" />
               <Link
                 to="/contact"
                 onClick={onClose}
                 className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
               >
                 <Mail size={18} /> Contact Us
               </Link>
             </>
           )}

           {isAuthenticated && (
             <>
               <div className="mx-4 my-2 h-px bg-gray-100 dark:bg-slate-800" />
               <p className="px-4 pb-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Personal</p>
               <Link to={`/profile/${currentUser?.id || ''}`} onClick={onClose} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  <UserIcon size={18} /> Library
               </Link>
               <Link to="/bookmarks" onClick={onClose} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  <BookOpen size={18} /> Bookmarks
               </Link>
               <Link to="/account" onClick={onClose} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Settings size={18} /> Settings
               </Link>
               <Link
                 to="/contact"
                 onClick={onClose}
                 className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
               >
                 <Mail size={18} /> Contact Us
               </Link>
             </>
           )}

           {isAdmin && (
             <>
               <div className="mx-4 my-2 h-px bg-gray-100 dark:bg-slate-800" />
               <p className="px-4 pb-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Admin</p>
               <Link to="/admin" onClick={onClose} className="mb-1 flex items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-md ring-1 ring-black/5 dark:bg-slate-950 dark:text-white dark:ring-slate-600">
                  <Shield size={18} /> Admin Panel
               </Link>
             </>
           )}

           <div className="mx-4 my-4 h-px bg-gray-100 dark:bg-slate-800" />
           
           {/* Feedback Widget */}
           <DrawerFeedbackForm isAuthenticated={isAuthenticated} currentUser={currentUser} />
        </div>

        <div className="border-t border-gray-100 bg-gray-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/95">
           {isAuthenticated ? (
             <button
               onClick={async (e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 onClose();
                 await logout();
               }}
               disabled={isLoggingOut}
               aria-busy={isLoggingOut}
               className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/35"
             >
               {isLoggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
               {isLoggingOut ? 'Signing out…' : 'Sign Out'}
             </button>
           ) : (
             <button onClick={() => { openAuthModal(); onClose(); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-gray-900 shadow-lg shadow-yellow-400/20 transition-transform hover:scale-[1.02] dark:bg-primary-400 dark:text-gray-900 dark:shadow-primary-900/30">
               <LogIn size={18} /> Sign In
             </button>
           )}
        </div>
      </div>
    </div>,
    getOverlayHost('drawer')
  );
};

