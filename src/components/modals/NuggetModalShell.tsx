import React from 'react';
import { Globe, Lock, X } from 'lucide-react';
import { ModalShell } from '@/components/UI/ModalShell';
import { FormFooter } from '@/components/CreateNuggetModal/FormFooter';
import type { ShellDraft } from '@/components/modals/shellDraft';

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
  /** Shell summary — chrome edits derive from this only (no full Article). */
  shellDraft: ShellDraft;
  onShellDraftPatch: (patch: Partial<Pick<ShellDraft, 'title' | 'excerpt' | 'visibility'>>) => void;
  onShellTitleBlur: () => void;
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
  shellDraft,
  onShellDraftPatch,
  onShellTitleBlur,
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
          <div className="min-w-0 flex flex-1 items-start gap-3">
            {shellDraft.coverImageUrl ? (
              <div className="hidden shrink-0 sm:block">
                <img
                  src={shellDraft.coverImageUrl}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <h2 id="modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                {mode === 'edit' ? 'Edit Nugget' : 'Create Nugget'}
              </h2>
              {duplicateSubtitle ? (
                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{duplicateSubtitle}</p>
              ) : null}
              {mode === 'edit' ? (
                <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Status:{' '}
                  <span className="text-slate-700 dark:text-slate-300">
                    {shellDraft.status === 'draft' ? 'Draft' : 'Published'}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
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
                value={shellDraft.title}
                onChange={(e) => onShellDraftPatch({ title: e.target.value })}
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
              <label htmlFor="excerpt-input" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Excerpt (Optional)
              </label>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Short card summary. Leave empty to auto-generate from the body when you save.
              </p>
              <textarea
                id="excerpt-input"
                value={shellDraft.excerpt}
                onChange={(e) => onShellDraftPatch({ excerpt: e.target.value })}
                placeholder="Optional excerpt for cards and search previews..."
                rows={3}
                className="w-full resize-y min-h-[4rem] px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white placeholder-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Visibility</span>
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 w-fit">
                <button
                  type="button"
                  onClick={() => onShellDraftPatch({ visibility: 'public' })}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${
                    shellDraft.visibility === 'public'
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                      : 'text-slate-500'
                  }`}
                >
                  <Globe size={12} /> Public
                </button>
                <button
                  type="button"
                  onClick={() => onShellDraftPatch({ visibility: 'private' })}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${
                    shellDraft.visibility === 'private'
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
