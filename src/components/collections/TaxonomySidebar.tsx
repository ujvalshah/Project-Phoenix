import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, PanelLeftClose, RotateCcw, X } from 'lucide-react';
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
  isDesktopCollapsed?: boolean;
  onExpandDesktop?: () => void;
  onCollapseDesktop?: () => void;
}

const TaxonomySidebarContent: React.FC<
  Omit<TaxonomySidebarProps, 'isMobileOpen' | 'onCloseMobile'> & {
    showCollapseButton?: boolean;
    isMobileSheet?: boolean;
    onSelectScope?: () => void;
  }
> = ({
  groups,
  selectedParentId,
  selectedChildId,
  onSelectParent,
  onSelectChild,
  onCollapseDesktop,
  showCollapseButton = false,
  isMobileSheet = false,
  onSelectScope,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    selectedParentId ? new Set([selectedParentId]) : new Set<string>(),
  );

  // Auto-expand when a parent is selected externally (e.g., chip strip click)
  useEffect(() => {
    if (!selectedParentId) return;
    const frame = requestAnimationFrame(() => {
      setExpanded((prev) => {
        if (prev.has(selectedParentId)) return prev;
        const next = new Set(prev);
        next.add(selectedParentId);
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedParentId]);

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
  const parentRowClass = isMobileSheet ? 'h-11' : 'h-9';
  const parentToggleClass = isMobileSheet ? 'h-11 w-10' : 'h-9 w-7';
  const childRowClass = isMobileSheet ? 'h-11' : 'h-8';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-1 pb-2.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
          Browse topics
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
            {groups.length}
          </span>
          {showCollapseButton && onCollapseDesktop && (
            <button
              type="button"
              onClick={onCollapseDesktop}
              aria-label="Collapse topic browser"
              title="Collapse"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <PanelLeftClose size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-0.5 rounded-md border border-dashed border-slate-200/80 px-2.5 py-2 dark:border-slate-700/70">
        <button
          onClick={() => {
            onSelectParent(null);
            onSelectChild(null);
            onSelectScope?.();
          }}
          className={`inline-flex min-h-9 items-center gap-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
            isAllSelected
              ? 'text-primary-700 dark:text-primary-300'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <RotateCcw size={13} />
          Browse all collections
        </button>
      </div>

      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto pr-1">
        <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
          Topics
        </p>
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
                  className={`inline-flex ${parentToggleClass} shrink-0 items-center justify-center rounded-l-md text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200`}
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
                    if (isParentActive) {
                      onSelectParent(null);
                      onSelectChild(null);
                      setExpanded((prev) => {
                        if (!prev.has(group.id)) return prev;
                        const next = new Set(prev);
                        next.delete(group.id);
                        return next;
                      });
                    } else {
                      onSelectParent(group.id);
                      onSelectChild(null);
                    }
                    onSelectScope?.();
                  }}
                  className={`flex ${parentRowClass} min-w-0 flex-1 items-center justify-between gap-2 rounded-r-md pr-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
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
                            onSelectScope?.();
                          }}
                          className={`flex ${childRowClass} w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
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
  isDesktopCollapsed = false,
  onExpandDesktop,
  onCollapseDesktop,
  ...props
}) => {
  const [animState, setAnimState] = useState<'closed' | 'entering' | 'open' | 'exiting'>('closed');
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (isMobileOpen) {
      if (animState === 'closed' || animState === 'exiting') {
        const raf1 = requestAnimationFrame(() => {
          setAnimState('entering');
          requestAnimationFrame(() => setAnimState('open'));
        });
        return () => cancelAnimationFrame(raf1);
      }
    } else if (animState === 'open' || animState === 'entering') {
      const raf = requestAnimationFrame(() => setAnimState('exiting'));
      const timer = setTimeout(() => setAnimState('closed'), 250);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [isMobileOpen, animState]);

  // Lock body scroll only while the sheet is logically open. The sheet stays mounted
  // during its exit animation, but the page must regain native scroll immediately.
  const sheetMounted = animState !== 'closed';
  useEffect(() => {
    if (!isMobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileOpen]);

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

  const selectedParentGroup = props.selectedParentId
    ? props.groups.find((group) => group.id === props.selectedParentId)
    : undefined;
  const selectedChildNode = props.selectedChildId
    ? selectedParentGroup?.children.find((child) => child.id === props.selectedChildId) ??
      props.groups.flatMap((group) => group.children).find((child) => child.id === props.selectedChildId)
    : undefined;
  const selectedScopeLabel = selectedChildNode && selectedParentGroup
    ? `${selectedParentGroup.name} / ${selectedChildNode.name}`
    : selectedParentGroup?.name;
  const hasActiveScope = Boolean(selectedScopeLabel);
  const resultSummary = typeof resultCount === 'number'
    ? `${resultCount} result${resultCount !== 1 ? 's' : ''}`
    : null;
  const shouldRenderSheet = animState !== 'closed';
  const isVisible = animState === 'open';

  return (
    <>
      {!isDesktopCollapsed ? (
        <aside className="hidden lg:sticky lg:top-[146px] lg:block lg:self-start">
          <div className="h-[calc(100vh-170px)] min-h-[420px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <TaxonomySidebarContent
              {...props}
              onCollapseDesktop={onCollapseDesktop}
              showCollapseButton
            />
          </div>
        </aside>
      ) : (
        <aside className="hidden lg:sticky lg:top-[146px] lg:block lg:self-start">
          <button
            type="button"
            onClick={onExpandDesktop}
            className="flex h-[calc(100vh-170px)] min-h-[420px] w-10 flex-col items-center justify-start gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Expand topic browser"
          >
            <span className="[writing-mode:vertical-rl]">Topics</span>
          </button>
        </aside>
      )}

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
              aria-label="Browse topics"
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
                    <h2 className="text-[17px] font-semibold leading-tight">Browse topics</h2>
                    <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                      {selectedScopeLabel
                        ? `Scope: ${selectedScopeLabel}${resultSummary ? ` · ${resultSummary}` : ''}`
                        : `All collections${resultSummary ? ` · ${resultSummary}` : ''}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Close topic browser"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <TaxonomySidebarContent {...props} isMobileSheet onSelectScope={onCloseMobile} />
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  {hasActiveScope && onClearAll && (
                    <button
                      type="button"
                      onClick={onClearAll}
                      className="min-h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Clear scope
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    aria-label="Close topic browser"
                    className="min-h-11 flex-1 rounded-full bg-slate-900 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    Done
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
