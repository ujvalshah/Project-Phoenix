/**
 * ============================================================================
 * CARD MEDIA: Primary Media Only (No Supporting Media)
 * ============================================================================
 * 
 * RENDERING RULES:
 * 1. Render ONLY primary media (never supporting media)
 * 2. Show thumbnail derived from primary media
 * 3. Display subtle "+N sources" indicator if supporting media exists
 * 4. Never render image grids, carousels, or multiple media items
 * 
 * PRINCIPLE:
 * - Media supports analysis, never competes with text
 * - Cards show SOURCE representation, not visual appeal
 * - Thumbnails are stable and predictable
 * 
 * ============================================================================
 */

import React, { useMemo, useEffect, useState } from 'react';
import { Article } from '@/types';
import { Image } from '@/components/Image';
import { Lock, Layers } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { classifyArticleMedia, getThumbnailUrl, getSupportingMediaCount, getAllImageUrls } from '@/utils/mediaClassifier';
import { useYouTubeTitle } from '@/hooks/useYouTubeTitle';
import { CardThumbnailGrid } from './CardThumbnailGrid';
import { EmbeddedMedia } from '@/components/embeds/EmbeddedMedia';

interface CardMediaProps {
  article: Article;
  visibility: 'public' | 'private' | undefined;
  onMediaClick: (e: React.MouseEvent, imageIndex?: number) => void;
  className?: string;
  isMediaOnly?: boolean; // Flag to indicate this is for a Media-Only card (use object-contain for images)
}

