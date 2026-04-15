import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getHeaderHeight } from '@/constants/layout';
import { getOverlayHost, type OverlayHostKind } from '@/utils/overlayHosts';

export interface DropdownPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width?: number;
}

function positionsEqual(a: DropdownPosition | null, b: DropdownPosition | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.left === b.left &&
    a.right === b.right &&
    a.width === b.width
  );
}

/** Subset of hosts appropriate for anchored menus (not drawer/modal shell). */
export type AnchoredOverlayHost = Extract<OverlayHostKind, 'dropdown' | 'popover' | 'modal'>;

export interface DropdownPortalProps {
  /** Whether the dropdown is currently open */
  isOpen: boolean;
  /** Ref to the trigger element (button that opens dropdown) */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Dropdown content */
  children: React.ReactNode;
  /** Horizontal alignment relative to anchor (ignored when `matchAnchorWidth` is true). */
  align?: 'left' | 'right';
  /** Gap between anchor and panel (px). */
  offsetY?: number;
  /** Ref forwarded to the dropdown container (for click-outside detection) */
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  /** Additional className for the dropdown container */
  className?: string;
  /** Callback when click occurs outside dropdown and anchor, or Escape is pressed */
  onClickOutside?: () => void;
  /** `below`: under anchor (default). `above`: opens upward (e.g. masonry HUD). */
  placement?: 'below' | 'above';
  /**
   * Portal target. Default `dropdown`. Use `modal` for menus inside Create Nugget / dialogs
   * so the panel stacks above the modal body (same #modal-root subtree order).
   */
  host?: AnchoredOverlayHost;
  /** When true, panel uses anchor’s width and left edge (combobox pattern). */
  matchAnchorWidth?: boolean;
  /** Merged onto the portaled root (e.g. `id`, `role`, `aria-*` for listboxes). */
  overlayRootProps?: React.HTMLAttributes<HTMLDivElement>;
  /** When true (default), focus returns to the anchor after the menu closes. */
  restoreFocusOnClose?: boolean;
}

/**
 * DropdownPortal — anchored menus in shared overlay hosts.
 *
 * Prefer this over `absolute` + `top-full` inside cards, masonry, or scroll areas;
 * those ancestors often use `overflow-hidden` or `transform`, which clip or trap z-index.
 *
 * @see `src/utils/overlayHosts.ts` for host ordering and when to use each layer.
 */
