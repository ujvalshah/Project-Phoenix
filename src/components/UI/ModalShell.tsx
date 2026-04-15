import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';

/**
 * Resolve the modal portal host. Prefer the dedicated #modal-root declared in
 * index.html (sibling of #root — guaranteed above the app's stacking context).
 * Fallback to document.body if missing, so dev tooling / tests still work.
 */
const getModalHost = (): HTMLElement => {
  if (typeof document === 'undefined') return null as unknown as HTMLElement;
  return document.getElementById('modal-root') ?? document.body;
};

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Flex alignment of the panel inside the wrapper. Default: centered. */
  align?: 'center' | 'end' | 'bottom-sheet';
  /** Extra classes on the wrapper (padding, flex overrides). */
  wrapperClassName?: string;
  /** Extra classes on the backdrop (e.g. bg-black/90 for lightboxes). */
  backdropClassName?: string;
  /** Disable Escape-to-close. */
  disableEscape?: boolean;
  /** Disable body scroll lock. */
  disableScrollLock?: boolean;
  /** Disable backdrop click-to-close (still renders backdrop). */
  disableBackdropClose?: boolean;
  /** Render without a backdrop div (caller supplies its own). */
  noBackdrop?: boolean;
}

/**
 * ModalShell — single source of truth for overlay positioning.
 *
 * Owns:
 *  - Portal to document.body
 *  - Z-index (Z_INDEX.MODAL) on the fixed wrapper
 *  - Backdrop + click-to-close
 *  - Escape-to-close
 *  - Body scroll lock
 *  - Safe-area insets
 *
 * Consumers render ONLY the panel (children). Do not nest another fixed wrapper,
 * do not set z-index on children, do not create another portal.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  children,
  align = 'center',
  wrapperClassName,
  backdropClassName,
  disableEscape = false,
  disableScrollLock = false,
  disableBackdropClose = false,
  noBackdrop = false,
}) => {
  useEffect(() => {
    if (!isOpen || disableEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, disableEscape, onClose]);

  useEffect(() => {
    if (!isOpen || disableScrollLock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, disableScrollLock]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disableBackdropClose) return;
      onClose();
    },
    [disableBackdropClose, onClose],
  );

  if (!isOpen) return null;

  const alignmentClass =
    align === 'end'
      ? 'justify-end items-stretch'
      : align === 'bottom-sheet'
        ? 'items-end sm:items-center justify-center'
        : 'items-center justify-center';

  return createPortal(
    <div
      className={twMerge('fixed inset-0 flex', alignmentClass, wrapperClassName ?? '')}
      style={{
        // z-index is OWNED BY #modal-root in index.html — do not set it here.
        // pointerEvents re-enabled because #modal-root is pointer-events:none.
        pointerEvents: 'auto',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      role="presentation"
    >
      {!noBackdrop && (
        <div
          className={twMerge(
            'absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200',
            backdropClassName ?? '',
          )}
          onClick={handleBackdrop}
          aria-hidden="true"
        />
      )}
      {children}
    </div>,
    getModalHost(),
  );
};
