import React, { useMemo, useRef } from 'react';
import { LAYOUT_CLASSES } from '@/constants/layout';

export interface Category {
  id: string;
  label: string;
  count: number;
}

interface CategoryFilterBarProps {
  categories: Category[];
  activeCategory: string; // Default 'All'
  onSelect: (categoryLabel: string) => void;
}

/**
 * CategoryFilterBar: Category filter toolbar component
 * 
 * STICKY RULE:
 * Sticky elements float.
 * A CategorySpacer MUST follow this component in layout.
 * 
 * This component is wrapped in a sticky container by PageStack with:
 * - position: sticky
 * - top offset from LAYOUT_CLASSES.STICKY_BELOW_HEADER
 * - z-index: 40
 * 
 * Height: LAYOUT_CLASSES.CATEGORY_BAR_HEIGHT - must match CategorySpacer
 */
export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  categories,
  activeCategory = 'All',
  onSelect,
}) => {
  // Smart sort logic: Pin "All" and "Today", then sort by count (high to low), then alphabetically
  const sortedCategories = useMemo(() => {
    // Filter out "All" and "Today" from incoming categories to avoid duplicates
    const filteredCategories = categories.filter(
      (cat) => cat.label.toLowerCase() !== 'all' && cat.label.toLowerCase() !== 'today'
    );

    // Sort the rest: Primary by count (high to low), secondary by alphabetical (A-Z)
    const sorted = [...filteredCategories].sort((a, b) => {
      // Primary sort: count (descending)
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // Secondary sort: alphabetical (ascending)
      return a.label.localeCompare(b.label);
    });

    // Build final display list: "All" first, "Today" second, then sorted rest
    const displayList: Array<{ label: string; count?: number }> = [
      { label: 'All' },
      { label: 'Today' },
      ...sorted,
    ];

    return displayList;
  }, [categories]);

  const handleSelect = (label: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onSelect(label);
  };

  // Ref for scroll container (available for future scroll button logic if needed)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={`bg-white dark:bg-slate-950 ${LAYOUT_CLASSES.CATEGORY_BAR_HEIGHT} border-b border-gray-200 dark:border-slate-700`}
    >
      {/* Full-bleed category bar - matches YouTube's unified toolbar approach */}
      {/* REGRESSION CHECK: Category filter pills must be text-[12px] font-medium - do not change */}
      <div className={`${LAYOUT_CLASSES.TOOLBAR_PADDING} flex items-center py-1`}>
        {/* 
          Horizontal scroll container for tag chips:
          - Single-row layout only (flex with no-wrap)
          - Horizontal scroll enabled (overflow-x-auto)
          - No vertical scroll (overflow-y-hidden)
          - Thin scrollbar for clean appearance
          - Smooth touch scrolling on iOS (-webkit-overflow-scrolling: touch)
          - Fixed height prevents layout shifts
        */}
        <div 
          ref={scrollContainerRef}
          className="tag-scroll-container flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden items-center scroll-smooth"
          style={{
            // Thin scrollbar for Firefox
            scrollbarWidth: 'thin',
            // Smooth touch scrolling on iOS
            WebkitOverflowScrolling: 'touch',
            // Fixed height to prevent layout shifts
            minHeight: 'fit-content',
          }}
        >
          {sortedCategories.map((category, index) => {
            const isActive = activeCategory === category.label;
            const isToday = category.label === 'Today';
            // Show divider after "Today" (index 1) and before first category (index 2)
            const showDivider = index === 2;

            return (
              <React.Fragment key={`${category.label}-${index}`}>
                {showDivider && (
                  <div 
                    className="h-[14px] w-px bg-gray-300 dark:bg-slate-600 mx-1 shrink-0"
                    aria-hidden="true"
                    role="separator"
                  />
                )}
                <button
                  onClick={(e) => handleSelect(category.label, e)}
                  className={`
                    whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] leading-snug font-medium transition-all duration-150
                    shrink-0
                    ${
                      isActive
                        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                        : isToday
                        ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/40'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                    }
                  `}
                  aria-pressed={isActive}
                  aria-label={`Filter by ${category.label}`}
                >
                  {category.label}
                  {category.count !== undefined && category.count > 0 && (
                    <span className="ml-1 opacity-60 text-[10px]">({category.count})</span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

