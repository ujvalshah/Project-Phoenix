import React from 'react';
import { Globe, Lock, X } from 'lucide-react';
import { ModalShell } from '@/components/UI/ModalShell';
import { FormFooter } from '@/components/CreateNuggetModal/FormFooter';

export function NuggetComposerBodySkeleton(): React.ReactElement {
  return (
    <div
      className="space-y-4 py-2"
      role="status"
      aria-label="Loading nugget form"
    >
      <div className="h-10 w-full rounded-xl bg-slate-200/80 dark:bg-slate-800/80 animate-pulse" />
      <div className="h-28 w-full rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
      <div className="h-36 w-full rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
    </div>
  );
}

export type NuggetModalShellProps = {
  isOpen: boolean;
  onClose: () => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
  mode: 'create' | 'edit';
  duplicateSubtitle?: string;
  shellTitle: string;
  onShellTitleChange: (v: string) => void;
  onShellTitleBlur: () => void;
  shellVisibility: 'public' | 'private';
  onVisibilityPublic: () => void;
  onVisibilityPrivate: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (intent: 'draft' | 'publish') => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  composerReady: boolean;
  /** Validation messages for shell title area (mirrors legacy TitleInput). */
  titleContentError?: string | null;
  titleFieldWarning?: string | null;
  children: React.ReactNode;
};

/**
 * Thin modal chrome (sync / main bundle via CreateNuggetModalLoadable).
 * No nugget business logic — only layout + shell-level fields + footer.
 */
export function NuggetModalShell({
  isOpen,
  onClose,
  panelRef,
  mode,
  duplicateSubtitle,
  shellTitle,
  onShellTitleChange,
  onShellTitleBlur,
  shellVisibility,
  onVisibilityPublic,
  onVisibilityPrivate,
  fileInputRef,
  onSubmit,
  isSubmitting,
  canSubmit,
  primaryLabel,
  secondaryLabel,
  composerReady,
  titleContentError,
  titleFieldWarning,
  onFileSelect,
  children,
}: NuggetModalShellProps): React.ReactElement {
  return (
    <ModalShell isOpen={isOpen} onClose={onClose} disableEscape disableScrollLock={false}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-4xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200 border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 shrink-0">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
              {mode === 'edit' ? 'Edit Nugget' : 'Create Nugget'}
            </h2>
            {duplicateSubtitle ? (
              <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{duplicateSubtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="title-input" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Title (Optional)
              </label>
              <input
                id="title-input"
                type="text"
                value={shellTitle}
                onChange={(e) => onShellTitleChange(e.target.value)}
                onBlur={onShellTitleBlur}
                placeholder="Enter a title for your nugget..."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white placeholder-slate-500"
              />
              {titleContentError ? (
                <div className="text-[10px] text-red-700 dark:text-red-400 font-medium">{titleContentError}</div>
              ) : null}
              {titleFieldWarning ? (
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">{titleFieldWarning}</div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Excerpt</span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Card excerpt is generated from the body when you save. Inline excerpt editing may arrive in a later
                release.
              </p>
              <div className="h-16 w-full rounded-lg bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Visibility</span>
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 w-fit">
                <button
                  type="button"
                  onClick={onVisibilityPublic}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${
                    shellVisibility === 'public'
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                      : 'text-slate-500'
                  }`}
                >
                  <Globe size={12} /> Public
                </button>
                <button
                  type="button"
                  onClick={onVisibilityPrivate}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${
                    shellVisibility === 'private'
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                      : 'text-slate-500'
                  }`}
                >
                  <Lock size={12} /> Private
                </button>
              </div>
            </div>

            {children}
          </div>
        </div>

        <FormFooter
          fileInputRef={fileInputRef}
          onFileSelect={onFileSelect}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          canSubmit={canSubmit}
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
          interactionDisabled={!composerReady}
        />
      </div>
    </ModalShell>
  );
}
