import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '@/constants/zIndex';
import { getHeaderHeight } from '@/constants/layout';

export interface DropdownPosition {
  top: number;
  left?: number;
  right?: number;
}

export interface DropdownPortalProps {
  /** Whether the dropdown is currently open */
  isOpen: boolean;
  /** Ref to the trigger element (button that opens dropdown) */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Dropdown content */
  children: React.ReactNode;
  /** Horizontal alignment relative to anchor */
  align?: 'left' | 'right';
  /** Additional offset from anchor bottom */
  offsetY?: number;
  /** Ref forwarded to the dropdown container (for click-outside detection) */
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  /** Additional className for the dropdown container */
  className?: string;
  /** Callback when click occurs outside dropdown and anchor */
  onClickOutside?: () => void;
}

/**
 * DropdownPortal: Reusable portal-based dropdown component
 * 
 * OVERLAY INVARIANT:
 * All Header-triggered overlays must be portaled to document.body
 * and render above page-level toolbars.
 * 
 * Features:
 * - Portaled to document.body (escapes stacking contexts)
 * - Positioned relative to anchor element
 * - Updates position on scroll/resize
 * - Click-outside detection
 * - Proper z-index from centralized constants
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
}) => {
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const internalDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = externalDropdownRef || internalDropdownRef;

  // Calculate position based on anchor element
  const updatePosition = useCallback(() => {
    if (!anchorRef.current) {
      setPosition(null);
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const headerHeight = getHeaderHeight();
    
    // Ensure dropdown doesn't render above header
    const top = Math.max(rect.bottom + offsetY, headerHeight + offsetY);

    if (align === 'right') {
      setPosition({
        top,
        right: window.innerWidth - rect.right,
      });
    } else {
      setPosition({
        top,
        left: rect.left,
      });
    }
  }, [anchorRef, align, offsetY]);

  // Update position when dropdown opens
  useEffect(() => {
    if (isOpen) {
      updatePosition();
    } else {
      setPosition(null);
    }
  }, [isOpen, updatePosition]);

  // Update position on scroll/resize
  // PERFORMANCE FIX: Throttle position updates using requestAnimationFrame
  // getBoundingClientRect() forces layout recalculation, so we batch updates
  // to the next paint cycle to prevent scroll jank and "Violation" warnings.
  useEffect(() => {
    if (!isOpen) return;

    let rafId: number | null = null;
    let isScheduled = false;

    const handleUpdate = () => {
      // Throttle: only schedule one RAF per frame
      if (isScheduled) return;
      
      isScheduled = true;
      rafId = requestAnimationFrame(() => {
        updatePosition();
        isScheduled = false;
        rafId = null;
      });
    };

    // Mark scroll listener as passive for better scroll performance
    // We use capture phase to catch scroll events in nested containers
    window.addEventListener('scroll', handleUpdate, { passive: true, capture: true });
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isOpen, updatePosition]);

  // Handle click outside
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

    // Use setTimeout to avoid triggering on the click that opened the dropdown
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, anchorRef, dropdownRef, onClickOutside]);

  // Don't render if not open, no position, or SSR
  if (!isOpen || !position || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={dropdownRef}
      className={`fixed animate-in slide-in-from-top-2 fade-in duration-200 ${className}`}
      style={{
        top: position.top,
        left: position.left,
        right: position.right,
        zIndex: Z_INDEX.HEADER_OVERLAY,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
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
    setIsOpen(prev => !prev);
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

