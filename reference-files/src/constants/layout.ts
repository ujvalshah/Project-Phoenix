/**
 * Layout Constants
 * 
 * @see src/LAYOUT_ARCHITECTURE.md for full documentation
 * 
 * Centralized layout values to ensure consistency across:
 * - Header height
 * - Spacers
 * - Sticky offsets
 * - Breakpoint-aware sizing
 * - Grid layout dimensions
 * 
 * LAYOUT INVARIANT:
 * All fixed/sticky elements must have matching spacers.
 * Heights defined here are the single source of truth.
 * 
 * STABILITY RULES:
 * - Use LAYOUT_CLASSES for Tailwind classes
 * - Use LAYOUT for JavaScript calculations
 * - Use GRID_WIDTHS for layout component widths
 */

/**
 * Pixel values for calculations (e.g., JS-based positioning)
 */
export const LAYOUT = {
  /** Header height on mobile (< lg breakpoint) */
  HEADER_HEIGHT: 56,
  /** Header height on desktop (>= lg breakpoint) */
  HEADER_HEIGHT_LG: 64,
  /** Category filter bar height */
  CATEGORY_BAR_HEIGHT: 48,
  /** Page toolbar height (for sub-pages like Collections, MySpace) */
  PAGE_TOOLBAR_HEIGHT: 'auto',
  /** Tailwind lg breakpoint in pixels */
  LG_BREAKPOINT: 1024,
  /** Tailwind xl breakpoint in pixels */
  XL_BREAKPOINT: 1280,
} as const;

/**
 * Grid layout widths (for ResponsiveLayoutShell and HomePage feed view)
 * 
 * STABILITY RULE: These are applied via width utilities on children,
 * NOT via arbitrary grid-cols-[...] templates.
 */
export const GRID_WIDTHS = {
  /** Sidebar width on desktop */
  SIDEBAR_XL: 260,
  /** Sidebar width on tablet */
  SIDEBAR_LG: 240,
  /** Feed/main content max width */
  FEED_MAX: 760,
  /** Detail panel max width */
  DETAIL_MAX: 720,
  /** Right sidebar width (HomePage feed view) */
  RIGHT_SIDEBAR: 260,
  /** Left sidebar width (HomePage feed view) */
  LEFT_SIDEBAR: 220,
} as const;

/**
 * Tailwind class strings for direct use in components.
 * These ensure Header, Spacers, and sticky offsets stay in sync.
 * 
 * DESIGN PHILOSOPHY: Power User / Content-First
 * - Maximize content density
 * - Minimize visual chrome
 * - Unified toolbar zone (header + category bar)
 * - Full-bleed layout for immersive feel
 * - Light, airy aesthetic with subtle shadows
 */
export const LAYOUT_CLASSES = {
  /** Header height classes */
  HEADER_HEIGHT: 'h-14',
  /** HeaderSpacer must match Header height */
  HEADER_SPACER: 'h-14',
  /** CategoryFilterBar height - compact for power users */
  CATEGORY_BAR_HEIGHT: 'h-11',
  /** 
   * CategorySpacer - near-zero gap for content-first design.
   * Power users want content immediately visible.
   */
  CATEGORY_SPACER: 'h-1',
  /** Sticky top offset for elements below Header */
  STICKY_BELOW_HEADER: 'top-14',
  /** 
   * Full-bleed: No max-width constraint on toolbar zone.
   * Content uses this for inner padding alignment.
   */
  TOOLBAR_PADDING: 'px-4 lg:px-6',
  /** Content container - wider for more cards */
  CONTENT_MAX_WIDTH: 'max-w-[1600px]',
  /** Standard horizontal padding */
  CONTENT_PADDING: 'px-4 lg:px-6',
  /**
   * Page Toolbar Styles - Unified aesthetic for sub-page headers
   * Uses light theme with subtle border for visual hierarchy
   */
  PAGE_TOOLBAR: 'bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm',
  /** Page toolbar z-index class */
  PAGE_TOOLBAR_Z: 'z-30',
} as const;

/**
 * Helper to get current header height based on viewport
 */
export const getHeaderHeight = (): number => {
  if (typeof window === 'undefined') return LAYOUT.HEADER_HEIGHT;
  return window.innerWidth >= LAYOUT.LG_BREAKPOINT 
    ? LAYOUT.HEADER_HEIGHT_LG 
    : LAYOUT.HEADER_HEIGHT;
};

/**
 * Helper to get combined header + category bar height
 */
export const getTotalToolbarHeight = (): number => {
  return getHeaderHeight() + LAYOUT.CATEGORY_BAR_HEIGHT;
};

