import React, { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Collection } from '@/types';
import { LAYOUT_CLASSES } from '@/constants/layout';

/** Describes a single active-filter chip to render in the toolbar. */
export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface CategoryToolbarProps {
  collections: Collection[];
  isLoading: boolean;
  selectedCollectionId: string | null; // null = "All"
  onSelect: (collectionId: string | null) => void;
  /** Active filter chips rendered inline after the collection pills */
  activeFilters?: ActiveFilterChip[];
  /** Callback to clear all active filters at once */
  onClearAllFilters?: () => void;
}

/**
 * Horizontal sticky category rail for the home feed.
 * Shows "All" + featured community collections + inline active filter chips.
 *
 * UX:
 * - Single-select (one active at a time)
 * - Horizontal scroll on mobile with hidden scrollbar
 * - Hover-reveal arrow buttons on desktop
 * - Active filter chips appear after the pills with a divider
 * - Min 44px tap targets for accessibility
 * - Keyboard navigable with appropriate ARIA states
 */
export const CategoryToolbar: React.FC<CategoryToolbarProps> = ({
  collections,
  isLoading,
  selectedCollectionId,
  onSelect,
  activeFilters = [],
  onClearAllFilters,
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

  const hasChips = activeFilters.length > 0;

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

        {/* Scrollable category pills + filter chips */}
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

          {/* Inline active filter chips — after a subtle divider */}
          {hasChips && (
            <>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-1" aria-hidden />
              {activeFilters.map((chip) => (
                <FilterChipPill
                  key={chip.key}
                  label={chip.label}
                  onRemove={chip.onRemove}
                />
              ))}
              {activeFilters.length > 1 && onClearAllFilters && (
                <button
                  onClick={onClearAllFilters}
                  className="shrink-0 text-[11px] font-medium text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors whitespace-nowrap px-1"
                  aria-label="Clear all filters"
                >
                  Clear all
                </button>
              )}
            </>
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
        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border-primary-200 dark:border-primary-700 shadow-sm'
        : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
      }
    `}
  >
    {label}
  </button>
);

/**
 * Inline dismissable filter chip — smaller and more subtle than category pills.
 * Uses the primary color to distinguish from collection pills.
 */
const FilterChipPill: React.FC<{
  label: string;
  onRemove: () => void;
}> = ({ label, onRemove }) => (
  <span className="
    inline-flex items-center gap-1
    px-2.5 py-1 min-h-[32px]
    text-[11px] font-semibold
    rounded-full shrink-0
    whitespace-nowrap
    bg-primary-50 dark:bg-primary-900/20
    text-primary-700 dark:text-primary-300
    border border-primary-200 dark:border-primary-800/50
  ">
    {label}
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="p-0.5 rounded-full hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
      aria-label={`Remove ${label} filter`}
    >
      <X size={10} />
    </button>
  </span>
);
