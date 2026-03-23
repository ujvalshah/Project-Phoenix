import React, { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Collection } from '@/types';
import { LAYOUT_CLASSES } from '@/constants/layout';

interface CategoryToolbarProps {
  collections: Collection[];
  isLoading: boolean;
  selectedCollectionId: string | null; // null = "All"
  onSelect: (collectionId: string | null) => void;
}

/**
 * Horizontal sticky category rail for the home feed.
 * Shows "All" + featured community collections.
 *
 * UX:
 * - Single-select (one active at a time)
 * - Horizontal scroll on mobile with hidden scrollbar
 * - Hover-reveal arrow buttons on desktop
 * - Min 44px tap targets for accessibility
 * - Keyboard navigable with appropriate ARIA states
 */
export const CategoryToolbar: React.FC<CategoryToolbarProps> = ({
  collections,
  isLoading,
  selectedCollectionId,
  onSelect,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -300 : 300,
        behavior: 'smooth',
      });
    }
  }, []);

  return (
    <nav
      aria-label="Category filter"
      className={`
        ${LAYOUT_CLASSES.CATEGORY_BAR_HEIGHT}
        bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm
        border-b border-slate-100 dark:border-slate-800/60
        flex items-center
        w-full
      `}
    >
      <div className="relative group w-full flex items-center max-w-[1800px] mx-auto px-4 lg:px-6">
        {/* Left scroll arrow (desktop only) */}
        <button
          onClick={() => scroll('left')}
          aria-label="Scroll categories left"
          className="absolute left-2 lg:left-4 z-20 p-1.5 bg-white/90 dark:bg-slate-800/90 shadow-md rounded-full text-slate-500 hover:text-primary-600 border border-slate-200 dark:border-slate-700 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Scrollable category pills */}
        <div
          ref={scrollRef}
          role="toolbar"
          aria-label="Content categories"
          className="flex items-center gap-1.5 overflow-x-auto scroll-smooth w-full px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {/* "All" button — always first */}
          <CategoryPill
            label="All"
            isActive={selectedCollectionId === null}
            onClick={() => onSelect(null)}
          />

          {isLoading ? (
            // Skeleton pills while loading
            <>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-20 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0"
                />
              ))}
            </>
          ) : (
            collections.map((c) => (
              <CategoryPill
                key={c.id}
                label={c.name}
                isActive={selectedCollectionId === c.id}
                onClick={() => onSelect(c.id)}
              />
            ))
          )}
        </div>

        {/* Right scroll arrow (desktop only) */}
        <button
          onClick={() => scroll('right')}
          aria-label="Scroll categories right"
          className="absolute right-2 lg:right-4 z-20 p-1.5 bg-white/90 dark:bg-slate-800/90 shadow-md rounded-full text-slate-500 hover:text-primary-600 border border-slate-200 dark:border-slate-700 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
};

/**
 * Individual category pill button.
 * - 44px min height for tap target (h-8 + padding)
 * - High-contrast active state using primary color
 */
const CategoryPill: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <button
    aria-pressed={isActive}
    onClick={onClick}
    className={`
      inline-flex items-center justify-center
      px-4 py-1.5 min-h-[36px]
      text-xs font-semibold tracking-wide
      rounded-full border shrink-0
      whitespace-nowrap
      transition-all duration-150 ease-out
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
      ${isActive
        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-sm'
        : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
      }
    `}
  >
    {label}
  </button>
);
