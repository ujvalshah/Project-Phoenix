import React from 'react';
import { HeaderSpacer } from './HeaderSpacer';
import { CategorySpacer } from './CategorySpacer';
import { Z_INDEX } from '@/constants/zIndex';
import { LAYOUT_CLASSES } from '@/constants/layout';

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
  return (
    <div className="relative z-0">
      {/* Explicit spacer for fixed Header */}
      <HeaderSpacer />
      
      {/* Sticky CategoryToolbar Container */}
      {categoryToolbar && (
        <div className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER}`} style={{ zIndex: Z_INDEX.CATEGORY_BAR }}>
          {categoryToolbar}
        </div>
      )}
      
      {/* CategorySpacer: MUST follow CategoryToolbar to reserve space */}
      {categoryToolbar && <CategorySpacer />}
      
      {/* MainContent - NO padding-top hack, spacers handle spacing */}
      <div>
        {mainContent}
      </div>
    </div>
  );
};

