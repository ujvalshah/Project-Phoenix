import React, { useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';
import { getOverlayHost } from '@/utils/overlayHosts';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Keep mounted and toggle visibility for snappier re-open UX. */
  keepMounted?: boolean;
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
 *  - Portal to #modal-root (z-index Z_INDEX.MODAL via mountOverlayHostStack)
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
  keepMounted = false,
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

  // Apply scroll lock before paint so the feed never flashes at scroll 0 behind the backdrop
  // (useEffect would run after paint and could capture a wrong scroll position).
  useLayoutEffect(() => {
    if (!isOpen || disableScrollLock) return;
    const body = document.body;
    const lockCount = Number(body.dataset.modalScrollLockCount ?? '0');

    if (lockCount === 0) {
      const scrollY = window.scrollY;
      body.dataset.modalScrollLockScrollY = String(scrollY);
      body.dataset.modalScrollLockOverflow = body.style.overflow;
      body.dataset.modalScrollLockOverflowX = body.style.overflowX;
      body.dataset.modalScrollLockOverflowY = body.style.overflowY;
      body.dataset.modalScrollLockPosition = body.style.position;
      body.dataset.modalScrollLockTop = body.style.top;
      body.dataset.modalScrollLockWidth = body.style.width;

      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.overflowX = 'clip';
      body.style.overflowY = 'scroll';
    }

    body.dataset.modalScrollLockCount = String(lockCount + 1);

    return () => {
      const currentCount = Number(body.dataset.modalScrollLockCount ?? '1');
      const nextCount = Math.max(0, currentCount - 1);

      if (nextCount > 0) {
        body.dataset.modalScrollLockCount = String(nextCount);
        return;
      }

      const scrollY = Number(body.dataset.modalScrollLockScrollY ?? '0');
      const prevOverflow = body.dataset.modalScrollLockOverflow ?? '';
      const prevOverflowX = body.dataset.modalScrollLockOverflowX ?? '';
      const prevOverflowY = body.dataset.modalScrollLockOverflowY ?? '';
      const prevPosition = body.dataset.modalScrollLockPosition ?? '';
      const prevTop = body.dataset.modalScrollLockTop ?? '';
      const prevWidth = body.dataset.modalScrollLockWidth ?? '';

      body.style.overflow = prevOverflow;
      body.style.overflowX = prevOverflowX;
      body.style.overflowY = prevOverflowY;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;

      delete body.dataset.modalScrollLockCount;
      delete body.dataset.modalScrollLockScrollY;
      delete body.dataset.modalScrollLockOverflow;
      delete body.dataset.modalScrollLockOverflowX;
      delete body.dataset.modalScrollLockOverflowY;
      delete body.dataset.modalScrollLockPosition;
      delete body.dataset.modalScrollLockTop;
      delete body.dataset.modalScrollLockWidth;

      window.requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
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

  if (!isOpen && !keepMounted) return null;

  const alignmentClass =
    align === 'end'
      ? 'justify-end items-stretch'
      : align === 'bottom-sheet'
        ? 'items-end sm:items-center justify-center'
        : 'items-center justify-center';

  return createPortal(
    <div
      className={twMerge(
        'fixed inset-0 flex transition-opacity duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
        alignmentClass,
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        wrapperClassName ?? '',
      )}
      style={{
        // z-index is owned by #modal-root (mountOverlayHostStack). Host is pointer-events:none.
        // Do not force pointer events here; closed keepMounted shells must stay click-through.
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
            'absolute inset-0 bg-slate-900/60 transition-opacity duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
            isOpen ? 'opacity-100' : 'opacity-0',
            backdropClassName ?? '',
          )}
          onClick={handleBackdrop}
          aria-hidden="true"
        />
      )}
      {children}
    </div>,
    getOverlayHost('modal'),
  );
};
