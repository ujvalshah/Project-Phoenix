import React, { useState, useRef, ReactElement, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayHost } from '@/utils/overlayHosts';

/** Simple string tooltips; rich/interactive bubbles should portal to `tooltip-root` (see `CardMeta`). */
interface TooltipProps {
  content: string;
  children: ReactElement;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          top: position === 'top' ? rect.top - 10 : rect.bottom + 10,
          left: rect.left + rect.width / 2,
        });
        setIsVisible(true);
      }
    }, 300);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  return (
    <>
      {/* cloneElement assigns ref on commit; rule false-positive on ref object identity */}
      {/* eslint-disable react-hooks/refs */}
      {isValidElement(children) &&
        cloneElement(children, {
          ref: triggerRef,
          onMouseEnter: showTooltip,
          onMouseLeave: hideTooltip,
          onFocus: showTooltip,
          onBlur: hideTooltip,
        } as React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> })}
      {/* eslint-enable react-hooks/refs */}

      {isVisible &&
        createPortal(
          <div
            className={`fixed pointer-events-none px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-900/90 dark:bg-slate-700/90 backdrop-blur-sm rounded-lg shadow-xl transform -translate-x-1/2 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap border border-slate-700/50 ${
              position === 'top' ? '-translate-y-full' : ''
            }`}
            style={{ top: coords.top, left: coords.left }}
          >
            {content}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900/90 dark:bg-slate-700/90 transform rotate-45 border-slate-700/50 ${
                position === 'top' ? 'bottom-[-4px] border-r border-b' : 'top-[-4px] border-l border-t'
              }`}
            />
          </div>,
          getOverlayHost('tooltip'),
        )}
    </>
  );
};
