/**
 * ============================================================================
 * FEED CARD COMPACT: Mobile-First Compact Feed Card
 * ============================================================================
 * 
 * DESIGN:
 * - Mobile-first one-column layout
 * - ~3-4 visible cards per viewport
 * - Fixed 4:3 aspect ratio preview images
 * - Full infographic shown ONLY in Detail View (Bottom Sheet)
 * - Entire card is hit-target
 * - Tap/hover states for feedback
 * 
 * COMPONENT STRUCTURE:
 * - ImageLayer (fixed aspect ratio preview)
 * - Title (truncated)
 * - Source badge
 * - Metadata (author, date)
 * - Tags (compact)
 * 
 * ============================================================================
 */

import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Article } from '@/types';
import { ImageLayer } from './ImageLayer';
import { SourceBadge } from '../shared/SourceBadge';
import { twMerge } from 'tailwind-merge';
import { getThumbnailUrl } from '@/utils/mediaClassifier';
import { z } from 'zod';

// Zod schema for feed item validation
const FeedItemSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  title: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  author: z.object({
    id: z.string(),
    name: z.string(),
    avatar_url: z.string().optional(),
  }).optional(),
  publishedAt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  primaryMedia: z.object({
    type: z.string(),
    url: z.string(),
    thumbnail: z.string().optional(),
    previewMetadata: z.any().optional(),
  }).optional().nullable(),
  media: z.any().optional().nullable(),
  visibility: z.enum(['public', 'private']).optional(),
}).passthrough(); // Allow additional fields

/**
 * Validate and sanitize article data
 */
function validateFeedItem(article: unknown): Article | null {
  try {
    const validated = FeedItemSchema.parse(article);
    return validated as Article;
  } catch (error) {
    console.error('[FeedCardCompact] Validation error:', error);
    return null;
  }
}

export interface FeedCardCompactProps {
  article: Article;
  index: number; // For fetchPriority (first 2 images get 'high')
  onClick: (article: Article) => void;
  isInViewport?: boolean;
  className?: string;
}

/**
 * Extract source URL from article for SourceBadge
 */
function getSourceUrl(article: Article): string | undefined {
  // Check primaryMedia URL
  if (article.primaryMedia?.url) {
    return article.primaryMedia.url;
  }
  
  // Check legacy media URL
  if (article.media?.url) {
    return article.media.url;
  }
  
  // Check previewMetadata
  if (article.primaryMedia?.previewMetadata?.url) {
    return article.primaryMedia.previewMetadata.url;
  }
  
  if (article.media?.previewMetadata?.url) {
    return article.media.previewMetadata.url;
  }
  
  return undefined;
}

/**
 * Get image source for preview
 */
function getImageSource(article: Article): {
  src: string | null;
  blurPlaceholder: string | null;
  sourceDomain: string | null;
} {
  // Get thumbnail URL using existing utility
  const thumbnailUrl = getThumbnailUrl(article);
  
  // Extract source domain for placeholder
  const sourceUrl = getSourceUrl(article);
  let sourceDomain: string | null = null;
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      sourceDomain = url.hostname.replace('www.', '');
    } catch {
      // Invalid URL, ignore
    }
  }
  
  // For blur placeholder, use Cloudinary transformations if available
  // Otherwise, use the thumbnail URL as-is
  const blurPlaceholder = thumbnailUrl;
  
  return {
    src: thumbnailUrl,
    blurPlaceholder,
    sourceDomain,
  };
}

/**
 * FeedCardCompact Component
 * 
 * Memoized to prevent unnecessary re-renders
 * Uses shallow prop comparison
 */
