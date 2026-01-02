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
  
  // Compact design: Use absolute date format (not relative time)
  const displayDate = formatDate(formattedDate, false); // "Dec 15 '25"
  
  const avatarElement = (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (onAuthorClick) {
          onAuthorClick(authorId);
        }
        // Show tooltip on mobile tap
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 2000);
      }}
    >
      {authorAvatarUrl ? (
        <img
          src={authorAvatarUrl}
          alt={authorName}
          className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-slate-700 cursor-pointer"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[9px] font-bold text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 cursor-pointer">
          {getInitials(authorName)}
        </div>
      )}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap z-50 pointer-events-none">
          {authorName}
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

