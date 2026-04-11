import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUpDown, Filter, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { FilterPopover, FilterState } from './header/FilterPopover';
import { Z_INDEX } from '@/constants/zIndex';
import type { SortOrder } from '@/types';
import type { UseFilterStateReturn } from '@/hooks/useFilterState';

interface MobileActionBarProps {
  sortOrder: SortOrder;
  setSortOrder: (s: SortOrder) => void;
  filters: UseFilterStateReturn;
}

/**
 * Myntra-style sticky bottom bar for mobile with Sort + Filter.
 * Hides on scroll-down, reappears on scroll-up.
 * Only renders on mobile (<lg).
 */
export const MobileActionBar: React.FC<MobileActionBarProps> = ({
  sortOrder,
  setSortOrder,
  filters,
}) => {
  const [visible, setVisible] = useState(true);
  const [panelOpen, setPanelOpen] = useState<'sort' | 'filter' | null>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  // Scroll direction detection
  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY < 10) {
          setVisible(true);
        } else if (currentY > lastScrollY.current + 8) {
          setVisible(false);
        } else if (currentY < lastScrollY.current - 8) {
          setVisible(true);
        }
        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Keep bar visible when a panel is open
  const isBarVisible = visible || panelOpen !== null;

  // Filter state bridge
  const filterState: FilterState = {
    collectionId: filters.collectionId ?? null,
    formatTagIds: filters.formatTagIds ?? [],
    domainTagIds: filters.domainTagIds ?? [],
    subtopicTagIds: filters.subtopicTagIds ?? [],
  };

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    filters.setCollectionId(newFilters.collectionId);
    const syncDimension = (prev: string[], next: string[], toggle: (id: string) => void) => {
      for (const id of next) {
        if (!prev.includes(id)) toggle(id);
      }
      for (const id of prev) {
        if (!next.includes(id)) toggle(id);
      }
    };
    syncDimension(filters.formatTagIds, newFilters.formatTagIds || [], filters.toggleFormatTag);
    syncDimension(filters.domainTagIds, newFilters.domainTagIds || [], filters.toggleDomainTag);
    syncDimension(filters.subtopicTagIds, newFilters.subtopicTagIds || [], filters.toggleSubtopicTag);
  }, [filters]);

  const handleFilterClear = useCallback(() => {
    filters.setCollectionId(null);
    filters.clearFormatTags();
    filters.clearDomainTags();
    filters.clearSubtopicTags();
  }, [filters]);

  const hasActiveFilters = filters.hasActiveFilters ?? false;
  const activeFilterCount = filters.activeFilterCount ?? 0;

  return (
    <>
      {/* Bottom Action Bar — mobile only */}
      <div
        className={`fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 transition-transform duration-300 ease-in-out pb-[env(safe-area-inset-bottom)]`}
        style={{
          zIndex: Z_INDEX.HEADER,
          transform: isBarVisible ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        <div className="flex items-stretch h-12">
          {/* Sort Button */}
          <button
            onClick={() => setPanelOpen(panelOpen === 'sort' ? null : 'sort')}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium border-r border-gray-200 transition-colors ${
              panelOpen === 'sort' ? 'text-yellow-600 bg-yellow-50' : 'text-gray-700 active:bg-gray-50'
            }`}
            aria-label="Sort"
          >
            <ArrowUpDown size={16} />
            SORT
          </button>

          {/* Filter Button */}
          <button
            onClick={() => setPanelOpen(panelOpen === 'filter' ? null : 'filter')}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative ${
              panelOpen === 'filter' || hasActiveFilters ? 'text-yellow-600 bg-yellow-50' : 'text-gray-700 active:bg-gray-50'
            }`}
            aria-label={`Filter${hasActiveFilters ? ` (${activeFilterCount} active)` : ''}`}
          >
            <Filter size={16} fill={hasActiveFilters ? 'currentColor' : 'none'} />
            FILTER
            {hasActiveFilters && (
              <span className="w-4 h-4 bg-yellow-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Sheet Panels — rendered via portal */}
      {panelOpen !== null && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 lg:hidden"
            style={{ zIndex: Z_INDEX.HEADER_OVERLAY - 1 }}
            onClick={() => setPanelOpen(null)}
          />

          {/* Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 lg:hidden bg-white rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto animate-slide-up pb-[env(safe-area-inset-bottom)]"
            style={{ zIndex: Z_INDEX.HEADER_OVERLAY }}
          >
            {/* Handle + Close */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {panelOpen === 'sort' ? 'Sort By' : 'Filters'}
              </h3>
              <button
                onClick={() => setPanelOpen(null)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              {panelOpen === 'sort' && (
                <div className="space-y-1">
                  {([
                    { value: 'latest' as const, label: 'Latest First' },
                    { value: 'oldest' as const, label: 'Oldest First' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortOrder(opt.value);
                        setPanelOpen(null);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        sortOrder === opt.value
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {panelOpen === 'filter' && (
                <FilterPopover
                  filters={filterState}
                  onChange={handleFilterChange}
                  onClear={handleFilterClear}
                  variant="embedded"
                />
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
};
