// NOTE: Do not add multiple React imports in this file.
// Consolidate all hooks into the single import below.
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, LogOut, Settings, Shield, LogIn, Layers, User as UserIcon, Globe, FileText, Lock, BookOpen, MessageSquare, Menu, X, LayoutGrid, Columns, List, Filter, ArrowUpDown, Maximize, Sun, Moon, Send, CheckCircle2, Search, MoreHorizontal, Clock } from 'lucide-react';
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
  sortOrder: any;
  setSortOrder: (s: any) => void;
  onCreateNugget: () => void;
  currentUserId?: string;
}

export const Header: React.FC<HeaderProps> = ({ 
  searchQuery, 
  setSearchQuery, 
  onCreateNugget,
  sidebarOpen,
  setSidebarOpen,
  viewMode,
  setViewMode,
  selectedCategories,
  sortOrder,
  setSortOrder,
  isDark,
  toggleTheme
}) => {
  // Dropdown state - managed by DropdownPortal
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  
  // Filter state
  const [filterState, setFilterState] = useState<FilterState>({
    favorites: false,
    unread: false,
    formats: [],
    timeRange: 'all',
  });
  
  // Recent searches state
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('recent_searches');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  
  // Dropdown anchor refs - DropdownPortal handles positioning
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  
  const location = useLocation();
  const { currentUser, isAuthenticated, openAuthModal, logout } = useAuth();
  const { withAuth } = useRequireAuth();

  const isAdmin = currentUser?.role === 'admin';
  const currentPath = location.pathname;
  const isHome = currentPath === '/';
  const isCollections = currentPath === '/collections';

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

  // Check if filters or sort are active
  const hasActiveFilters = selectedCategories.length > 0 || 
    filterState.favorites || 
    filterState.unread || 
    filterState.formats.length > 0 || 
    filterState.timeRange !== 'all';

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
      {/* Power User Header - Full-bleed, unified with category bar */}
      {/* No bottom border - category bar provides the visual separation */}
      <header className={`fixed top-0 left-0 right-0 w-full pt-[env(safe-area-inset-top)] bg-white ${LAYOUT_CLASSES.HEADER_HEIGHT}`} style={{ zIndex: Z_INDEX.HEADER }}>
        {/* Desktop Layout (lg+) - Original layout preserved */}
        <div className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} h-full hidden lg:flex items-center gap-3`}>
          {/* Left: Menu + Logo + Navigation */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Open Menu"
            >
              <Menu size={16} />
            </button>

            <Link to="/" className="flex items-center justify-center shrink-0" aria-label="Home">
              <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-gray-900 font-bold text-sm">
                N
              </div>
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
                      {selectedCategories.length + 
                        (filterState.favorites ? 1 : 0) + 
                        (filterState.unread ? 1 : 0) + 
                        filterState.formats.length + 
                        (filterState.timeRange !== 'all' ? 1 : 0)}
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

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 transition-colors"
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
                className="p-0.5 rounded-full border-2 border-transparent hover:border-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                className="min-h-[44px] min-w-[44px] p-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
                aria-label="Sign In"
              >
                <LogIn size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Mobile/Tablet Layout (<lg) - Refactored with justify-between */}
        <div className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} h-full flex lg:hidden items-center justify-between`}>
          {/* Far Left: Hamburger Menu */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Open Menu"
            >
              <Menu size={16} />
            </button>
          </div>

          {/* Middle Group: View Mode Buttons, Search, Create, Theme Toggle */}
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            {/* View mode buttons - Grid and Masonry grouped */}
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
            </div>

            {/* Search icon button - Mobile & Tablet */}
            <button
              onClick={() => setIsMobileSearchOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Search"
            >
              <Search size={16} />
            </button>

            {/* Create button */}
            <button
              onClick={withAuth(onCreateNugget)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              aria-label="Create Nugget"
            >
              <Sparkles size={16} strokeWidth={2.5} className="text-yellow-500" fill="currentColor" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          {/* Far Right: Avatar/Login - Fully right-aligned */}
          <div className="flex items-center shrink-0">
            {isAuthenticated ? (
              <button
                ref={avatarButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                className="p-0.5 rounded-full border-2 border-transparent hover:border-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                className="min-h-[44px] min-w-[44px] p-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
                aria-label="Sign In"
              >
                <LogIn size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Avatar Menu - uses DropdownPortal for positioning and click-outside */}
      <DropdownPortal
        isOpen={isUserMenuOpen}
        anchorRef={avatarButtonRef}
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
            to="/account"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings size={16} />
            Settings
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

        {/* Legal & Info */}
        <div className="border-t border-gray-100 py-1">
          <p className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Legal & Info</p>
          <Link
            to="/about"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Globe size={14} />
            About Us
          </Link>
          <Link
            to="/terms"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <FileText size={14} />
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Lock size={14} />
            Privacy Policy
          </Link>
          <Link
            to="/guidelines"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <BookOpen size={14} />
            Guidelines
          </Link>
          <Link
            to="/contact"
            onClick={() => setIsUserMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <MessageSquare size={14} />
            Contact
          </Link>
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
      </DropdownPortal>

      {/* Filter Popover - Desktop (lg+) - uses DropdownPortal */}
      <DropdownPortal
        isOpen={isFilterPopoverOpen && !isTablet}
        anchorRef={filterButtonRef}
        onClickOutside={() => setIsFilterPopoverOpen(false)}
        className="bg-white rounded-xl shadow-xl border border-gray-100"
      >
        <FilterPopover
          filters={filterState}
          onChange={setFilterState}
          onClear={() => {
            setFilterState({
              favorites: false,
              unread: false,
              formats: [],
              timeRange: 'all',
            });
          }}
        />
      </DropdownPortal>

      {/* Sort Dropdown - uses DropdownPortal */}
      <DropdownPortal
        isOpen={isSortOpen}
        anchorRef={sortButtonRef}
        onClickOutside={() => setIsSortOpen(false)}
        className="w-36 bg-white rounded-lg border border-gray-100 overflow-hidden"
      >
        <button
          onClick={() => { setSortOrder('latest'); setIsSortOpen(false); }}
          className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors ${
            sortOrder === 'latest' ? 'bg-gray-50' : ''
          }`}
          aria-label="Sort by Latest"
        >
          Latest
        </button>
        <button
          onClick={() => { setSortOrder('oldest'); setIsSortOpen(false); }}
          className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors ${
            sortOrder === 'oldest' ? 'bg-gray-50' : ''
          }`}
          aria-label="Sort by Oldest"
        >
          Oldest
        </button>
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

      {/* Tablet Filter+Sort Popover - uses DropdownPortal */}
      <DropdownPortal
        isOpen={isFilterPopoverOpen && isTablet}
        anchorRef={filterButtonRef}
        onClickOutside={() => setIsFilterPopoverOpen(false)}
        className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-sm"
      >
        <div className="p-4 space-y-4">
          {/* Filter Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Filters</h3>
            <FilterPopover
              filters={filterState}
              onChange={setFilterState}
              onClear={() => {
                setFilterState({
                  favorites: false,
                  unread: false,
                  formats: [],
                  timeRange: 'all',
                });
              }}
            />
          </div>
          
          {/* Sort Section */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Sort</h3>
            <div className="space-y-1">
              <button
                onClick={() => { 
                  setSortOrder('latest'); 
                  setIsFilterPopoverOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors ${
                  sortOrder === 'latest' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                }`}
                aria-label="Sort by Latest"
              >
                Latest
              </button>
              <button
                onClick={() => { 
                  setSortOrder('oldest'); 
                  setIsFilterPopoverOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors ${
                  sortOrder === 'oldest' ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                }`}
                aria-label="Sort by Oldest"
              >
                Oldest
              </button>
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
            Have an idea? Send suggestions directly to the founder.
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
                {isSending ? 'Sending...' : <><Send size={12} /> Send to Founder</>}
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
  currentUser: any;
  isAdmin: boolean;
  logout: () => void;
  openAuthModal: () => void;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen, onClose, isAuthenticated, currentUser, isAdmin, logout, openAuthModal
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
        
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
           <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-gray-900 font-bold text-lg shadow-sm">N</div>
              <span className="font-extrabold text-lg text-gray-900">Nuggets</span>
           </div>
           <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
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
           
           {isAuthenticated && (
             <>
               <div className="my-2 h-px bg-gray-100 mx-4" />
               <p className="px-4 pb-2 pt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Personal</p>
               <Link to={`/profile/${currentUser?.id || ''}`} onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 font-bold text-sm transition-colors">
                  <UserIcon size={18} /> My Space
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

           <div className="my-4 h-px bg-gray-100 mx-4" />
           
           <div className="px-4 pb-2">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Legal & Info</p>
             <div className="flex flex-col gap-1">
               <Link to="/about" onClick={onClose} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                  <Globe size={16} /> About Us
               </Link>
               <Link to="/terms" onClick={onClose} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                  <FileText size={16} /> Terms of Service
               </Link>
               <Link to="/privacy" onClick={onClose} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                  <Lock size={16} /> Privacy Policy
               </Link>
               <Link to="/guidelines" onClick={onClose} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                  <BookOpen size={16} /> Guidelines
               </Link>
               <Link to="/contact" onClick={onClose} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                  <MessageSquare size={16} /> Contact
               </Link>
             </div>
           </div>
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

