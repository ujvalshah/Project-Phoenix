import React, { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { formatDate } from '@/utils/formatters';
import { getInitials } from '@/utils/formatters';

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
  
  // Compact design: Use absolute date format (not relative time)
  const displayDate = formatDate(formattedDate, false); // "Dec 15 '25"
  
  // Clear timeout when component unmounts or tooltip is manually dismissed
  React.useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);
  
  const handleShowTooltip = () => {
    setShowTooltip(true);
    // Clear any existing timeout
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
    // Show tooltip on mobile tap, auto-hide after 3 seconds (longer than before)
    handleShowTooltip();
    tooltipTimeoutRef.current = window.setTimeout(() => {
      handleHideTooltip();
    }, 3000);
  };
  
  const avatarElement = (
    <div
      className="relative"
      onMouseEnter={handleShowTooltip}
      onMouseLeave={handleHideTooltip}
      onClick={(e) => {
        e.stopPropagation();
        if (onAuthorClick) {
          onAuthorClick(authorId);
        }
        // Show tooltip on mobile tap
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
      {showTooltip && (
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap z-50 pointer-events-auto"
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
              onClick={(e) => {
                e.stopPropagation();
                handleHideTooltip();
              }}
              className="text-white/70 hover:text-white focus:outline-none focus:ring-1 focus:ring-white/50 rounded"
              aria-label="Close tooltip"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  );
  
  return (
    <div
      className={twMerge(
        // PHASE 1: 8-pt spacing (gap-2 = 8px), muted secondary text, 12px font size
        'flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400',
        className
      )}
    >
      {/* Avatar with tooltip */}
      {avatarElement}
      
      {/* Date - small muted metadata */}
      <span>{displayDate}</span>
    </div>
  );
};

