import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardTitleProps {
  title?: string;
  className?: string;
  variant?: 'grid' | 'feed' | 'masonry' | 'utility'; // Variant for feed-specific styling
}

export const CardTitle: React.FC<CardTitleProps> = ({ title, className, variant }) => {
  if (!title) return null;

  // Finance-grade hierarchy: Feed titles are dominant (1.25rem-1.375rem, font-weight 500-600)
  // Grid titles remain smaller for density
  const isFeed = variant === 'feed';
  
  // Parse markdown-style links in title: [text](url)
  const renderTitleWithLinks = (text: string) => {
    // Split by markdown link pattern: [text](url)
    const parts = text.split(/(\[.*?\]\(.*?\))/g);
    
    return parts.map((part, index) => {
      // Check if this part is a markdown link
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const matches = part.match(/\[(.*?)\]\((.*?)\)/);
        if (matches) {
          return (
            <a
              key={index}
              href={matches[2]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary-600 dark:text-primary-400 hover:underline"
            >
              {matches[1]}
            </a>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };
  
  return (
    <h3
      className={twMerge(
        // PHASE 1: All titles use same size as body (text-xs = 12px), bold for emphasis
        'text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug',
        'group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors',
        className
      )}
    >
      {renderTitleWithLinks(title)}
    </h3>
  );
};

