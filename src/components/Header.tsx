// NOTE: Do not add multiple React imports in this file.
// Consolidate all hooks into the single import below.
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, LogOut, Settings, Shield, LogIn, Layers, User as UserIcon, BookOpen, MessageSquare, Menu, X, LayoutGrid, Columns, List, Filter, ArrowUpDown, Maximize, Sun, Moon, Send, CheckCircle2, Search, Clock, Mail } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom'; // Still needed for NavigationDrawer
import { Avatar } from './shared/Avatar';
import { FilterPopover, FilterState } from './header/FilterPopover';
import { useAuth } from '@/hooks/useAuth';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useToast } from '@/hooks/useToast';
import { adminFeedbackService } from '@/admin/services/adminFeedbackService';
import { Z_INDEX } from '@/constants/zIndex';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { DropdownPortal } from './UI/DropdownPortal';
import type { SortOrder } from '@/types';
import type { UseFilterStateReturn } from '@/hooks/useFilterState';
import { useLegalPages } from '@/hooks/useLegalPages';
import { twMerge } from 'tailwind-merge';
import { useAppChromeScroll } from '@/context/AppChromeScrollContext';
import { setNarrowHeaderHidden } from '@/constants/layoutScrollBridge';

/** Yellow “N” tile — matches NavigationDrawer / app favicon treatment */
const NuggetsLogoMark: React.FC = () => (
  <span
    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-400 text-sm font-bold text-gray-900 shadow-sm"
    aria-hidden
  >
    N
  </span>
);

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
  viewMode: 'grid' | 'masonry' | 'utility';
  setViewMode: (mode: 'grid' | 'masonry' | 'utility') => void;
  selectedCategories: string[];
  setSelectedCategories: (c: string[]) => void;
  selectedTag: string | null;
  setSelectedTag: (t: string | null) => void;
  sortOrder: SortOrder;
  setSortOrder: (s: SortOrder) => void;
  onCreateNugget: () => void;
  currentUserId?: string;
  filters?: UseFilterStateReturn;
}

