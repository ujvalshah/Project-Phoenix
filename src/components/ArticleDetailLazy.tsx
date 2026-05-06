import React, { lazy } from 'react';

/**
 * Lazy `ArticleDetail` (+ react-markdown stack) loaded only when a surface mounts it:
 * drawer, modal, or lightbox sidebar — avoids pulling the chunk on initial feed/grid paint.
 */
let articleDetailModulePromise: Promise<typeof import('./ArticleDetail')> | null = null;

function loadArticleDetailModule(): Promise<typeof import('./ArticleDetail')> {
  if (!articleDetailModulePromise) {
    articleDetailModulePromise = import('./ArticleDetail');
  }
  return articleDetailModulePromise;
}

export const ArticleDetailLazy = lazy(() =>
  loadArticleDetailModule().then((m) => ({ default: m.ArticleDetail })),
);

/** Opportunistic preload for instant drawer/modal shell handoff on CTA click. */
export function preloadArticleDetail(): Promise<void> {
  return loadArticleDetailModule().then(() => undefined);
}

/** Narrow rails (lightbox sidebar). */
export function ArticleDetailSidebarFallback(): React.ReactElement {
  return (
    <div
      className="animate-pulse space-y-3 p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
      aria-busy="true"
      aria-label="Loading article"
    >
      <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800/90" />
      <div className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800/75" />
    </div>
  );
}

/** Full panel (drawer / modal shell). Matches ArticleDrawer previous fallback. */
export function ArticleDetailPanelFallback(): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading article...</p>
      </div>
    </div>
  );
}
