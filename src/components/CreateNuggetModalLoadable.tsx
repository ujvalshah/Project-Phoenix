import { lazy, Suspense, type ReactNode } from 'react';
import type { CreateNuggetModalProps } from './CreateNuggetModal';
import { loadCreateNuggetModalModule } from './createNuggetModalChunk';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';

/**
 * React.lazy + same module promise as `preloadCreateNuggetModalChunk` (no duplicate fetches).
 * Do not import CreateNuggetModal from feature routes/cards; use this wrapper only.
 */
const CreateNuggetModalCore = lazy(() =>
  loadCreateNuggetModalModule().then((m) => ({ default: m.CreateNuggetModal })),
);

export type CreateNuggetModalLoadableProps = CreateNuggetModalProps & {
  fallback?: ReactNode;
};

const defaultFallback = (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-black/40"
    role="status"
    aria-label="Loading editor"
  >
    <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
  </div>
);

/**
 * Renders nothing when `isOpen` is false (no lazy chunk, no editor hooks).
 * Prefer `condition && <CreateNuggetModalLoadable isOpen … />` at call sites
 * to avoid a wrapper instance when the modal is unused.
 */
const modalErrorFallback = (onClose: () => void) => (
  <div
    className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-slate-900/30 p-6 text-center dark:bg-black/50"
    role="alert"
  >
    <p className="max-w-sm text-sm font-medium text-slate-800 dark:text-slate-100">
      The nugget editor could not be loaded. Your work elsewhere in the app is unchanged.
    </p>
    <button
      type="button"
      onClick={onClose}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
    >
      Close
    </button>
  </div>
);

export function CreateNuggetModalLoadable({ fallback, ...props }: CreateNuggetModalLoadableProps) {
  if (!props.isOpen) {
    return null;
  }
  return (
    <ErrorBoundary fallback={modalErrorFallback(props.onClose)}>
      <Suspense fallback={fallback ?? defaultFallback}>
        <CreateNuggetModalCore {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