export const DropdownPortal: React.FC<DropdownPortalProps> = ({
  isOpen,
  anchorRef,
  children,
  align = 'right',
  offsetY = 8,
  dropdownRef: externalDropdownRef,
  className = '',
  onClickOutside,
  placement = 'below',
  host = 'dropdown',
  matchAnchorWidth = false,
  overlayRootProps,
  restoreFocusOnClose = true,
}) => {
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const internalDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = externalDropdownRef || internalDropdownRef;
  const wasOpenRef = useRef(false);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) {
      setPosition(null);
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const headerHeight = getHeaderHeight();
    const edge = 4;
    const panelEl = dropdownRef.current;
    const panelBox = panelEl ? panelEl.getBoundingClientRect() : null;
    const panelHeight = panelEl
      ? Math.max(panelEl.offsetHeight, panelBox?.height ?? 0)
      : 0;
    const panelWidth = panelEl
      ? Math.max(panelEl.offsetWidth, panelBox?.width ?? 0)
      : 0;
    const minTop = headerHeight + edge;
    const maxBottomY = window.innerHeight - edge;

    const applyHorizontal = (pos: DropdownPosition): DropdownPosition => {
      if (matchAnchorWidth) {
        pos.left = Math.max(edge, Math.min(rect.left, window.innerWidth - rect.width - edge));
        pos.width = rect.width;
      } else if (align === 'right') {
        const rightPos = window.innerWidth - rect.right;
        pos.right = Number.isFinite(rightPos) && rightPos >= 0 ? rightPos : 0;
      } else {
        const safeLeft = Number.isFinite(rect.left) && rect.left >= 0 ? rect.left : 0;
        pos.left = safeLeft;
      }
      if (panelWidth > 0) {
        if (typeof pos.left === 'number') {
          pos.left = Math.max(edge, Math.min(pos.left, window.innerWidth - panelWidth - edge));
        }
        if (typeof pos.right === 'number') {
          const leftFromRight = window.innerWidth - pos.right - panelWidth;
          if (leftFromRight < edge) {
            pos.right = Math.max(edge, window.innerWidth - panelWidth - edge);
          }
        }
      }
      return pos;
    };

    if (placement === 'above') {
      let bottom = Math.max(window.innerHeight - rect.top + offsetY, edge);
      const pos: DropdownPosition = { bottom };
      applyHorizontal(pos);
      if (panelHeight > 0) {
        const topY = window.innerHeight - bottom - panelHeight;
        if (topY < minTop) {
          bottom = Math.max(edge, window.innerHeight - panelHeight - minTop);
          pos.bottom = bottom;
        }
      }
      setPosition((prev) => (positionsEqual(prev, pos) ? prev : pos));
      return;
    }

    let top = Math.max(rect.bottom + offsetY, headerHeight + offsetY);
    const safeTop = Number.isFinite(top) ? top : headerHeight + offsetY;
    top = safeTop;

    if (panelHeight > 0) {
      const bottomY = top + panelHeight;
      if (bottomY > maxBottomY) {
        const aboveTop = rect.top - panelHeight - offsetY;
        if (aboveTop >= minTop) {
          top = aboveTop;
        } else {
          top = Math.max(minTop, maxBottomY - panelHeight);
        }
      }
    }

    const pos: DropdownPosition = { top };
    applyHorizontal(pos);
    setPosition((prev) => (positionsEqual(prev, pos) ? prev : pos));
  }, [anchorRef, align, offsetY, placement, matchAnchorWidth, dropdownRef]);

  // Open: effect seeds position from the anchor; layout effect re-runs once `position` is set so
  // we can measure the portaled panel and apply viewport collision (flip / clamp).
  /* eslint-disable react-hooks/set-state-in-effect -- overlay position syncs to anchor + measured panel */
  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [isOpen, updatePosition]);

  useLayoutEffect(() => {
    if (!isOpen || !position) return;
    updatePosition();
  }, [isOpen, position, updatePosition]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isOpen) return;

    let rafId: number | null = null;
    let isScheduled = false;

    const handleUpdate = () => {
      if (isScheduled) return;
      isScheduled = true;
      rafId = requestAnimationFrame(() => {
        updatePosition();
        isScheduled = false;
        rafId = null;
      });
    };

    const scrollOpts = { passive: true, capture: true } as const;
    window.addEventListener('scroll', handleUpdate, scrollOpts);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, scrollOpts);
      window.removeEventListener('resize', handleUpdate);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen || !onClickOutside) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInAnchor = anchorRef.current?.contains(target);
      const isInDropdown = dropdownRef.current?.contains(target);
      if (!isInAnchor && !isInDropdown) {
        onClickOutside();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, anchorRef, dropdownRef, onClickOutside]);

  useEffect(() => {
    if (!isOpen || !onClickOutside) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClickOutside();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClickOutside]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen && restoreFocusOnClose) {
      const el = anchorRef.current;
      if (el && typeof el.focus === 'function') {
        el.focus({ preventScroll: true });
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, anchorRef, restoreFocusOnClose]);

  if (!isOpen || !position || typeof document === 'undefined') {
    return null;
  }

  const { onClick: overlayOnClick, ...restOverlayRootProps } = overlayRootProps ?? {};

  return createPortal(
    <div
      ref={dropdownRef}
      {...restOverlayRootProps}
      className={`fixed z-[1] max-h-[calc(100vh-8px)] overflow-y-auto overflow-x-hidden animate-in slide-in-from-top-2 fade-in duration-200 pointer-events-auto ${className}`}
      style={{
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        right: position.right,
        width: position.width,
      }}
      onClick={(e) => {
        overlayOnClick?.(e);
        e.stopPropagation();
      }}
    >
      {children}
    </div>,
    getOverlayHost(host),
  );
};

/**
 * Hook for managing dropdown state with click-outside handling
 */
export const useDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    setIsOpen,
    anchorRef,
    dropdownRef,
    toggle,
    close,
    open,
  };
};
