import React, { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { TaxonomyTag } from '@/types';
import { LAYOUT_CLASSES } from '@/constants/layout';

/** Describes a single active-filter chip to render in the toolbar. */
export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface CategoryToolbarProps {
  /** Format dimension tags (Content Format) */
  formatTags: TaxonomyTag[];
  /** Domain dimension tags (Subject Domain) */
  domainTags: TaxonomyTag[];
  /** Currently selected format tag IDs */
  selectedFormatIds: string[];
  /** Currently selected domain tag IDs */
  selectedDomainIds: string[];
  /** Toggle a format tag on/off */
  onToggleFormat: (tagId: string) => void;
  /** Toggle a domain tag on/off */
  onToggleDomain: (tagId: string) => void;
  /** Clear all toolbar selections */
  onClearAll: () => void;
  /** Loading state */
  isLoading: boolean;
  /** Active filter chips rendered inline after the tag pills */
  activeFilters?: ActiveFilterChip[];
}

/**
 * Horizontal sticky category rail for the home feed.
 * Shows: [All] | [Format tags...] | [Domain tags...]
 *
 * UX:
 * - Multi-select within each dimension group
 * - "All" clears all selections
 * - Dividers between sections
 * - Horizontal scroll on mobile with hidden scrollbar
 * - Hover-reveal arrow buttons on desktop
 * - Min 36px tap targets for accessibility
 * - Keyboard navigable with appropriate ARIA states
 */
export const CategoryToolbar: React.FC<CategoryToolbarProps> = ({
  formatTags,
  domainTags,
  selectedFormatIds,
  selectedDomainIds,
  onToggleFormat,
  onToggleDomain,
  onClearAll,
  isLoading,
  activeFilters = [],
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

  const hasAnySelection = selectedFormatIds.length > 0 || selectedDomainIds.length > 0;
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

        {/* Scrollable tag pills */}
        <div
          ref={scrollRef}
          role="toolbar"
          aria-label="Content categories"
          className="flex items-center gap-1.5 overflow-x-auto scroll-smooth w-full px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {/* "All" button — always first */}
          <CategoryPill
            label="All"
            isActive={!hasAnySelection}
            onClick={onClearAll}
          />

          {/* Divider after All */}
          <ToolbarDivider />

          {/* Format tags section */}
          {isLoading ? (
            <SkeletonPills count={3} />
          ) : (
            formatTags.map((tag) => (
              <CategoryPill
                key={tag.id}
                label={tag.rawName}
                isActive={selectedFormatIds.includes(tag.id)}
                onClick={() => onToggleFormat(tag.id)}
                accentColor="blue"
              />
            ))
          )}

          {/* Divider between Format and Domain */}
          {(formatTags.length > 0 || isLoading) && (domainTags.length > 0 || isLoading) && (
            <ToolbarDivider />
          )}

          {/* Domain tags section */}
          {isLoading ? (
            <SkeletonPills count={4} />
          ) : (
            domainTags.map((tag) => (
              <CategoryPill
                key={tag.id}
                label={tag.rawName}
                isActive={selectedDomainIds.includes(tag.id)}
                onClick={() => onToggleDomain(tag.id)}
                accentColor="emerald"
              />
            ))
          )}

          {/* Inline active filter chips — after a subtle divider */}
          {hasChips && (
            <>
              <ToolbarDivider />
              {activeFilters.map((chip) => (
                <FilterChipPill
                  key={chip.key}
                  label={chip.label}
                  onRemove={chip.onRemove}
                />
              ))}
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

/** Vertical divider between toolbar sections */
const ToolbarDivider: React.FC = () => (
  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-1" aria-hidden />
);

/** Skeleton loading pills */
const SkeletonPills: React.FC<{ count: number }> = ({ count }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className="h-8 w-20 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0"
      />
    ))}
  </>
);

const ACCENT_PILL = {
  blue: {
    active: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700 shadow-sm',
  },
  emerald: {
    active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700 shadow-sm',
  },
  primary: {
    active: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border-primary-200 dark:border-primary-700 shadow-sm',
  },
} as const;

/**
 * Individual category pill button.
 * - 36px min height for tap target
 * - Color-coded active state per dimension
 */
const CategoryPill: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  accentColor?: keyof typeof ACCENT_PILL;
}> = ({ label, isActive, onClick, accentColor = 'primary' }) => (
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
        ? ACCENT_PILL[accentColor].active
        : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
      }
    `}
  >
    {label}
  </button>
);

/**
 * Inline dismissable filter chip — smaller and more subtle than category pills.
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
