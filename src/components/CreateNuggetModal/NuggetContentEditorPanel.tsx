import React, { lazy, Suspense, type ComponentProps } from 'react';
import { isNuggetEditorLazySplitEnabled } from '@/config/nuggetPerformanceConfig';
import { ContentEditor } from './ContentEditor';

const contentEditorFallback = (
  <div
    className="min-h-[120px] rounded-xl border border-slate-200/80 bg-slate-100/60 dark:border-slate-700/60 dark:bg-slate-800/50 animate-pulse"
    role="status"
    aria-live="polite"
    aria-label="Loading text editor"
  />
);

type Props = ComponentProps<typeof ContentEditor>;

const USE_LAZY_EDITOR = isNuggetEditorLazySplitEnabled();

const ContentEditorLazy = lazy(() =>
  import('./ContentEditor').then((m) => ({ default: m.ContentEditor })),
);

/**
 * Rich-text area for the nugget form. Lazy by default; sync when editor-splitting is disabled.
 */
export function NuggetContentEditorPanel(props: Props) {
  if (USE_LAZY_EDITOR) {
    return (
      <Suspense fallback={contentEditorFallback}>
        <ContentEditorLazy {...props} />
      </Suspense>
    );
  }
  return <ContentEditor {...props} />;
}
