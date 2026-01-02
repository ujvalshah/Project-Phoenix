import React from 'react';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';

interface PageToolbarProps {
  children: React.ReactNode;
  /** Additional classes for the outer container */
  className?: string;
  /** Use dark variant (for pages that need it) */
  variant?: 'light' | 'dark';
}

/**
 * PageToolbar: Unified sticky toolbar for sub-pages
 * 
 * DESIGN PHILOSOPHY: Power User / Content-First
 * - Consistent positioning below fixed Header
 * - Light aesthetic by default (matches Header redesign)
 * - Dark variant available for emphasis
 * - Proper z-index layering
 * 
 * LAYOUT INVARIANT:
 * This component is sticky positioned below the Header.
 * It uses LAYOUT_CLASSES.STICKY_BELOW_HEADER for proper offset.
 * 
 * Usage:
 * ```tsx
 * <PageToolbar>
 *   <h1>Page Title</h1>
 *   <button>Action</button>
 * </PageToolbar>
 * ```
 */
export const PageToolbar: React.FC<PageToolbarProps> = ({ 
  children, 
  className = '',
  variant = 'light'
}) => {
  const variantStyles = variant === 'dark' 
    ? 'bg-slate-900 dark:bg-slate-950 border-slate-800 text-white'
    : LAYOUT_CLASSES.PAGE_TOOLBAR;

  return (
    <div 
      className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR_Z} ${variantStyles} transition-colors ${className}`}
      style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
};







