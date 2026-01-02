// Archived experimental layout variant — not used in routing

/**
 * ============================================================================
 * WORKSPACE LAYOUT: Centralized Layout Controller
 * ============================================================================
 * 
 * PURPOSE:
 * - Owns responsive breakpoints
 * - Controls layout mode: Desktop 3-pane, Tablet 2-pane, Mobile single-pane
 * - Provides three slots: sidebar, feed, detail
 * - Layout shell always exists (persistent structure)
 * 
 * BREAKPOINTS:
 * - Desktop ≥1200px: 3-column grid [sidebar | feed | detail]
 * - Tablet 900–1199px: 2-column grid [sidebar | feed]
 * - Mobile <900px: Single column (detail overlays/bottom sheet)
 * 
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

export interface WorkspaceLayoutProps {
  /** Left sidebar content */
  sidebar?: React.ReactNode;
  /** Feed/main content area */
  feed: React.ReactNode;
  /** Detail view content (renders in desktop slot, overlay on mobile) */
  detail?: React.ReactNode;
  /** Whether detail is currently active (controls mobile overlay) */
  isDetailActive?: boolean;
  /** Handler to close detail (for mobile overlay) */
  onCloseDetail?: () => void;
}

type LayoutMode = 'desktop' | 'tablet' | 'mobile';

/**
 * Detect layout mode based on window width
 */
function detectLayoutMode(width: number): LayoutMode {
  if (width >= 1200) return 'desktop';
  if (width >= 900) return 'tablet';
  return 'mobile';
}

/**
 * WorkspaceLayout Component
 * 
 * Centralized layout controller that manages responsive breakpoints
 * and renders appropriate layout structure for each mode.
 */
export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  sidebar,
  feed,
  detail,
  isDetailActive = false,
  onCloseDetail,
}) => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window !== 'undefined') {
      return detectLayoutMode(window.innerWidth);
    }
    return 'mobile'; // Default to mobile
  });

  // Monitor window resize and update layout mode
  useEffect(() => {
    const handleResize = () => {
      const newMode = detectLayoutMode(window.innerWidth);
      setLayoutMode(newMode);
    };

    // Initial check
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Lock body scroll when mobile detail overlay is active
  useEffect(() => {
    if (layoutMode === 'mobile' && isDetailActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [layoutMode, isDetailActive]);

  // Handle escape key for mobile overlay
  useEffect(() => {
    if (layoutMode !== 'mobile' || !isDetailActive || !onCloseDetail) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseDetail();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layoutMode, isDetailActive, onCloseDetail]);

  // Desktop Layout: 3-column grid [sidebar | feed | detail]
  if (layoutMode === 'desktop') {
    return (
      <div className="w-full h-screen flex">
        {/* Left Sidebar - Fixed 260px */}
        {sidebar && (
          <aside className="w-[260px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar">
            {sidebar}
          </aside>
        )}

        {/* Feed Column - Flexible width (560-760px) */}
        <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
          <div className="max-w-[760px] min-w-[560px] mx-auto px-4 lg:px-6 py-4">
            {feed}
          </div>
        </main>

        {/* Detail Panel - Remaining space (1fr) */}
        <aside className="flex-1 min-w-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar">
          {detail || (
            <div className="h-full flex items-center justify-center p-8 text-center">
              <div className="text-slate-400 dark:text-slate-500">
                <p className="text-sm font-medium mb-1">Select a nugget</p>
                <p className="text-xs">Details will appear here</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    );
  }

  // Tablet Layout: 2-column grid [sidebar | feed]
  if (layoutMode === 'tablet') {
    return (
      <div className="w-full h-screen flex relative overflow-hidden">
        {/* Left Sidebar - Fixed 240px */}
        {sidebar && (
          <aside className="w-[240px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar">
            {sidebar}
          </aside>
        )}

        {/* Feed Column - Remaining space */}
        <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
          <div className="max-w-full mx-auto px-4 lg:px-6 py-4">
            {feed}
          </div>
        </main>

        {/* Detail Overlay - Center modal sheet when active */}
        {isDetailActive && detail && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 animate-in fade-in duration-300"
              onClick={onCloseDetail}
              aria-hidden="true"
            />

            {/* Center Sheet */}
            <div
              className={twMerge(
                'fixed inset-y-0 left-1/2 -translate-x-1/2',
                'w-[90vw] max-w-[800px]',
                'bg-white dark:bg-slate-950',
                'shadow-2xl border-x border-slate-200 dark:border-slate-800',
                'z-50 overflow-y-auto custom-scrollbar',
                'animate-in slide-in-from-bottom-4 duration-300'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {detail}
            </div>
          </>
        )}
      </div>
    );
  }

  // Mobile Layout: Single column with bottom sheet overlay
  return (
    <div className="w-full h-screen relative overflow-hidden">
      {/* Feed - Single column, full width */}
      <main className="w-full h-full overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
        <div className="max-w-full mx-auto px-4 py-4">
          {feed}
        </div>
      </main>

      {/* Bottom Sheet Overlay - When detail is active */}
      {isDetailActive && detail && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 animate-in fade-in duration-300"
            onClick={onCloseDetail}
            aria-hidden="true"
          />

          {/* Bottom Sheet Container */}
          <div
            className={twMerge(
              'fixed inset-x-0 bottom-0',
              'h-[92vh] max-h-[92vh]',
              'bg-white dark:bg-slate-950',
              'rounded-t-3xl shadow-2xl',
              'z-50 flex flex-col',
              'animate-in slide-in-from-bottom duration-300 ease-out'
            )}
            onClick={(e) => e.stopPropagation()}
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 0)',
            }}
          >
            {/* Drag Handle */}
            <div className="flex-shrink-0 flex items-center justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Close Button */}
            {onCloseDetail && (
              <button
                onClick={onCloseDetail}
                className={twMerge(
                  'absolute top-4 right-4',
                  'p-2 rounded-full',
                  'bg-slate-100 dark:bg-slate-800',
                  'hover:bg-slate-200 dark:hover:bg-slate-700',
                  'transition-colors',
                  'z-10'
                )}
                aria-label="Close detail view"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-slate-700 dark:text-slate-300"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Detail Content - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {detail}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Export both named and default for backward compatibility
export default WorkspaceLayout;

