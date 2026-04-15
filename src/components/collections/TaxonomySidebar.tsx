import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FolderTree, X } from 'lucide-react';
import { getOverlayHost } from '@/utils/overlayHosts';

export interface TaxonomyNode {
  id: string;
  name: string;
  count: number;
  children: Array<{
    id: string;
    name: string;
    count: number;
  }>;
}

interface TaxonomySidebarProps {
  groups: TaxonomyNode[];
  selectedParentId: string | null;
  selectedChildId: string | null;
  onSelectParent: (id: string | null) => void;
  onSelectChild: (id: string | null) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  resultCount?: number;
  onClearAll?: () => void;
}

const TaxonomySidebarContent: React.FC<Omit<TaxonomySidebarProps, 'isMobileOpen' | 'onCloseMobile'>> = ({
  groups,
  selectedParentId,
  selectedChildId,
  onSelectParent,
  onSelectChild,
}) => {
  const initialExpanded = useMemo(() => {
    if (selectedParentId) {
      return new Set([selectedParentId]);
    }
    return new Set<string>();
  }, [selectedParentId]);
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = !selectedParentId && !selectedChildId;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
          Taxonomy
        </p>
        <span className="text-[10.5px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
          {groups.length}
        </span>
      </div>

      <button
        onClick={() => {
          onSelectParent(null);
          onSelectChild(null);
        }}
        className={`flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          isAllSelected
            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        <FolderTree size={15} className={isAllSelected ? '' : 'text-slate-400 dark:text-slate-500'} />
        <span className="flex-1 truncate">All collections</span>
      </button>

      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {groups.map((group) => {
          const isExpanded = expanded.has(group.id);
          const isParentSelected = selectedParentId === group.id && !selectedChildId;
          const isParentActive = selectedParentId === group.id;

          return (
            <div key={group.id}>
              <div
                className={`group relative flex items-stretch rounded-md transition-colors ${
                  isParentSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isParentActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary-500" />
                )}
                <button
                  onClick={() => toggleExpanded(group.id)}
                  className="inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-l-md text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                  aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
                  aria-expanded={isExpanded}
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>

                <button
                  onClick={() => {
                    onSelectParent(group.id);
                    onSelectChild(null);
                  }}
                  className={`flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-r-md pr-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    isParentSelected
                      ? 'font-semibold text-primary-700 dark:text-primary-300'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                  title={group.name}
                >
                  <span className="truncate">{group.name}</span>
                  <span
                    className={`shrink-0 text-[11px] font-medium tabular-nums ${
                      isParentSelected
                        ? 'text-primary-600 dark:text-primary-300'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {group.count}
                  </span>
                </button>
              </div>

              <div
                className={`grid overflow-hidden transition-all duration-200 ease-out ${
                  isExpanded && group.children.length > 0
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="min-h-0">
                  <div className="relative ml-[14px] border-l border-slate-200 pl-1.5 py-1 dark:border-slate-700">
                    {group.children.map((child) => {
                      const isChildSelected = selectedChildId === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => {
                            onSelectParent(group.id);
                            onSelectChild(child.id);
                          }}
                          className={`flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                            isChildSelected
                              ? 'bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                          title={child.name}
                        >
                          <span className="truncate">{child.name}</span>
                          <span
                            className={`shrink-0 text-[10.5px] font-medium tabular-nums ${
                              isChildSelected
                                ? 'text-primary-600 dark:text-primary-300'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {child.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TaxonomySidebar: React.FC<TaxonomySidebarProps> = ({
  isMobileOpen,
  onCloseMobile,
  resultCount,
  onClearAll,
  ...props
}) => {
  const [animState, setAnimState] = useState<'closed' | 'entering' | 'open' | 'exiting'>('closed');
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (isMobileOpen) {
      if (animState === 'closed' || animState === 'exiting') {
        setAnimState('entering');
        const raf1 = requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimState('open'));
        });
        return () => cancelAnimationFrame(raf1);
      }
    } else if (animState === 'open' || animState === 'entering') {
      setAnimState('exiting');
      const timer = setTimeout(() => setAnimState('closed'), 250);
      return () => clearTimeout(timer);
    }
  }, [isMobileOpen, animState]);

  // Lock body scroll while the sheet is mounted. Capture "previous" once per open cycle
  // so we can't stash "hidden" as the restore target and leave the page frozen on close.
  const sheetMounted = animState !== 'closed';
  useEffect(() => {
    if (!sheetMounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetMounted]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const hasActiveFilter = props.selectedParentId !== null || props.selectedChildId !== null;
  const shouldRenderSheet = animState !== 'closed';
  const isVisible = animState === 'open';

  return (
    <>
      <aside className="hidden lg:sticky lg:top-[146px] lg:block lg:self-start">
        <div className="h-[calc(100vh-170px)] min-h-[420px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <TaxonomySidebarContent {...props} />
        </div>
      </aside>

      {shouldRenderSheet && typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed inset-0 bg-slate-900/45 transition-opacity duration-200 lg:hidden ${isVisible ? 'opacity-100 pointer-events-auto' : 'pointer-events-none opacity-0'}`}
            onClick={onCloseMobile}
            role="presentation"
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Filter collections"
              onClick={(event) => event.stopPropagation()}
              className={`absolute bottom-0 left-0 right-0 mx-auto flex h-[85dvh] w-full max-w-[640px] flex-col rounded-t-3xl bg-white text-slate-900 shadow-2xl transition-transform duration-250 ease-out motion-reduce:transition-none dark:bg-slate-900 dark:text-slate-100 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
            >
              <div
                className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-2 dark:border-slate-800"
                onTouchStart={(event) => {
                  touchStartYRef.current = event.touches[0]?.clientY ?? null;
                }}
                onTouchMove={(event) => {
                  const currentY = event.touches[0]?.clientY ?? null;
                  if (touchStartYRef.current == null || currentY == null) return;
                  if (currentY - touchStartYRef.current > 80) onCloseMobile();
                }}
                onTouchEnd={() => { touchStartYRef.current = null; }}
              >
                <div className="mx-auto mb-2.5 h-1 w-12 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden />
                <div className="flex min-h-11 items-center justify-between">
                  <div>
                    <h2 className="text-[17px] font-semibold leading-tight">Filter by taxonomy</h2>
                    <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                      {hasActiveFilter ? '1 filter applied' : 'No filters applied'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Close filters"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <TaxonomySidebarContent {...props} />
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  {hasActiveFilter && onClearAll && (
                    <button
                      type="button"
                      onClick={onClearAll}
                      className="min-h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    className="min-h-11 flex-1 rounded-full bg-slate-900 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    {typeof resultCount === 'number'
                      ? `Show ${resultCount} collection${resultCount !== 1 ? 's' : ''}`
                      : 'View results'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          getOverlayHost('drawer'),
        )}
    </>
  );
};
