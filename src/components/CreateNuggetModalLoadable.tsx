import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import type { CreateNuggetModalProps } from './CreateNuggetModal';
import type { NuggetComposerHandle } from './NuggetComposerContent';
import { loadCreateNuggetModalModule } from './createNuggetModalChunk';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';
import { NuggetModalShell, NuggetComposerBodySkeleton } from '@/components/modals/NuggetModalShell';
import { getNuggetModalCtpBudgetWarnMs } from '@/utils/nuggetModalPerfConfig';

const NuggetComposerLazy = lazy(() =>
  loadCreateNuggetModalModule().then((m) => ({ default: m.default })),
);

export type CreateNuggetModalLoadableProps = CreateNuggetModalProps & {
  fallback?: ReactNode;
};

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

export function CreateNuggetModalLoadable({ fallback: _fallback, ...props }: CreateNuggetModalLoadableProps) {
  if (!props.isOpen) {
    return null;
  }

  const { isOpen, onClose, mode = 'create', initialData, prefillData } = props;

  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<NuggetComposerHandle | null>(null);

  const [shellTitle, setShellTitle] = useState('');
  const [shellVisibility, setShellVisibility] = useState<'public' | 'private'>('public');
  const [composerReady, setComposerReady] = useState(false);
  const [footerMeta, setFooterMeta] = useState({
    canSubmit: false,
    isSubmitting: false,
    contentError: null as string | null,
    titleFieldWarning: null as string | null,
  });

  const onFooterMetaChange = useCallback(
    (meta: {
      canSubmit: boolean;
      isSubmitting: boolean;
      contentError: string | null;
      titleFieldWarning: string | null;
    }) => {
      setFooterMeta(meta);
    },
    [],
  );

  const onComposerReady = useCallback(() => {
    setComposerReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    setComposerReady(false);
    const t = initialData?.title ?? prefillData?.title ?? '';
    const v = (initialData?.visibility ?? prefillData?.visibility ?? 'public') as 'public' | 'private';
    setShellTitle(t);
    setShellVisibility(v);
  }, [isOpen, initialData?.id, prefillData?.id, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const budget = getNuggetModalCtpBudgetWarnMs();
    if (budget <= 0) return;
    const markA = `nugget-modal-ctp-a-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const markB = `${markA}-end`;
    const measureName = `nugget-modal-ctp-${markA}`;
    try {
      performance.mark(markA);
    } catch {
      return;
    }
    let raf1 = 0;
    let raf2 = 0;
    let cancelled = false;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          performance.mark(markB);
          performance.measure(measureName, markA, markB);
          const entry = performance.getEntriesByName(measureName, 'measure').pop() as
            | PerformanceMeasure
            | undefined;
          const ms = entry?.duration ?? 0;
          performance.clearMarks(markA);
          performance.clearMarks(markB);
          performance.clearMeasures(measureName);
          if (ms > budget) {
            console.warn(
              `[perf] Nugget create modal (rAF-approx) ${ms.toFixed(0)}ms > budget ${budget}ms (set VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS=0 to disable)`,
            );
          }
        } catch {
          /* ignore */
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isOpen]);

  const currentLifecycleStatus: 'draft' | 'published' =
    initialData?.status === 'draft' ? 'draft' : 'published';

  const primaryLabel =
    mode === 'edit'
      ? currentLifecycleStatus === 'draft'
        ? 'Publish Nugget'
        : 'Save Changes'
      : 'Publish Nugget';

  const secondaryLabel =
    mode === 'edit'
      ? currentLifecycleStatus === 'draft'
        ? 'Update Draft'
        : undefined
      : 'Save Draft';

  const duplicateSubtitle = useMemo(() => {
    if (mode !== 'create' || !prefillData) return undefined;
    return `Duplicating from: ${prefillData.title?.trim() || 'Untitled'}`;
  }, [mode, prefillData]);

  const handleShellTitleChange = useCallback((v: string) => {
    setShellTitle(v);
    requestAnimationFrame(() => composerRef.current?.notifyTitleEditedByUser?.());
  }, []);

  const handleShellTitleBlur = useCallback(() => {
    requestAnimationFrame(() => composerRef.current?.onShellTitleBlur?.());
  }, []);

  const onVisibilityPublic = useCallback(() => {
    setShellVisibility('public');
    requestAnimationFrame(() => composerRef.current?.onUserChangedVisibility?.());
  }, []);

  const onVisibilityPrivate = useCallback(() => {
    setShellVisibility('private');
    requestAnimationFrame(() => composerRef.current?.onUserChangedVisibility?.());
  }, []);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    composerRef.current?.onFileSelect(e);
  }, []);

  const handleSubmit = useCallback((intent: 'draft' | 'publish') => {
    if (intent === 'draft') composerRef.current?.submitDraft();
    else composerRef.current?.submitPublish();
  }, []);

  return (
    <ErrorBoundary fallback={modalErrorFallback(onClose)}>
      <NuggetModalShell
        isOpen={isOpen}
        onClose={onClose}
        panelRef={panelRef}
        mode={mode}
        duplicateSubtitle={duplicateSubtitle}
        shellTitle={shellTitle}
        onShellTitleChange={handleShellTitleChange}
        onShellTitleBlur={handleShellTitleBlur}
        shellVisibility={shellVisibility}
        onVisibilityPublic={onVisibilityPublic}
        onVisibilityPrivate={onVisibilityPrivate}
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
        onSubmit={handleSubmit}
        isSubmitting={footerMeta.isSubmitting}
        canSubmit={footerMeta.canSubmit}
        primaryLabel={primaryLabel}
        secondaryLabel={secondaryLabel}
        composerReady={composerReady}
        titleContentError={footerMeta.contentError}
        titleFieldWarning={footerMeta.titleFieldWarning}
      >
        <Suspense fallback={<NuggetComposerBodySkeleton />}>
          <NuggetComposerLazy
            ref={composerRef}
            {...props}
            shellTitle={shellTitle}
            onShellTitleChange={setShellTitle}
            shellVisibility={shellVisibility}
            onShellVisibilityChange={setShellVisibility}
            shellFileInputRef={fileInputRef}
            onFooterMetaChange={onFooterMetaChange}
            onComposerReady={onComposerReady}
            shellPanelRef={panelRef}
          />
        </Suspense>
      </NuggetModalShell>
    </ErrorBoundary>
  );
}
