import React from 'react';

export const CollectionsSkeletonState: React.FC = () => {
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <div className="hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="mb-2 h-9 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
      <div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 h-6 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="mt-4 lg:hidden">
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex min-h-[4.5rem] items-center gap-3 px-3 py-2.5">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 max-w-[14rem] animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 max-w-[10rem] animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-3 w-32 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
