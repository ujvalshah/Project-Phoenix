import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Clock } from 'lucide-react';
import { SearchInput, SearchInputHandle } from './SearchInput';
import { Z_INDEX } from '@/constants/zIndex';

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue: string;
  onSearch: (value: string) => void;
}

/**
 * Full-screen mobile search overlay with recent searches.
 *
 * Extracted from Header to prevent the overlay's state (recent searches,
 * input value) from participating in Header's render cycle.
 */
export const MobileSearchOverlay = React.memo<MobileSearchOverlayProps>(({
  isOpen,
  onClose,
  initialValue,
  onSearch,
}) => {
  const searchRef = useRef<SearchInputHandle>(null);

  // Recent searches — self-contained in the overlay
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('recent_searches');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    const trimmed = query.trim();
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 5);
      if (typeof window !== 'undefined') {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const handleSubmit = useCallback((query: string) => {
    if (query.trim()) {
      saveRecentSearch(query);
      onSearch(query.trim());
    }
    onClose();
  }, [saveRecentSearch, onSearch, onClose]);

  const handleRecentClick = useCallback((search: string) => {
    searchRef.current?.setValue(search);
    handleSubmit(search);
  }, [handleSubmit]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-white z-50 flex flex-col"
      style={{ zIndex: Z_INDEX.HEADER_OVERLAY }}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Search Bar */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200">
        <div className="relative flex-1">
          <SearchInput
            ref={searchRef}
            initialValue={initialValue}
            onSearch={onSearch}
            onSubmit={(q) => handleSubmit(q)}
            placeholder="Search..."
            className="w-full"
            inputClassName="w-full h-12 pl-11 pr-12 text-base font-medium bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:bg-white focus:outline-none transition-all"
            iconSize={20}
            autoFocus
          />
        </div>
        <button
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close search"
        >
          <X size={20} />
        </button>
      </div>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="flex-1 overflow-y-auto hide-scrollbar-mobile p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Recent Searches</h3>
          </div>
          <div className="space-y-1">
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => handleRecentClick(search)}
                className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-3 min-h-[44px]"
                aria-label={`Search for ${search}`}
              >
                <Clock size={16} className="text-gray-400" />
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentSearches.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Search size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-sm text-gray-500">Start typing to search</p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
});

MobileSearchOverlay.displayName = 'MobileSearchOverlay';
