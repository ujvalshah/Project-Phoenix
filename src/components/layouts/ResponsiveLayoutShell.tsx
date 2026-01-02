/**
 * ============================================================================
 * RESPONSIVE LAYOUT SHELL: CSS Grid-Based Layout with Stable Tailwind Classes
 * ============================================================================
 * 
 * @see src/LAYOUT_ARCHITECTURE.md for full documentation
 * 
 * PURPOSE:
 * - Provides responsive 2/3-column grid layout (sidebar | feed | detail)
 * - Uses STABLE Tailwind grid classes (NO arbitrary values)
 * - Applies explicit width constraints to children
 * - Handles responsive breakpoints via Tailwind responsive prefixes
 * 
 * USED BY: FeedLayoutPage only (route: /feed)
 * 
 * BREAKPOINTS:
 * - Desktop (xl: ≥1280px): 2-3 columns [sidebar? | feed | detail]
 * - Tablet (lg: ≥1024px): 1-2 columns [sidebar? | feed]
 * - Mobile (<1024px): Single column (feed only)
 * 
 * ============================================================================
 * STABILITY RULES (DO NOT VIOLATE):
 * ============================================================================
 * 
 * 1. ONLY use stable grid-cols-{n} classes: grid-cols-1, grid-cols-2, grid-cols-3
 * 2. NEVER use arbitrary templates: grid-cols-[...] causes CSS compilation failures
 * 3. Width constraints go on CHILDREN, not grid templates
 * 4. Always include pt-14 for header offset (header is fixed position)
 * 5. All content areas must have max-width fallbacks for grid failure recovery
 * 
 * ============================================================================
 */

import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface ResponsiveLayoutShellProps {
  /** Left sidebar content */
  sidebar?: React.ReactNode;
  /** Feed/main content area */
  feed: React.ReactNode;
  /** Detail view content (renders in desktop slot, overlay on mobile/tablet) */
  detail?: React.ReactNode;
}

/**
 * ResponsiveLayoutShell Component
 * 
 * CSS Grid-based layout using STABLE Tailwind classes only.
 * Column widths are enforced via explicit width utilities on children.
 * 
 * CRITICAL: Do NOT use arbitrary grid templates (grid-cols-[...])
 * They cause Tailwind compilation failures that break the entire layout.
 * 
 * GRID STRUCTURE:
 * - Desktop (xl): 3 columns - [sidebar ~260px | feed flex | detail ~1fr]
 * - Tablet (lg): 2 columns - [sidebar ~240px | feed 1fr]
 * - Mobile: 1 column - [feed only]
 */
export const ResponsiveLayoutShell: React.FC<ResponsiveLayoutShellProps> = ({
  sidebar,
  feed,
  detail,
}) => {
  const hasSidebar = !!sidebar;
  const hasDetail = !!detail;

  // STABLE GRID CLASSES ONLY - No arbitrary templates
  // Dynamic column count based on content:
  // - With sidebar: 3 cols on xl, 2 cols on lg, 1 on mobile
  // - Without sidebar: 2 cols on xl (feed + detail), 1 on mobile
  const gridCols = hasSidebar
    ? "xl:grid-cols-3 lg:grid-cols-2 grid-cols-1"
    : "xl:grid-cols-2 grid-cols-1";

  return (
    <div className={twMerge("grid min-h-screen w-full pt-14", gridCols)}>
      {/* pt-14 accounts for fixed Header height (h-14 = 56px) */}
      
      {/* Left Sidebar Column - Only render if sidebar exists */}
      {hasSidebar && (
        <aside className={twMerge(
          // Explicit width constraints
          "w-[260px] xl:w-[260px] lg:w-[240px] shrink-0",
          // Styling
          "border-r border-slate-200 dark:border-slate-800",
          "bg-white dark:bg-slate-900",
          "overflow-y-auto custom-scrollbar",
          // Hide on mobile
          "hidden lg:block"
        )}>
          {sidebar}
        </aside>
      )}

      {/* Feed Column - Center/Main Content */}
      {/* Max-width for readability, centered on mobile */}
      <main className={twMerge(
        // Width constraints - wrap content in centered container
        "w-full",
        // Styling
        "overflow-y-auto custom-scrollbar",
        "bg-white dark:bg-slate-950",
        "px-4 lg:px-6 py-4"
      )}>
        {/* Inner container for max-width centering */}
        <div className="w-full max-w-[760px] mx-auto">
          {feed}
        </div>
      </main>

      {/* Detail Panel Column - Right Side (Desktop Only) */}
      {hasDetail ? (
        <aside className={twMerge(
          // Width constraint - prevent full-width expansion
          "w-full max-w-[720px]",
          // Styling
          "border-l border-slate-200 dark:border-slate-800",
          "bg-white dark:bg-slate-900",
          "overflow-y-auto custom-scrollbar",
          // Hide on tablet/mobile (detail shown as overlay instead)
          "hidden xl:block"
        )}>
          {detail}
        </aside>
      ) : (
        // Empty state placeholder for detail panel on desktop
        <aside className={twMerge(
          "hidden xl:flex",
          "w-full max-w-[720px]",
          "border-l border-slate-200 dark:border-slate-800",
          "bg-slate-50 dark:bg-slate-900",
          "overflow-y-auto custom-scrollbar",
          "items-center justify-center p-8"
        )}>
          <div className="text-center">
            <div className="text-slate-400 dark:text-slate-500">
              <p className="text-sm font-medium mb-1">Select a nugget</p>
              <p className="text-xs">Details will appear here</p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

// Export both named and default for compatibility
export default ResponsiveLayoutShell;

