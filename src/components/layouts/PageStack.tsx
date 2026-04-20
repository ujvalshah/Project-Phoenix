import React from 'react';
import { HeaderSpacer } from './HeaderSpacer';
import { CategorySpacer } from './CategorySpacer';
import { MainContentTopSpacer } from './MainContentTopSpacer';
import { Z_INDEX } from '@/constants/zIndex';
import { LAYOUT_CLASSES } from '@/constants/layout';

interface PageStackProps {
  /**
   * When true, skips the in-stack HeaderSpacer (e.g. home feed with a sibling filter column that shares a full-width spacer).
   */
  suppressHeaderSpacer?: boolean;
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
  /** Optional custom top spacer class before main content. */
  contentTopSpacerClassName?: string;
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
  suppressHeaderSpacer = false,
  categoryToolbar,
  mainContent,
  contentTopSpacerClassName,
}) => {
  // Sticky offset is STATIC. Previously this toggled between top-0 (with
  // safe-area padding + background + backdrop-blur + shadow) and top-14 based
  // on narrowHeaderHidden — that is a layout-mutating class swap on scroll and
  // compounds the flicker caused by HeaderSpacer height changes. The sticky
  // toolbar now always sits below the reserved header band; when the fixed
  // header slides away on scroll-down, the 56/64px band simply reveals the
  // scrolling content underneath the (now off-screen) header.
  //
  // DO NOT re-introduce scroll-state-driven `top`, padding, background, or
  // backdrop-filter changes here. If the toolbar needs to rise with the
  // header, do it with a compositor-only translateY on this container.
  // See src/context/AppChromeScrollContext.tsx for the full invariant.
  const categoryStickyClass =
    categoryToolbar != null
      ? `sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER}`
      : '';

  return (
    <div className="relative z-0">
      {/* Explicit spacer for fixed Header */}
      {!suppressHeaderSpacer && <HeaderSpacer />}
      
      {/* Sticky CategoryToolbar Container */}
      {categoryToolbar && (
        <div className={categoryStickyClass} style={{ zIndex: Z_INDEX.CATEGORY_BAR }}>
          {categoryToolbar}
        </div>
      )}
      
      {/* CategorySpacer: MUST follow CategoryToolbar to reserve space */}
      {categoryToolbar && <CategorySpacer />}

      <MainContentTopSpacer className={contentTopSpacerClassName} />
      
      {/* MainContent - NO padding-top hack, spacers handle spacing */}
      <div>
        {mainContent}
      </div>
    </div>
  );
};

