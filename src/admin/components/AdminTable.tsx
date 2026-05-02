
import React, { useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { ChevronLeft, ChevronRight, Loader2, Search, ArrowUp, ArrowDown } from 'lucide-react';

/** Fixed row body height for window virtualization (`py-2.5` + single-line `text-sm`). */
const ADMIN_TABLE_VIRTUAL_ROW_HEIGHT_PX = 49;
/** Avoid virtualizer overhead for tiny lists. */
const ADMIN_TABLE_VIRTUAL_MIN_ROWS = 24;

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  minWidth?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
  hideOnMobile?: boolean;
  sticky?: 'left' | 'right';
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  showTopPagination?: boolean;
  onSearch?: (query: string) => void;
  placeholder?: string;

  sortKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;

  onRowClick?: (row: T) => void;

  expandedRowId?: string | null;
  expandedRowContent?: (row: T) => React.ReactNode;

  selection?: {
    selectedIds: string[];
    onSelect: (ids: string[]) => void;
    enabled: boolean;
  };

  emptyState?: React.ReactNode;

  /** When true, long tables use `@tanstack/react-virtual` window scrolling with fixed row height. */
  virtualized?: boolean;
  /** @deprecated Unused — row height is fixed for virtualization */
  virtualHeight?: number;
}

