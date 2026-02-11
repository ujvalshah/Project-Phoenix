import React, { useEffect, useRef, useState, lazy, Suspense, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Article } from '@/types';

// Lazy load ArticleDetail - only loads when drawer opens
const ArticleDetailLazy = lazy(() => 
  import('./ArticleDetail').then(module => ({ default: module.ArticleDetail }))
);

interface ArticleDrawerProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent) => void;
  article: Article | null;
  onYouTubeTimestampClick?: (videoId: string, timestamp: number, originalUrl: string) => void;
  onNavigateToCard?: (direction: 'prev' | 'next') => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
}

/**
 * ArticleDrawer: Side drawer for desktop multi-column grid
 * 
 * Purpose: Preserves grid integrity by showing full content in side drawer
 * instead of inline expansion that breaks grid alignment.
 * 
 * Features:
 * - Slides in from right (400px width on desktop)
 * - Grid remains visible with dimmed overlay
 * - Keyboard navigation (ESC, arrow keys)
 * - Focus management
 * - Smooth animations (GPU-accelerated)
 */
export const ArticleDrawer: React.FC<ArticleDrawerProps> = ({
  isOpen,
  onClose,
  article,
  onYouTubeTimestampClick,
  onNavigateToCard,
  canNavigatePrev = false,
  canNavigateNext = false,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const scrollPositionRef = useRef<number>(0);

  // Lock body scroll when drawer is open - keep scrollbar visible to prevent layout shift
  // This is simpler, more performant, and eliminates layout shift completely
  useEffect(() => {
    if (isOpen) {
      // Store current scroll position
      scrollPositionRef.current = window.scrollY;
      
      // Store previous focus for restoration
      previousFocusRef.current = document.activeElement as HTMLElement;
      setIsClosing(false);
      
      // Prevent scrolling but keep scrollbar visible to avoid layout shift
      // Using position: fixed prevents scrolling, overflow-y: scroll keeps scrollbar visible
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = '100%';
      document.body.style.overflowY = 'scroll'; // Keep scrollbar visible
    } else {
      // Restore scroll position and remove fixed positioning
      const scrollY = scrollPositionRef.current;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflowY = '';
      
      // Restore scroll position after a brief delay to ensure styles are applied
      setTimeout(() => {
        window.scrollTo(0, scrollY);
      }, 0);
    }
    return () => {
      // Cleanup: restore scroll position and remove fixed positioning
      const scrollY = scrollPositionRef.current;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflowY = '';
      setTimeout(() => {
        window.scrollTo(0, scrollY);
      }, 0);
    };
  }, [isOpen]);

  // Restore focus on close
  const handleClose = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsClosing(true);
    setTimeout(() => {
      onClose(e);
      setIsClosing(false);
      // Restore focus to previous element
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }, 200); // Match animation duration
  }, [onClose]);

  // Keyboard handlers
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowLeft' && canNavigatePrev && onNavigateToCard) {
        e.preventDefault();
        onNavigateToCard('prev');
      } else if (e.key === 'ArrowRight' && canNavigateNext && onNavigateToCard) {
        e.preventDefault();
        onNavigateToCard('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canNavigatePrev, canNavigateNext, onNavigateToCard, handleClose]);

  // Focus management: Trap focus in drawer when open
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const drawer = drawerRef.current;
    const focusableElements = drawer.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }

    // Trap focus within drawer
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    drawer.addEventListener('keydown', handleTabKey);
    return () => drawer.removeEventListener('keydown', handleTabKey);
  }, [isOpen, article]);

  if (!isOpen || !article) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end isolation-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Article details drawer"
      aria-describedby="drawer-content"
    >
      {/* Grid Overlay - Dimmed background, clickable to close */}
      <div
        className={`
          absolute inset-0 bg-black/40 backdrop-blur-sm
          transition-opacity duration-300
          ${isClosing ? 'opacity-0' : 'opacity-100'}
        `}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Container - Slides in from right */}
      <div
        ref={drawerRef}
        className={`
          relative w-full sm:w-[400px] lg:w-[500px] h-full
          bg-white dark:bg-slate-950 shadow-2xl
          flex flex-col border-l border-slate-200 dark:border-slate-800
          transform transition-transform duration-300 ease-out
          ${isClosing ? 'translate-x-full' : 'translate-x-0'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scroll Container */}
        <div
          id="drawer-content"
          className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950"
        >
          {article && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Loading article...
                    </p>
                  </div>
                </div>
              }
            >
              <ArticleDetailLazy
                article={article}
                isModal={true}
                constrainWidth={false}
                onClose={handleClose}
                onYouTubeTimestampClick={onYouTubeTimestampClick}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
