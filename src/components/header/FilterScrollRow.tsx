import React, { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FilterScrollRowProps {
  categories: string[];
  selectedCategories: string[];
  onToggle: (cat: string) => void;
  onClear: () => void;
}

// REGRESSION CHECK: Category filter chips must be text-xs (12px) font-medium - do not change
const CategoryChip: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    aria-label={`${isActive ? 'Remove' : 'Filter by'} category: ${label}`}
    aria-pressed={isActive}
    tabIndex={-1}
    className={`
      px-3 py-1.5 text-xs font-medium rounded-full border shrink-0 transition-all
      ${isActive
        ? 'bg-primary-500 border-primary-500 text-slate-900 shadow-sm'
        : 'bg-slate-100/50 dark:bg-slate-800/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
      }
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
    `}
  >
    {label}
  </button>
);

export const FilterScrollRow: React.FC<FilterScrollRowProps> = ({ categories, selectedCategories, onToggle, onClear }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Arrow-key navigation between chips (roving tabindex pattern)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex === -1) return;

    e.preventDefault();

    let nextIndex: number;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % buttons.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else {
      nextIndex = buttons.length - 1;
    }

    // Move focus and update roving tabindex
    buttons[currentIndex].tabIndex = -1;
    buttons[nextIndex].tabIndex = 0;
    buttons[nextIndex].focus();

    // Scroll the focused button into view
    buttons[nextIndex].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, []);

  // Set initial tabindex=0 on the first button (roving tabindex entry point)
  const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // If focus came from outside (not from arrow key navigation within),
    // ensure the first button (or the active one) gets tabindex=0
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const activeButton = buttons.find(b => b.tabIndex === 0);
    if (!activeButton && buttons.length > 0) {
      buttons[0].tabIndex = 0;
    }
  }, []);

  return (
    <div className="relative group w-full flex items-center max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
      <button
        onClick={() => scroll('left')}
        aria-label="Scroll categories left"
        className="absolute left-4 z-20 p-2 bg-white/90 dark:bg-slate-800/90 shadow-md rounded-full text-slate-500 hover:text-primary-600 border border-slate-200 dark:border-slate-700 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
      >
        <ChevronLeft size={18} />
      </button>

      <div
        ref={scrollContainerRef}
        role="toolbar"
        aria-label="Category filters"
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        className="flex items-center gap-2 overflow-x-auto px-1 py-1 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] w-full mask-linear-fade"
      >
        <button
          onClick={onClear}
          aria-label="Show all categories"
          aria-pressed={selectedCategories.length === 0}
          tabIndex={0}
          className={`
            px-4 py-1.5 rounded-full text-xs font-medium border shrink-0 transition-all
            ${selectedCategories.length === 0
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-sm'
              : 'bg-slate-100/50 dark:bg-slate-800/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
          `}
        >
          All
        </button>
        {categories.map((cat) => (
          <CategoryChip
            key={cat}
            label={cat}
            isActive={selectedCategories.includes(cat)}
            onClick={() => onToggle(cat)}
          />
        ))}
      </div>

      <button
        onClick={() => scroll('right')}
        aria-label="Scroll categories right"
        className="absolute right-4 z-20 p-2 bg-white/90 dark:bg-slate-800/90 shadow-md rounded-full text-slate-500 hover:text-primary-600 border border-slate-200 dark:border-slate-700 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};
