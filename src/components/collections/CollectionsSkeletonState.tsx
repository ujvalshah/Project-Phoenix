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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