function AdminTableComponent<T extends { id: string }>({
  columns,
  data,
  isLoading,
  filters,
  actions,
  pagination,
  showTopPagination = false,
  onSearch,
  placeholder = "Search...",
  sortKey,
  sortDirection,
  onSortChange,
  onRowClick,
  expandedRowId,
  expandedRowContent,
  selection,
  emptyState,
  virtualized = false,
}: AdminTableProps<T>) {

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tbodyMeasureRef = useRef<HTMLTableSectionElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const hasActiveExpandedRow = Boolean(expandedRowContent && expandedRowId);
  const shouldWindowVirtualize =
    virtualized &&
    !isLoading &&
    data.length >= ADMIN_TABLE_VIRTUAL_MIN_ROWS &&
    !hasActiveExpandedRow;

  useLayoutEffect(() => {
    if (!shouldWindowVirtualize) return;
    const el = tbodyMeasureRef.current;
    if (!el) return;
    const update = () => {
      setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [shouldWindowVirtualize, columns.length, selection?.enabled, data.length]);

  const virtualizer = useWindowVirtualizer({
    count: data.length,
    estimateSize: () => ADMIN_TABLE_VIRTUAL_ROW_HEIGHT_PX,
    overscan: 10,
    scrollMargin,
    enabled: shouldWindowVirtualize,
    getItemKey: (index) => data[index]?.id ?? index,
  });

  useLayoutEffect(() => {
    if (!shouldWindowVirtualize) return;
    virtualizer.measure();
  }, [virtualizer, shouldWindowVirtualize, scrollMargin, data.length]);

  const colSpanTotal = columns.length + (selection?.enabled ? 1 : 0);

  const handleHeaderClick = (col: Column<T>) => {
    if (!col.sortable || !onSortChange) return;
    const key = col.sortKey || col.key;
    const dir = (key === sortKey && sortDirection === 'desc') ? 'asc' : 'desc';
    onSortChange(key, dir);
  };

  const handleSelectAll = (checked: boolean) => {
    if (!selection) return;
    selection.onSelect(checked ? data.map(item => item.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (!selection) return;
    selection.onSelect(
      checked
        ? [...selection.selectedIds, id]
        : selection.selectedIds.filter(s => s !== id)
    );
  };

  // Sticky column helpers — solid bg so content doesn't bleed through
  const stickyHeaderClass = (col: Column<T>) => {
    if (!col.sticky) return '';
    const base = 'bg-slate-50 dark:bg-slate-800';
    if (col.sticky === 'left') return `sticky left-0 z-20 ${base}`;
    return `sticky right-0 z-20 ${base}`;
  };

  const stickyCellClass = (col: Column<T>, isSelected: boolean) => {
    if (!col.sticky) return '';
    const bg = isSelected
      ? 'bg-primary-50 dark:bg-primary-900/10'
      : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50';
    if (col.sticky === 'left') return `sticky left-0 z-10 ${bg}`;
    return `sticky right-0 z-10 ${bg}`;
  };

  const alignClass = (a?: string) =>
    a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';

  const renderRowFragment = (row: T, index: number) => {
    const isSelected = selection?.selectedIds.includes(row.id) ?? false;
    const isExpanded = expandedRowId === row.id;
    return (
      <React.Fragment key={row.id}>
        <tr
          onClick={() => onRowClick?.(row)}
          tabIndex={onRowClick ? 0 : -1}
          onKeyDown={(e) => {
            if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onRowClick(row);
            }
          }}
          className={`
            group border-b border-slate-100 dark:border-slate-800/50 last:border-0
            ${onRowClick ? 'cursor-pointer' : ''}
            ${isSelected
              ? 'bg-primary-50/60 dark:bg-primary-900/10'
              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
            }
          `}
        >
          {selection?.enabled && (
            <td
              className={`w-10 px-3 py-2 sticky left-0 z-10 ${isSelected ? 'bg-primary-50 dark:bg-primary-900/10' : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                aria-label={`Select row ${row.id}`}
                className="rounded border-slate-300 dark:border-slate-600 cursor-pointer"
                checked={isSelected}
                onChange={(e) => handleSelectRow(row.id, e.target.checked)}
              />
            </td>
          )}
          {columns.map((col, colIdx) => (
            <td
              key={`${row.id}-${col.key || colIdx}`}
              className={`
                px-3 py-2 text-sm whitespace-nowrap
                ${alignClass(col.align)}
                ${col.hideOnMobile ? 'hidden md:table-cell' : ''}
                ${stickyCellClass(col, isSelected)}
              `}
            >
              {col.render ? col.render(row, index) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
            </td>
          ))}
        </tr>
        {isExpanded && expandedRowContent && (
          <tr className="border-b border-slate-100 dark:border-slate-800/50">
            <td
              colSpan={colSpanTotal}
              className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30"
            >
              {expandedRowContent(row)}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const getPaginationItems = (page: number, totalPages: number): Array<number | '...'> => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    const items: Array<number | '...'> = [1];

    let start = Math.max(2, page - 1);
    let end = Math.min(totalPages - 1, page + 1);

    if (page <= 3) {
      start = 2;
      end = 4;
    } else if (page >= totalPages - 2) {
      start = totalPages - 3;
      end = totalPages - 1;
    }

    if (start > 2) {
      items.push('...');
    }

    for (let p = start; p <= end; p++) {
      items.push(p);
    }

    if (end < totalPages - 1) {
      items.push('...');
    }

    items.push(totalPages);
    return items;
  };

  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const items = getPaginationItems(pagination.page, pagination.totalPages);

    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
            disabled={pagination.page === 1}
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <ChevronLeft size={14} />
          </button>
          {items.map((item, idx) =>
            item === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-[11px] text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={`page-${item}`}
                onClick={() => pagination.onPageChange(item)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                  item === pagination.page
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {item}
              </button>
            )
          )}
          <button
            onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
            disabled={pagination.page === pagination.totalPages}
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(filters || actions || onSearch) && (
        <div
          className={`flex min-w-0 gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm ${
            actions ? 'flex-col' : 'flex-col md:flex-row md:items-center md:justify-between'
          }`}
        >
          <div className="flex min-w-0 w-full flex-1 flex-wrap items-center gap-2">
            {onSearch && (
              <div className="relative w-full min-w-[min(100%,12rem)] max-w-full sm:max-w-none md:w-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  aria-label="Search table"
                  placeholder={placeholder}
                  onChange={(e) => onSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-48 lg:w-64"
                />
              </div>
            )}
            {filters}
          </div>
          {actions && (
            <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2 dark:border-slate-800 md:border-t-0 md:pt-0">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm relative">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 z-30 flex items-center justify-center rounded-xl">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        )}

        {showTopPagination && pagination && pagination.totalPages > 1 && (
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-2 bg-slate-50/50 dark:bg-slate-900">
            {renderPagination()}
          </div>
        )}

        {/* Scroll container — horizontal only, vertical grows naturally */}
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full border-collapse table-auto">
            {/* Header */}
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
              <tr>
                {selection?.enabled && (
                  <th className="w-10 px-3 py-2.5 sticky left-0 z-20 bg-slate-50 dark:bg-slate-800">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      className="rounded border-slate-300 dark:border-slate-600 cursor-pointer"
                      checked={data.length > 0 && selection.selectedIds.length === data.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                )}
                {columns.map((col, idx) => (
                  <th
                    key={col.key || `col-${idx}`}
                    onClick={() => col.sortable && handleHeaderClick(col)}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                    className={`
                      px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider
                      text-slate-500 dark:text-slate-400 select-none whitespace-nowrap
                      ${col.width || ''}
                      ${alignClass(col.align)}
                      ${col.hideOnMobile ? 'hidden md:table-cell' : ''}
                      ${col.sortable ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200' : ''}
                      ${stickyHeaderClass(col)}
                    `}
                  >
                    <span className={`inline-flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                      {col.header}
                      {col.sortable && sortKey === (col.sortKey || col.key) && (
                        sortDirection === 'asc'
                          ? <ArrowUp size={11} className="text-primary-500" />
                          : <ArrowDown size={11} className="text-primary-500" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody ref={shouldWindowVirtualize ? tbodyMeasureRef : undefined}>
              {isLoading ? (
                // Skeleton rows
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`sk-${idx}`} className="border-b border-slate-100 dark:border-slate-800/50">
                    {selection?.enabled && (
                      <td className="px-3 py-2.5 w-10">
                        <div className="h-4 w-4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                      </td>
                    )}
                    {columns.map((col, cIdx) => (
                      <td key={`sk-${idx}-${cIdx}`} className={`px-3 py-2.5 ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}>
                        <div className="h-3.5 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={colSpanTotal} className="px-6 py-16 text-center">
                    {emptyState || (
                      <div className="text-slate-400">
                        <p className="text-sm font-medium">No records found</p>
                        <p className="text-xs mt-1">Try adjusting filters</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : shouldWindowVirtualize ? (
                (() => {
                  const items = virtualizer.getVirtualItems();
                  const totalSize = virtualizer.getTotalSize();
                  const topPad = items.length > 0 ? items[0].start : 0;
                  const bottomPad =
                    items.length > 0 ? Math.max(0, totalSize - items[items.length - 1].end) : 0;
                  return (
                    <>
                      {topPad > 0 && (
                        <tr aria-hidden className="pointer-events-none">
                          <td
                            colSpan={colSpanTotal}
                            className="p-0 border-0 align-top"
                            style={{ height: topPad, lineHeight: 0 }}
                          />
                        </tr>
                      )}
                      {items.map((vi) => {
                        const row = data[vi.index];
                        if (!row) return null;
                        return renderRowFragment(row, vi.index);
                      })}
                      {bottomPad > 0 && (
                        <tr aria-hidden className="pointer-events-none">
                          <td
                            colSpan={colSpanTotal}
                            className="p-0 border-0 align-top"
                            style={{ height: bottomPad, lineHeight: 0 }}
                          />
                        </tr>
                      )}
                    </>
                  );
                })()
              ) : (
                data.map((row, index) => renderRowFragment(row, index))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
            {renderPagination()}
          </div>
        )}
      </div>
    </div>
  );
}

export const AdminTable = AdminTableComponent;