export const CardMedia: React.FC<CardMediaProps> = React.memo(({
  article,
  visibility,
  onMediaClick,
  className,
  isMediaOnly = false,
}) => {
  // Track image load errors for Media-only cards
  const [imageError, setImageError] = useState(false);
  
  // Classify media using deterministic rules
  const { primaryMedia, supportingMedia } = useMemo(() => 
    classifyArticleMedia(article), 
    [article]
  );
  
  
  // Get all image URLs for multi-image grid detection (moved before thumbnailUrl to allow fallback)
  const allImageUrls = useMemo(() => 
    getAllImageUrls(article),
    [article]
  );

  // Get thumbnail URL (deterministic, based on primary media only)
  // Fallback to first legacy image if primaryMedia is null but images exist
  const thumbnailUrl = useMemo(() => {
    const url = getThumbnailUrl(article);
    // If no thumbnail from primary media but we have legacy images, use first image
    // This ensures legacy images are displayed even when primaryMedia hasn't been set
    if (!url && allImageUrls.length > 0) {
      return allImageUrls[0];
    }
    return url;
  }, [article, allImageUrls]);
  
  // Reset error state when thumbnail URL changes
  useEffect(() => {
    setImageError(false);
  }, [thumbnailUrl]);

  // Get count of supporting media for indicator
  const supportingCount = useMemo(() => 
    getSupportingMediaCount(article), 
    [article]
  );
  
  // Fetch YouTube video title if media is YouTube
  // BACKEND-FIRST RESOLUTION: Use backend title if available, fetch only if missing
  const youtubeTitle = useYouTubeTitle({
    url: primaryMedia?.type === 'youtube' ? primaryMedia.url : null,
    backendTitle: primaryMedia?.previewMetadata?.title,
    nuggetId: article.id,
    fallback: article.title || 'YouTube Video'
  });
  
  // Check for Twitter/LinkedIn embeds in legacy media field (not classified as primary media)
  // These should still be rendered as media even though they're not "primary" media types
  const hasTwitterOrLinkedInEmbed = useMemo(() => {
    if (!article.media) return false;
    const mediaType = article.media.type;
    return mediaType === 'twitter' || mediaType === 'linkedin';
  }, [article.media]);
  
  // Check if we have any media: primary media, Twitter/LinkedIn embed, OR legacy images
  // This ensures legacy images are rendered even when primaryMedia is null
  const hasMedia = !!primaryMedia || hasTwitterOrLinkedInEmbed || allImageUrls.length > 0;

  // ============================================================================
  // MULTI-IMAGE GRID LOGIC
  // ============================================================================
  // Determine if we should render a multi-image grid:
  // 1. NO YouTube video (primary media is NOT youtube)
  // 2. MORE THAN ONE image available
  // 3. Primary media is an image (or null, but images exist in supporting media)
  const shouldRenderMultiImageGrid = useMemo(() => {
    // Rule 1: If primary media is YouTube, NEVER show grid
    if (primaryMedia?.type === 'youtube') return false;
    
    // Rule 2: Need more than 1 image for grid
    if (allImageUrls.length < 2) return false;
    
    // Rule 3: Primary media should be image or null (images-only nugget)
    if (primaryMedia && primaryMedia.type !== 'image') return false;
    
    return true;
  }, [primaryMedia, allImageUrls.length]);
  
  // 🔍 AUDIT LOGGING - CardMedia Rendering Mode (moved after shouldRenderMultiImageGrid definition)
  useEffect(() => {
    if (!hasMedia) return;
    
    let mediaVariant = 'unknown';
    if (shouldRenderMultiImageGrid) {
      mediaVariant = `multi-image-grid (${allImageUrls.length} images)`;
    } else if (hasTwitterOrLinkedInEmbed) {
      mediaVariant = article.media?.type === 'twitter' ? 'twitter-embed' : 'linkedin-embed';
    } else if (primaryMedia) {
      if (primaryMedia.type === 'youtube') {
        mediaVariant = 'youtube-video';
      } else if (primaryMedia.type === 'image') {
        mediaVariant = 'single-image';
      } else if (primaryMedia.type === 'document' || primaryMedia.type === 'pdf') {
        mediaVariant = 'document';
      } else {
        mediaVariant = `other-${primaryMedia.type}`;
      }
    }
    
    const mediaData = {
      id: article.id?.substring(0, 8) + '...' || 'unknown',
      renderComponent: 'CardMedia',
      mediaVariant,
      hasPrimaryMedia: !!primaryMedia,
      primaryMediaType: primaryMedia?.type || 'none',
      hasTwitterOrLinkedInEmbed,
      twitterLinkedInType: article.media?.type || 'none',
      hasThumbnail: !!thumbnailUrl,
      shouldRenderMultiImageGrid,
      imageCount: allImageUrls.length,
      className: className || 'none',
    };
    console.log('[CARD-AUDIT] CardMedia Rendering:', JSON.stringify(mediaData, null, 2));
    console.log('[CARD-AUDIT] CardMedia Rendering (expanded):', mediaData);
  }, [article.id, hasMedia, primaryMedia, hasTwitterOrLinkedInEmbed, article.media, thumbnailUrl, shouldRenderMultiImageGrid, allImageUrls.length, className]);

  // PHASE 1: Consistent fixed aspect ratio across all cards (16:9 for uniformity)
  const { aspectRatio, backgroundClass } = useMemo(() => {
    if (!primaryMedia) return { aspectRatio: '16/9', backgroundClass: 'bg-slate-100 dark:bg-slate-800' };
    
    // Documents: Use compact fixed height (exception to 16:9 rule)
    if (primaryMedia.type === 'document' || primaryMedia.type === 'pdf') {
      return { aspectRatio: undefined, backgroundClass: 'bg-transparent' };
    }
    
    // All other media types: Consistent 16:9 aspect ratio for uniform card heights
    const bgClass = primaryMedia.type === 'youtube' 
      ? 'bg-slate-900' 
      : 'bg-slate-100 dark:bg-slate-800';
    
    return { aspectRatio: '16/9', backgroundClass: bgClass };
  }, [primaryMedia]);
  
  if (!hasMedia) return null;
  
  // Determine if this is a document type (use fixed height instead of aspect ratio)
  const isDocument = primaryMedia?.type === 'document' || primaryMedia?.type === 'pdf';
  
  // Check if className already includes aspect ratio (e.g., aspect-video)
  const hasAspectRatioInClassName = className?.includes('aspect-');

  return (
    <div
      className={twMerge(
        // Base media styling
        'w-full rounded-xl overflow-hidden relative shrink-0 cursor-pointer group/media',
        backgroundClass,
        // Documents use fixed height
        isDocument ? 'h-16' : '',
        className
      )}
      style={
        !isDocument && aspectRatio && !hasAspectRatioInClassName
          ? { aspectRatio } 
          : {}
      }
      onClick={onMediaClick}
    >
      {/* ============================================================================
          RENDERING STRATEGY: Three distinct modes
          ============================================================================
          
          MODE 1: Multi-Image Grid
          - ONLY images (no YouTube video)
          - MORE THAN ONE image
          - Render compact 2x2 grid with up to 4 images
          
          MODE 2: Single Thumbnail (YouTube or Single Image)
          - YouTube video (always single thumbnail)
          - OR single image only
          - Standard thumbnail rendering with object-cover/object-contain
          
          MODE 3: No Media
          - Fallback state
      */}
      
      {/* MODE 1: Multi-Image Grid */}
      {shouldRenderMultiImageGrid ? (
        <CardThumbnailGrid
          images={allImageUrls}
          articleTitle={article.title}
          onGridClick={onMediaClick}
        />
      ) : hasTwitterOrLinkedInEmbed && article.media ? (
        /* MODE 2A: Twitter/LinkedIn Embed (rendered using EmbeddedMedia component) */
        <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
          <EmbeddedMedia 
            media={article.media} 
            onClick={(e) => {
              e.stopPropagation();
              onMediaClick(e);
            }} 
          />
        </div>
      ) : (
        /* MODE 2B: Single Thumbnail (YouTube, Image, Document - existing behavior) */
        <>
          {/* PRIMARY MEDIA ONLY - Render thumbnail
              
              CRITICAL DISTINCTION: YouTube thumbnails vs Uploaded images
              
              YouTube Thumbnails:
              - Use object-cover (fill container, edge-to-edge)
              - Standard YouTube appearance (cropped if needed)
              - No letterboxing or centering artifacts
              
              Uploaded Images (charts, screenshots, slides):
              - Use object-contain (no cropping, full visibility)
              - Preserve aspect ratio
              - Background fills gaps
              
              This distinction is intentional and type-based (not heuristic).
          */}
          {thumbnailUrl && !imageError && (
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src={thumbnailUrl}
                alt={article.title || 'Nugget thumbnail'}
                className={
                  primaryMedia?.type === 'youtube'
                    ? // YouTube thumbnails: fill container with object-cover (standard YouTube look)
                      "w-full h-full object-cover transition-transform duration-300 group-hover/media:scale-105"
                    : isMediaOnly
                    ? // Media-Only cards: use object-contain to show complete image without cropping
                      "max-w-full max-h-full w-auto h-auto object-contain transition-transform duration-300 group-hover/media:scale-105"
                    : // Hybrid cards with uploaded images: preserve full image with object-contain (no cropping)
                      "max-w-full max-h-full w-auto h-auto object-contain transition-transform duration-300 group-hover/media:scale-105"
                }
                onError={() => {
                  if (isMediaOnly) {
                    setImageError(true);
                  }
                }}
              />
              
              {/* YouTube video indicator - bottom overlay with logo and title (gradient background) */}
              {primaryMedia?.type === 'youtube' && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/60 to-transparent pointer-events-none">
                  <div className="flex items-center gap-2">
                    {/* YouTube logo */}
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/>
                      </svg>
                    </div>
                    {/* Video title - fetched via YouTube oEmbed API */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">
                        {youtubeTitle}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Error placeholder for Media-only cards when image fails to load */}
          {isMediaOnly && imageError && (
            <div className="w-full h-full flex items-center justify-center opacity-60 text-sm text-slate-400 dark:text-slate-500">
              Media unavailable
            </div>
          )}
          
          {/* MODE 3: Fallback - No thumbnail available */}
          {!thumbnailUrl && primaryMedia && (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                {primaryMedia.type === 'youtube' ? 'YouTube Video' :
                 primaryMedia.type === 'image' ? 'Image' :
                 primaryMedia.type === 'document' ? 'Document' : 'Media'}
              </div>
            </div>
          )}
          
          {/* Error placeholder for Media-only cards when no thumbnail URL exists */}
          {isMediaOnly && !thumbnailUrl && !primaryMedia && (
            <div className="w-full h-full flex items-center justify-center opacity-60 text-sm text-slate-400 dark:text-slate-500">
              Media unavailable
            </div>
          )}
        </>
      )}

      {/* Supporting media indicator - subtle badge showing count
          UPDATED LOGIC: Only show if NOT displaying multi-image grid
          (Grid already shows image count via +N badge if needed)
      */}
      {!shouldRenderMultiImageGrid && supportingCount > 0 && (
        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <Layers size={10} />
          <span>+{supportingCount}</span>
        </div>
      )}

      {/* Private visibility indicator */}
      {visibility === 'private' && (
        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white p-1 rounded-full">
          <Lock size={10} />
        </div>
      )}
    </div>
  );
});