export const FeedCardCompact = memo<FeedCardCompactProps>(
  ({ article, index, onClick, isInViewport = true, className }) => {
    // Validate article data
    const validatedArticle = useMemo(() => {
      return validateFeedItem(article) || article; // Fallback to original if validation fails
    }, [article]);
    
    // Get image source and metadata
    const imageSource = useMemo(() => getImageSource(validatedArticle), [validatedArticle]);
    
    // Determine fetch priority (first 2 images get 'high')
    const fetchPriority = useMemo<'high' | 'low' | 'auto'>(() => {
      return index < 2 ? 'high' : 'low';
    }, [index]);
    
    // Safe title with fallback
    const displayTitle = useMemo(() => {
      return validatedArticle.title || 
             validatedArticle.excerpt || 
             'Untitled';
    }, [validatedArticle.title, validatedArticle.excerpt]);
    
    // Safe author name
    const authorName = useMemo(() => {
      return validatedArticle.author?.name || 
             validatedArticle.displayAuthor?.name || 
             'Unknown';
    }, [validatedArticle.author?.name, validatedArticle.displayAuthor?.name]);
    
    // Format date
    const formattedDate = useMemo(() => {
      if (!validatedArticle.publishedAt) return null;
      try {
        const date = new Date(validatedArticle.publishedAt);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        return null;
      }
    }, [validatedArticle.publishedAt]);
    
    // Get source URL for badge
    const sourceUrl = useMemo(() => getSourceUrl(validatedArticle), [validatedArticle]);
    
    // Tags (limit to 3 for compact display)
    const displayTags = useMemo(() => {
      const tags = validatedArticle.tags || [];
      return tags.slice(0, 3);
    }, [validatedArticle.tags]);
    
    const navigate = useNavigate();
    
    const handleClick = () => {
      // Navigate to detail route with state indicating we came from feed
      navigate(`/feed/${validatedArticle.id}`, {
        state: { fromFeed: true },
      });
      
      // Also call onClick handler if provided (for compatibility)
      if (onClick) {
        onClick(validatedArticle);
      }
    };
    
    return (
      <article
        className={twMerge(
          'flex flex-col',
          'bg-white dark:bg-slate-900',
          'rounded-xl',
          'shadow-sm border border-slate-200 dark:border-slate-800',
          'overflow-hidden',
          'cursor-pointer',
          'transition-all duration-200',
          'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700',
          'active:bg-slate-50 dark:active:bg-slate-800',
          'hover:-translate-y-0.5',
          className
        )}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`View ${displayTitle}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Image Preview - Fixed 4:3 Aspect Ratio */}
        {imageSource.src && (
          <div className="relative w-full">
            <ImageLayer
              src={imageSource.src}
              blurPlaceholder={imageSource.blurPlaceholder}
              alt={displayTitle}
              aspectRatio={4 / 3}
              fetchPriority={fetchPriority}
              isInViewport={isInViewport}
              sourceDomain={imageSource.sourceDomain || undefined}
            />
            
            {/* Source Badge Overlay */}
            {sourceUrl && (
              <div className="absolute top-2 left-2 z-10">
                <SourceBadge
                  url={sourceUrl}
                  size="sm"
                  variant="overlay"
                />
              </div>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className="flex flex-col p-4 gap-3">
          {/* Title */}
          <h3
            className={twMerge(
              'text-base font-semibold',
              'text-slate-900 dark:text-white',
              'line-clamp-2',
              'leading-snug'
            )}
          >
            {displayTitle}
          </h3>
          
          {/* Metadata Row */}
          <div className="flex items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">{authorName}</span>
            </div>
            {formattedDate && (
              <span className="shrink-0 text-xs">{formattedDate}</span>
            )}
          </div>
          
          {/* Tags */}
          {displayTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {displayTags.map((tag, i) => (
                <span
                  key={`${validatedArticle.id}-tag-${i}`}
                  className={twMerge(
                    'px-2 py-0.5',
                    'text-xs font-medium',
                    'bg-slate-100 dark:bg-slate-800',
                    'text-slate-700 dark:text-slate-300',
                    'rounded-md',
                    'truncate max-w-[120px]'
                  )}
                  title={tag}
                >
                  {tag}
                </span>
              ))}
              {(validatedArticle.tags?.length || 0) > 3 && (
                <span className="px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                  +{(validatedArticle.tags?.length || 0) - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </article>
    );
  },
  (prevProps, nextProps) => {
    // Shallow comparison for memoization
    return (
      prevProps.article.id === nextProps.article.id &&
      prevProps.article.title === nextProps.article.title &&
      prevProps.index === nextProps.index &&
      prevProps.isInViewport === nextProps.isInViewport
    );
  }
);

FeedCardCompact.displayName = 'FeedCardCompact';

