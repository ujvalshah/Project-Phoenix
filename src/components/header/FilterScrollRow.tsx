import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FilterScrollRowProps {
  categories: string[];
  selectedCategories: string[];
  onToggle: (cat: string) => void;
  onClear: () => void;
}

// REGRESSION CHECK: Category filter chips must be text-xs (12px) font-medium - do not change
const CategoryChip: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
  <button 
    onClick={onClick} 
    className={`
      px-3 py-1.5 text-xs font-medium rounded-full border shrink-0 transition-all 
      ${isActive 
        ? 'bg-primary-500 border-primary-500 text-slate-900 shadow-sm' 
        : 'bg-slate-100/50 dark:bg-slate-800/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
      }
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

  return (
    <div className="relative group w-full flex items-center max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
      <button 
        onClick={() => scroll('left')}
        className="absolute left-4 z-20 p-2 bg-white/90 dark:bg-slate-800/90 shadow-md rounded-full text-slate-500 hover:text-primary-600 border border-slate-200 dark:border-slate-700 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
      >
        <ChevronLeft size={18} />
      </button>

      <div 
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto px-1 py-1 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] w-full mask-linear-fade"
      >
        <button 
            onClick={onClear} 
            className={`
              px-4 py-1.5 rounded-full text-xs font-medium border shrink-0 transition-all 
              ${selectedCategories.length === 0 
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-sm' 
                : 'bg-slate-100/50 dark:bg-slate-800/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }
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
        className="absolute right-4 z-20 p-2 bg-white/90 dark:bg-slate-800/90 shadow-md rounded-full text-slate-500 hover:text-primary-600 border border-slate-200 dark:border-slate-700 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};


