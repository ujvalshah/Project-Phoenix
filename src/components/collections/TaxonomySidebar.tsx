import React, { useMemo, useState } from 'react';
import { ChevronDown, FolderTree, X } from 'lucide-react';

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
  ...props
}) => {
  return (
    <>
      <aside className="hidden lg:sticky lg:top-[146px] lg:block lg:self-start">
        <div className="h-[calc(100vh-170px)] min-h-[420px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <TaxonomySidebarContent {...props} />
        </div>
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            className="flex-1 bg-slate-900/45 backdrop-blur-[2px] animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-label="Close filters"
          />
          <div className="flex h-full w-[88vw] max-w-sm flex-col border-l border-slate-200 bg-white p-3 shadow-xl animate-in slide-in-from-right duration-200 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</p>
              <button
                onClick={onCloseMobile}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="Close filters"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <TaxonomySidebarContent {...props} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
