import React from 'react';
import { ChevronRight } from 'lucide-react';

interface CollectionsHeaderProps {
  totalCount: number;
  visibleCount: number;
  breadcrumb: string[];
}

export const CollectionsHeader: React.FC<CollectionsHeaderProps> = ({
  totalCount,
  visibleCount,
  breadcrumb,
}) => {
  const hasPath = breadcrumb.length > 0;
  const isFiltered = visibleCount !== totalCount;

  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-slate-900 dark:text-slate-50 sm:text-[1.55rem]">
            Community Collections
          </h1>
          <span
            className="hidden items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex"
            aria-label={`${totalCount} total collections`}
          >
            {isFiltered ? `${visibleCount} / ${totalCount}` : totalCount}
          </span>
        </div>
        {hasPath ? (
          <nav aria-label="Breadcrumb" className="mt-1 flex min-w-0 items-center text-[13px] text-slate-500 dark:text-slate-400">
            {breadcrumb.map((crumb, index) => (
              <React.Fragment key={`${crumb}-${index}`}>
                {index > 0 && (
                  <ChevronRight size={12} className="mx-1 shrink-0 text-slate-300 dark:text-slate-600" />
                )}
                <span
                  className={`truncate ${
                    index === breadcrumb.length - 1
                      ? 'font-medium text-slate-700 dark:text-slate-200'
                      : ''
                  }`}
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <p className="mt-1 truncate text-[13px] text-slate-500 dark:text-slate-400">
            Explore curated topics and nested sub-collections across the Nuggets ecosystem.
          </p>
        )}
      </div>
    </header>
  );
};
