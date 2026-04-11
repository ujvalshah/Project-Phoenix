import React from 'react';
import { twMerge } from 'tailwind-merge';
import { HeaderSpacer } from './HeaderSpacer';
import { CategorySpacer } from './CategorySpacer';
import { MainContentTopSpacer } from './MainContentTopSpacer';
import { Z_INDEX } from '@/constants/zIndex';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { useAppChromeScroll } from '@/context/AppChromeScrollContext';

interface PageStackProps {
  /**
   * Optional: CategoryToolbar component to wrap in sticky container
   * If provided, it will be wrapped in a sticky container with proper z-index
   * CategorySpacer will automatically follow it.
   */
  categoryToolbar?: React.ReactNode;
  /**
   * Main content that should render below the category toolbar
   * Content must never overlap fixed/sticky elements.
   */
  mainContent: React.ReactNode;
}

/**
 * PageStack: Single vertical stacking container for page-level UI
 * 
 * LAYOUT INVARIANT:
 * Fixed headers do not reserve space.
 * All fixed/sticky elements require explicit spacers.
 * 
 * Layout Contract:
 * - Header owns the top (fixed, rendered in App.tsx).
 * - HeaderSpacer reserves space for fixed Header.
 * - PageStack owns vertical order.
 * - Content must never overlap siblings.
 * 
 * Rules:
 * - CategoryToolbar must be rendered before MainContent in JSX
 * - CategorySpacer automatically follows CategoryToolbar when provided
 * - No z-index escalation on content
 * - No transforms unless necessary
 * - No absolute positioning for page sections
 * - NO padding-top hacks - use spacers instead
 * 
 * Sticky elements do not reserve space.
 * Always add explicit spacing before content.
 */
export const PageStack: React.FC<PageStackProps> = ({ 
  categoryToolbar, 
  mainContent 
}) => {
  const { narrowHeaderHidden } = useAppChromeScroll();

  const categoryStickyClass =
    categoryToolbar != null
      ? twMerge(
          'sticky transition-[box-shadow,background-color] duration-300 ease-out',
          narrowHeaderHidden
            ? 'top-0 bg-white/95 pt-[env(safe-area-inset-top)] shadow-md shadow-gray-900/10 backdrop-blur-md dark:bg-slate-900/95 dark:shadow-black/20'
            : LAYOUT_CLASSES.STICKY_BELOW_HEADER,
        )
      : '';

  return (
    <div className="relative z-0">
      {/* Explicit spacer for fixed Header */}
      <HeaderSpacer />
      
      {/* Sticky CategoryToolbar Container */}
      {categoryToolbar && (
        <div className={categoryStickyClass} style={{ zIndex: Z_INDEX.CATEGORY_BAR }}>
          {categoryToolbar}
        </div>
      )}
      
      {/* CategorySpacer: MUST follow CategoryToolbar to reserve space */}
      {categoryToolbar && <CategorySpacer />}

      <MainContentTopSpacer />
      
      {/* MainContent - NO padding-top hack, spacers handle spacing */}
      <div>
        {mainContent}
      </div>
    </div>
  );
};

