import React, { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Article } from '@/types';
import { getOverlayHost } from '@/utils/overlayHosts';
import { ArticleDetailLazy, ArticleDetailPanelFallback } from '@/components/ArticleDetailLazy';

/** Must match Tailwind `duration-*` on backdrop and panel exit transitions (ms). */
const CLOSE_EXIT_MS = 200;

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
  const bodyScrollLockedRef = useRef(false);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setIsClosing(false);
    });
  }, [isOpen]);

  // Lock body scroll only while open; restore exactly once in cleanup when leaving open.
  useEffect(() => {
    if (!isOpen) return;

    scrollPositionRef.current = window.scrollY;
    previousFocusRef.current = document.activeElement as HTMLElement;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionRef.current}px`;
    document.body.style.width = '100%';
    // Match global `overflow-x: clip` + reserve scrollbar gutter while background scroll is disabled.
    document.body.style.overflowX = 'clip';
    document.body.style.overflowY = 'scroll';
    bodyScrollLockedRef.current = true;

    return () => {
      if (!bodyScrollLockedRef.current) return;
      bodyScrollLockedRef.current = false;
      const scrollY = scrollPositionRef.current;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflowX = '';
      document.body.style.overflowY = '';
      window.requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleClose = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setIsClosing(true);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delayMs = prefersReducedMotion ? 0 : CLOSE_EXIT_MS;

    if (import.meta.env.DEV) {
      try {
        performance.mark('drawer:close:start');
      } catch {
        /* ignore */
      }
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;

      if (import.meta.env.DEV) {
        try {
          performance.mark('drawer:close:parentOnClose');
          performance.measure('drawer:close:untilParent', 'drawer:close:start', 'drawer:close:parentOnClose');
        } catch {
          /* ignore */
        }
      }

      onClose(e);
      setIsClosing(false);

      requestAnimationFrame(() => {
        const el = previousFocusRef.current;
        if (el && document.body.contains(el)) {
          el.focus();
        }
      });
    }, delayMs);
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
      className={`fixed inset-0 flex justify-end isolation-auto ${isClosing ? 'pointer-events-none' : 'pointer-events-auto'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Article details drawer"
      aria-describedby="drawer-content"
    >
      {/* Grid Overlay - Dimmed background, clickable to close */}
      <div
        className={`
          absolute inset-0 bg-black/40 backdrop-blur-sm
          transition-opacity duration-200 ease-out motion-reduce:transition-none
          ${isClosing ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'}
        `}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Container - Slides in from right */}
      <div
        ref={drawerRef}
        className={`
          pointer-events-auto relative w-full sm:w-[400px] lg:w-[500px] h-full
          bg-white dark:bg-slate-950 shadow-2xl
          flex flex-col border-l border-slate-200 dark:border-slate-800
          transform transition-transform duration-200 ease-out motion-reduce:transition-none
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
            <Suspense fallback={<ArticleDetailPanelFallback />}>
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
    getOverlayHost('drawer'),
  );
};