/** Small legal links section for the user menu dropdown */
const UserMenuLegalLinks: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { enabledPages } = useLegalPages();
  if (enabledPages.length === 0) return null;
  return (
    <div className="border-t border-gray-100 px-4 py-2">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {enabledPages.map((page) => (
          <Link
            key={page.slug}
            to={`/legal/${page.slug}`}
            onClick={onClose}
            className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            {page.title}
          </Link>
        ))}
      </div>
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  onCreateNugget,
  sidebarOpen,
  setSidebarOpen,
  viewMode,
  setViewMode,
  selectedCategories: _selectedCategories,
  sortOrder,
  setSortOrder,
  isDark,
  toggleTheme,
  filters,
}) => {
  const { narrowHeaderHidden } = useAppChromeScroll();

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
  
  // Derive filter popover state from the global filter hook (single source of truth).
  const filterState: FilterState = {
    collectionId: filters?.collectionId ?? null,
    formatTagIds: filters?.formatTagIds ?? [],
    domainTagIds: filters?.domainTagIds ?? [],
    subtopicTagIds: filters?.subtopicTagIds ?? [],
  };

  const handleFilterChange = (newFilters: FilterState) => {
    if (!filters) return;
    filters.setCollectionId(newFilters.collectionId);
    // Sync dimension tags — compare and toggle as needed
    const syncDimension = (prev: string[], next: string[], toggle: (id: string) => void) => {
      for (const id of next) {
        if (!prev.includes(id)) toggle(id);
      }
      for (const id of prev) {
        if (!next.includes(id)) toggle(id);
      }
    };
    syncDimension(filters.formatTagIds, newFilters.formatTagIds || [], filters.toggleFormatTag);
    syncDimension(filters.domainTagIds, newFilters.domainTagIds || [], filters.toggleDomainTag);
    syncDimension(filters.subtopicTagIds, newFilters.subtopicTagIds || [], filters.toggleSubtopicTag);
  };

  const handleFilterClear = () => {
    if (!filters) return;
    filters.setCollectionId(null);
    filters.clearFormatTags();
    filters.clearDomainTags();
    filters.clearSubtopicTags();
  };
  
  // Recent searches state
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('recent_searches');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  
  // Dropdown anchor refs - DropdownPortal handles positioning
  // Separate refs for desktop and mobile to avoid ref collision
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const mobileAvatarButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const mobileFilterButtonRef = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

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
  const { currentUser, isAuthenticated, openAuthModal, logout } = useAuth();
  const { withAuth } = useRequireAuth();

  const isAdmin = currentUser?.role === 'admin';
  const currentPath = location.pathname;
  const isHome = currentPath === '/';
  const isCollections = currentPath === '/collections';
  const isBookmarks = currentPath === '/bookmarks';

  // DropdownPortal handles positioning, scroll/resize updates, and click-outside detection
  // Only keyboard shortcuts need manual handling

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Save search to recent searches
  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const trimmed = query.trim();
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('recent_searches', JSON.stringify(updated));
    }
  };

  // Handle search query change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value.trimStart());
  };

  // Handle search submit
  const handleSearchSubmit = (query: string, closeMobileOverlay = true) => {
    if (query.trim()) {
      saveRecentSearch(query);
      setSearchQuery(query.trim());
    }
    if (closeMobileOverlay) {
      setIsMobileSearchOpen(false);
    }
  };

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
          const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
        }
      }
      // Escape to close dropdowns and mobile search
      if (e.key === 'Escape') {
        if (isMobileSearchOpen) {
          setIsMobileSearchOpen(false);
        } else if (isSortOpen) setIsSortOpen(false);
        else if (isUserMenuOpen) setIsUserMenuOpen(false);
        else if (isFilterPopoverOpen) setIsFilterPopoverOpen(false);
        else if (isMoreMenuOpen) setIsMoreMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSortOpen, isUserMenuOpen, isFilterPopoverOpen, isMobileSearchOpen, isMoreMenuOpen]);

  // Auto-focus mobile search input when overlay opens
  useEffect(() => {
    if (isMobileSearchOpen && mobileSearchInputRef.current) {
      setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isMobileSearchOpen]);

  // Use global filter hook as single source of truth for active filter state
  const hasActiveFilters = filters?.hasActiveFilters ?? false;
  const activeFilterCount = filters?.activeFilterCount ?? 0;

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
        <div className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} h-full hidden lg:flex items-center gap-3`}>
          {/* Left: Menu + Logo + Navigation */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800"
              aria-label="Open Menu"
            >
              <Menu size={18} aria-hidden />
            </button>

            <Link to="/" className="shrink-0" aria-label="Home">
              <NuggetsLogoMark />
            </Link>

            {/* Desktop Navigation (lg+) */}
            <nav 
              className="bg-gray-100 rounded-lg p-1 hidden lg:flex gap-1 overflow-x-auto min-w-0 shrink-0" 
              role="navigation"
              aria-label="Main navigation"
            >
              {/* REGRESSION CHECK: Header nav labels must be text-sm (14px) font-medium - do not change */}
              <Link
                to="/"
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 ${
                  isHome
                    ? 'bg-white text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                aria-current={isHome ? 'page' : undefined}
              >
                Home
              </Link>
              <Link
                to="/collections"
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 ${
                  isCollections
                    ? 'bg-white text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
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
                      ? 'bg-white text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-current={(currentPath.includes('/profile') || currentPath === '/myspace') ? 'page' : undefined}
                >
                  My Space
                </Link>
              )}
              {isAuthenticated && (
                <Link
                  to="/bookmarks"
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 ${
                    isBookmarks
                      ? 'bg-white text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
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
                      ? 'bg-white text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
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
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <Search size={16} />
              </div>
            
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onBlur={(e) => setSearchQuery(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit(searchQuery, false);
                  }
                }}
                placeholder="Search..."
                className="w-full h-9 pl-10 pr-28 text-sm font-medium bg-gray-50 border border-gray-100 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:bg-white focus:outline-none transition-all"
                aria-label="Search"
              />
            
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-20 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  ref={filterButtonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterPopoverOpen(!isFilterPopoverOpen);
                  }}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded transition-all relative ${
                    isFilterPopoverOpen || hasActiveFilters
                      ? 'text-yellow-500 bg-yellow-50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  aria-label="Filter"
                  title="Filter"
                >
                  <Filter size={16} fill={isFilterPopoverOpen || hasActiveFilters ? "currentColor" : "none"} />
                  {hasActiveFilters && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gray-400 text-white text-[9px] rounded-full flex items-center justify-center font-medium">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <button
                  ref={sortButtonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSortOpen(!isSortOpen);
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded text-gray-400 hover:text-gray-600 transition-colors"
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              aria-label="Create Nugget"
            >
              <Sparkles size={16} strokeWidth={2.5} className="text-yellow-500" fill="currentColor" />
            </button>

            {/* View mode buttons - Desktop only (lg+) */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-100">
              <button
                onClick={() => setViewMode('grid')}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
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
                    ? 'bg-white text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Masonry View"
                aria-label="Masonry View"
              >
                <Columns size={16} />
              </button>
              <button
                onClick={() => setViewMode('utility')}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded transition-all ${
                  viewMode === 'utility'
                    ? 'bg-white text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Utility View"
                aria-label="Utility View"
              >
                <List size={16} />
              </button>
            </div>

            {/* Fullscreen button */}
            <button
              onClick={toggleFullScreen}
              className="min-h-[44px] min-w-[44px] items-center justify-center p-2 text-gray-500 hover:text-gray-700 transition-colors flex"
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

        {/* Mobile/Tablet (<lg): single row — menu + logo | search + bell + profile (view/filter/theme in drawer) */}
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
            <Link to="/" className="flex shrink-0 items-center" aria-label="Home">
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
        className="w-56 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
      >
        {/* User Info */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-900 truncate">
            {currentUser?.name}
          </p>
          {currentUser?.email && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {currentUser.email}
            </p>
          )}
        </div>

        {/* Menu Items */}
        <div className="py-1">
          <Link
            to={`/profile/${currentUser?.id || ''}`}
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <UserIcon size={16} />
            My Space
          </Link>
          <Link
            to="/bookmarks"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <BookOpen size={16} />
            Bookmarks
          </Link>
          <Link
            to="/account"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings size={16} />
            Settings
          </Link>
          <Link
            to="/contact"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Mail size={16} />
            Contact Us
          </Link>
          {isAdmin && (
            <>
              <div className="h-px bg-gray-100 my-1" />
              <Link
                to="/admin"
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <Shield size={16} />
                Admin Panel
              </Link>
            </>
          )}
        </div>

        {/* Logout */}
        <div className="border-t border-gray-100 py-1">
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                await logout();
                setIsUserMenuOpen(false);
              } catch (error) {
                console.error('Logout failed:', error);
                setIsUserMenuOpen(false);
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>

        {/* Legal Links */}
        <UserMenuLegalLinks onClose={() => setIsUserMenuOpen(false)} />
      </DropdownPortal>

      {/* Filter Popover - Desktop (lg+) - mega dropdown */}
      <DropdownPortal
        isOpen={isFilterPopoverOpen && !isTablet && !isMobile}
        anchorRef={filterButtonRef}
        onClickOutside={() => setIsFilterPopoverOpen(false)}
        className=""
      >
        <FilterPopover
          filters={filterState}
          onChange={handleFilterChange}
          onClear={handleFilterClear}
        />
      </DropdownPortal>

      {/* Sort Dropdown - uses DropdownPortal */}
      <DropdownPortal
        isOpen={isSortOpen}
        anchorRef={sortButtonRef}
        onClickOutside={() => setIsSortOpen(false)}
        className="w-40 bg-white rounded-lg border border-gray-100 overflow-hidden"
      >
        {([
          { value: 'latest' as const, label: 'Latest' },
          { value: 'oldest' as const, label: 'Oldest' },
        ]).map(opt => (
          <button
            key={opt.value}
            onClick={() => { setSortOrder(opt.value); setIsSortOpen(false); }}
            className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors ${
              sortOrder === opt.value ? 'bg-gray-50' : ''
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
        className="w-48 bg-white rounded-lg border border-gray-100 overflow-hidden shadow-lg"
      >
        <div className="py-1">
          {isAuthenticated && (
            <Link
              to={`/profile/${currentUser?.id || ''}`}
              onClick={() => setIsMoreMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors ${
                currentPath.includes('/profile') || currentPath === '/myspace'
                  ? 'bg-gray-50 text-gray-900'
                  : 'text-gray-700'
              }`}
            >
              <UserIcon size={16} />
              My Space
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setIsMoreMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors ${
                currentPath.startsWith('/admin')
                  ? 'bg-gray-50 text-gray-900'
                  : 'text-gray-700'
              }`}
            >
              <Shield size={16} />
              Admin
            </Link>
          )}
        </div>
      </DropdownPortal>

      {/* Tablet/Mobile Filter+Sort Popover - uses DropdownPortal */}
      <DropdownPortal
        isOpen={isFilterPopoverOpen && (isTablet || isMobile)}
        anchorRef={mobileFilterButtonRef}
        onClickOutside={() => setIsFilterPopoverOpen(false)}
        className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-sm"
      >
        <div className="p-4 space-y-4">
          {/* Filter Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Filters</h3>
            <FilterPopover
              filters={filterState}
              onChange={handleFilterChange}
              onClear={handleFilterClear}
              variant="embedded"
            />
          </div>
          
          {/* Sort Section */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Sort</h3>
            <div className="space-y-1">
              {([
                { value: 'latest' as const, label: 'Latest' },
                { value: 'oldest' as const, label: 'Oldest' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSortOrder(opt.value);
                    setIsFilterPopoverOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors ${
                    sortOrder === opt.value ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                  }`}
                  aria-label={`Sort by ${opt.label}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DropdownPortal>

      {/* Mobile Search Overlay */}
      {isMobileSearchOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-white z-50 flex flex-col"
          style={{ zIndex: Z_INDEX.HEADER_OVERLAY }}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          {/* Search Bar */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-200">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <Search size={20} />
              </div>
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit(searchQuery);
                  } else if (e.key === 'Escape') {
                    setIsMobileSearchOpen(false);
                  }
                }}
                placeholder="Search..."
                className="w-full h-12 pl-11 pr-12 text-base font-medium bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:bg-white focus:outline-none transition-all"
                aria-label="Search"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    mobileSearchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear search"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close search"
            >
              <X size={20} />
            </button>
          </div>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="flex-1 overflow-y-auto hide-scrollbar-mobile p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Recent Searches</h3>
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearchSubmit(search)}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-3 min-h-[44px]"
                    aria-label={`Search for ${search}`}
                  >
                    <Clock size={16} className="text-gray-400" />
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!searchQuery && recentSearches.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Search size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-sm text-gray-500">Start typing to search</p>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      <NavigationDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        isAdmin={isAdmin}
        logout={logout}
        openAuthModal={() => openAuthModal('login')}
        filterAnchorRef={mobileFilterButtonRef}
        onOpenFilters={() => setIsFilterPopoverOpen(true)}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />
    </>
  );
};

// --- Internal Feedback Form Component ---
interface DrawerFeedbackFormProps {
  isAuthenticated: boolean;
  currentUser?: { id: string; name: string; email?: string; avatarUrl?: string } | null;
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
      await adminFeedbackService.submitFeedback(
        feedback.trim(),
        'general',
        currentUser ? {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          avatarUrl: currentUser.avatarUrl
        } : undefined,
        !currentUser ? email : undefined
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
        <div className="mx-3 my-2 p-4 bg-green-50 text-green-600 text-xs rounded-xl font-bold text-center border border-green-100 animate-in fade-in flex items-center justify-center gap-2 h-32">
           <CheckCircle2 size={24} />
           <div>
             Thanks for your thoughts! <br/> We read every message.
           </div>
        </div>
      );
  }

  return (
    <div className="mx-3 my-4 px-4 py-3 bg-yellow-50/40 rounded-xl border border-yellow-100/50" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare size={12} className="text-yellow-500" /> Feedback
        </p>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Have an idea? Send suggestions directly to us.
        </p>
        <form onSubmit={handleSubmit} className="space-y-2">
            <textarea 
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="I wish this app had..."
                className="w-full text-xs p-3 bg-white border border-yellow-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/50 resize-none h-24 text-gray-700 placeholder:text-gray-400 cursor-text"
                onKeyDown={(e) => e.stopPropagation()}
            />
            {!isAuthenticated && (
                <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email (optional)"
                    className="w-full text-xs p-2.5 bg-white border border-yellow-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/50 text-gray-700 placeholder:text-gray-400"
                    onKeyDown={(e) => e.stopPropagation()}
                />
            )}
            <button 
                type="submit"
                disabled={!feedback.trim() || isSending}
                className="w-full py-2 bg-yellow-100 text-yellow-900 border border-yellow-200 text-xs font-bold rounded-xl hover:bg-yellow-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
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
  logout: () => void;
  openAuthModal: () => void;
  filterAnchorRef: React.RefObject<HTMLButtonElement | null>;
  onOpenFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  viewMode: 'grid' | 'masonry' | 'utility';
  setViewMode: (mode: 'grid' | 'masonry' | 'utility') => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  currentUser,
  isAdmin,
  logout,
  openAuthModal,
  filterAnchorRef,
  onOpenFilters,
  hasActiveFilters,
  activeFilterCount,
  viewMode,
  setViewMode,
  isDark,
  toggleTheme,
}) => {
  if (!isOpen) return null;

  // IMPORTANT:
  // Portals must remain OUTSIDE layout JSX.
  // Never access `document` at module scope.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: Z_INDEX.HEADER_OVERLAY }}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="absolute top-0 bottom-0 left-0 w-[280px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 border-r border-gray-200">
        
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-400 text-sm font-bold text-gray-900 shadow-sm">
            N
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar-mobile py-4 px-3 space-y-1">
           <p className="px-4 pb-2 pt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Navigation</p>
           <Link to="/" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 font-bold text-sm transition-colors">
              <LayoutGrid size={18} /> Home
           </Link>
           <Link to="/collections" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 font-bold text-sm transition-colors">
              <Layers size={18} /> Collections
           </Link>
           <Link to="/contact" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 font-bold text-sm transition-colors">
              <Mail size={18} /> Contact Us
           </Link>

           <div className="mx-4 my-2 h-px bg-gray-100" />
           <p className="px-4 pb-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Feed layout</p>
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
             <button
               type="button"
               onClick={() => setViewMode('utility')}
               className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${
                 viewMode === 'utility'
                   ? 'border-primary-300 bg-primary-50 text-gray-900 dark:border-primary-700 dark:bg-primary-900/20 dark:text-white'
                   : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
               }`}
             >
               <List size={18} />
               Compact
             </button>
           </div>

           <div className="px-3 pt-2">
             <button
               ref={filterAnchorRef}
               type="button"
               onClick={(e) => {
                 e.stopPropagation();
                 onOpenFilters();
               }}
               className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors ${
                 hasActiveFilters
                   ? 'bg-primary-50 text-primary-800 dark:bg-primary-900/20 dark:text-primary-200'
                   : 'text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800'
               }`}
             >
               <Filter size={18} fill={hasActiveFilters ? 'currentColor' : 'none'} />
               Filters
               {hasActiveFilters && (
                 <span className="ml-auto flex min-w-[22px] items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold text-white">
                   {activeFilterCount}
                 </span>
               )}
             </button>
             <button
               type="button"
               onClick={() => toggleTheme()}
               className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
             >
               {isDark ? <Sun size={18} /> : <Moon size={18} />}
               {isDark ? 'Light mode' : 'Dark mode'}
             </button>
           </div>

           {isAuthenticated && (
             <>
               <div className="my-2 h-px bg-gray-100 mx-4" />
               <p className="px-4 pb-2 pt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Personal</p>
               <Link to={`/profile/${currentUser?.id || ''}`} onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 font-bold text-sm transition-colors">
                  <UserIcon size={18} /> My Space
               </Link>
               <Link to="/bookmarks" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 font-bold text-sm transition-colors">
                  <BookOpen size={18} /> Bookmarks
               </Link>
               <Link to="/account" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 font-bold text-sm transition-colors">
                  <Settings size={18} /> Settings
               </Link>
             </>
           )}

           {isAdmin && (
             <>
               <div className="my-2 h-px bg-gray-100 mx-4" />
               <p className="px-4 pb-2 pt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Admin</p>
               <Link to="/admin" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900 text-white shadow-md font-bold text-sm mb-1">
                  <Shield size={18} /> Admin Panel
               </Link>
             </>
           )}

           <div className="my-4 h-px bg-gray-100 mx-4" />
           
           {/* Feedback Widget */}
           <DrawerFeedbackForm isAuthenticated={isAuthenticated} currentUser={currentUser} />
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
           {isAuthenticated ? (
             <button onClick={async (e) => { 
               e.preventDefault();
               e.stopPropagation();
               onClose(); 
               try {
                 await logout();
               } catch (error) {
                 console.error('Logout failed:', error);
               }
             }} className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors shadow-sm">
               <LogOut size={18} /> Sign Out
             </button>
           ) : (
             <button onClick={() => { openAuthModal(); onClose(); }} className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-yellow-400 text-gray-900 font-bold text-sm shadow-lg shadow-yellow-400/20 hover:scale-[1.02] transition-transform">
               <LogIn size={18} /> Sign In
             </button>
           )}
        </div>
      </div>
    </div>,
    document.body
  );
};

