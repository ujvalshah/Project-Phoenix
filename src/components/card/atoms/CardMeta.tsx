import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';
import { formatDate } from '@/utils/formatters';
import { getInitials } from '@/utils/formatters';
import { getOverlayHost } from '@/utils/overlayHosts';

interface CardMetaProps {
  authorName: string;
  authorId: string;
  formattedDate: string; // ISO date string
  authorAvatarUrl?: string;
  onAuthorClick?: (authorId: string) => void;
  className?: string;
}

export const CardMeta: React.FC<CardMetaProps> = ({
  authorName,
  authorId,
  formattedDate,
  authorAvatarUrl,
  onAuthorClick,
  className,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = React.useRef<number | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null);

  // Compact design: Use absolute date format (not relative time)
  const displayDate = formatDate(formattedDate, false); // "Dec 15 '25"

  React.useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const updateBubblePosition = useCallback(() => {
    if (!anchorRef.current || typeof window === 'undefined') {
      setBubblePos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const edge = 8;
    const gap = 6;
    const top = Math.max(edge, rect.top - gap);
    const left = rect.left + rect.width / 2;
    setBubblePos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!showTooltip) {
      queueMicrotask(() => setBubblePos(null));
      return;
    }
    queueMicrotask(() => {
      updateBubblePosition();
    });
    const opts = { passive: true, capture: true } as const;
    window.addEventListener('scroll', updateBubblePosition, opts);
    window.addEventListener('resize', updateBubblePosition);
    return () => {
      window.removeEventListener('scroll', updateBubblePosition, opts);
      window.removeEventListener('resize', updateBubblePosition);
    };
  }, [showTooltip, updateBubblePosition]);

  const handleShowTooltip = () => {
    setShowTooltip(true);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
  };

  const handleHideTooltip = () => {
    setShowTooltip(false);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };

  const handleMobileTap = () => {
    handleShowTooltip();
    tooltipTimeoutRef.current = window.setTimeout(() => {
      handleHideTooltip();
    }, 3000);
  };

  const avatarElement = (
    <div
      ref={anchorRef}
      className="relative"
      onMouseEnter={handleShowTooltip}
      onMouseLeave={handleHideTooltip}
      onClick={(e) => {
        e.stopPropagation();
        if (onAuthorClick) {
          onAuthorClick(authorId);
        }
        handleMobileTap();
      }}
    >
      {authorAvatarUrl ? (
        <img
          src={authorAvatarUrl}
          alt={authorName}
          className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          tabIndex={onAuthorClick ? 0 : undefined}
          role={onAuthorClick ? 'button' : undefined}
          aria-label={onAuthorClick ? `View profile of ${authorName}` : undefined}
          onKeyDown={onAuthorClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onAuthorClick(authorId);
            }
          } : undefined}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[9px] font-bold text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          tabIndex={onAuthorClick ? 0 : undefined}
          role={onAuthorClick ? 'button' : undefined}
          aria-label={onAuthorClick ? `View profile of ${authorName}` : undefined}
          onKeyDown={onAuthorClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onAuthorClick(authorId);
            }
          } : undefined}
        >
          {getInitials(authorName)}
        </div>
      )}
    </div>
  );

  const tooltipPortal =
    showTooltip &&
    bubblePos &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        role="tooltip"
        className="fixed pointer-events-auto px-2 py-1 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-150"
        style={{ top: bubblePos.top, left: bubblePos.left }}
        onMouseEnter={handleShowTooltip}
        onMouseLeave={handleHideTooltip}
        onClick={(e) => {
          e.stopPropagation();
          handleHideTooltip();
        }}
      >
        <div className="flex items-center gap-2">
          <span>{authorName}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleHideTooltip();
            }}
            className="text-white/70 hover:text-white focus:outline-none focus:ring-1 focus:ring-white/50 rounded"
            aria-label="Close tooltip"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
      </div>,
      getOverlayHost('tooltip'),
    );

  return (
    <div
      className={twMerge(
        'flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400',
        className
      )}
    >
      {avatarElement}
      {tooltipPortal}
      <span>{displayDate}</span>
    </div>
  );
};
