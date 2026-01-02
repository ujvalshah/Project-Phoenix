import React, { useState } from 'react';
import { Article } from '@/types';
import { EmbeddedMedia } from '@/components/embeds/EmbeddedMedia';
import { Image } from '@/components/Image';
import { getMasonryVisibleMedia, MasonryMediaItem } from '@/utils/masonryMediaHelper';
import { ImageLightbox } from '@/components/ImageLightbox';
import { ArticleDetail } from '@/components/ArticleDetail';
import { Maximize2 } from 'lucide-react';

interface MediaBlockProps {
  article: Article;
  onCategoryClick?: (category: string) => void;
  onArticleClick?: (article: Article) => void; // For opening Article Detail drawer
}

/**
 * MediaBlock: Renders media nuggets directly without card wrapper
 * 
 * ENHANCEMENT: Masonry Layout Media Selection
 * ============================================================================
 * WHAT WAS ADDED:
 * - Filtering logic to only show media items where showInMasonry === true
 * - Individual tile rendering (each selected media is its own tile, not grouped)
 * - Click behavior differentiation:
 *   - Images → open ImageLightbox carousel viewer (reuses Grid layout behavior)
 *   - YouTube/other media → open Article Detail drawer (standard drawer behavior)
 * 
 * BACKWARD COMPATIBILITY:
 * - If showInMasonry flag is missing on all media, only primary media is shown
 *   (default behavior preserved for existing articles)
 * - Primary media always defaults to showInMasonry = true if flag is missing
 * - Supporting media defaults to showInMasonry = false if flag is missing
 * 
 * BEHAVIOR DIFFERENCES:
 * - Images: Click opens carousel viewer (same as Grid layout)
 * - Non-images: Click opens Article Detail drawer (different from Grid layout)
 * 
 * Rules:
 * - No card wrapper
 * - No background container
 * - No shadow
 * - Media element renders directly
 * - Optional minimal border-radius only if needed
 */
export const MediaBlock: React.FC<MediaBlockProps> = ({
  article,
  onCategoryClick,
  onArticleClick,
}) => {
  // Get media items that should be visible in Masonry layout
  const visibleMediaItems = getMasonryVisibleMedia(article);
  
  // If no media should be shown, return null
  if (visibleMediaItems.length === 0) return null;

  // State for image carousel (lightbox)
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  // Collect all image URLs for carousel (only from visible items that are images)
  const imageUrls = visibleMediaItems
    .filter(item => item.type === 'image')
    .map(item => item.url);

  /**
   * Handle click on a media tile
   * - If image: open carousel viewer (stops propagation to prevent parent click)
   * - If YouTube/other: open Article Detail drawer (stops propagation to prevent parent click)
   */
  const handleMediaClick = (e: React.MouseEvent, item: MasonryMediaItem, index: number) => {
    // Stop event bubbling from image tiles so closing the carousel
    // does not trigger the masonry tile drawer click handler.
    e.stopPropagation(); // Prevent parent click handler from firing
    
    if (item.type === 'image') {
      // Open image carousel viewer
      setLightboxImages(imageUrls);
      setLightboxIndex(imageUrls.indexOf(item.url));
      setShowLightbox(true);
    } else {
      // Open Article Detail drawer for non-image media
      if (onArticleClick) {
        onArticleClick(article);
      }
    }
  };

  /**
   * Handle carousel close with event propagation control
   * Stop event bubbling so closing the carousel does not trigger the masonry tile drawer click handler.
   */
  const handleCarouselClose = (e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    setShowLightbox(false);
  };

  /**
   * Handle keyboard navigation (Enter/Space)
   */
  const handleKeyDown = (e: React.KeyboardEvent, item: MasonryMediaItem, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (item.type === 'image') {
        setLightboxImages(imageUrls);
        setLightboxIndex(imageUrls.indexOf(item.url));
        setShowLightbox(true);
      } else {
        if (onArticleClick) {
          onArticleClick(article);
        }
      }
    }
  };

  // PART A: Unified hover effect for ALL masonry tiles
  // Apply the same premium hover effect to all tiles (including YouTube/video)
  // for visual consistency across the Masonry layout
  const shouldApplyHover = (item: MasonryMediaItem): boolean => {
    // All tiles now get the unified hover effect
    return true;
  };

  /**
   * Truncate masonry title for display
   * Desktop: 40 chars, Mobile: 28 chars, single-line with ellipsis
   */
  const truncateTitle = (title: string, isMobile: boolean = false): string => {
    const maxLength = isMobile ? 28 : 40;
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength).trim() + '…';
  };

  // Render each visible media item as an individual tile
  return (
    <>
      <div className="w-full space-y-4">
        {visibleMediaItems.map((item, index) => {
          const applyHover = shouldApplyHover(item);
          
          return (
            <div
              key={item.id}
              className={`group relative w-full cursor-pointer ${applyHover ? 'masonry-tile' : ''}`}
              onClick={(e) => handleMediaClick(e, item, index)}
              onKeyDown={(e) => handleKeyDown(e, item, index)}
              tabIndex={0}
              role="button"
              aria-label={item.type === 'image' ? 'View image in gallery' : 'View article details'}
            >
              {item.type === 'image' ? (
                // Render image tile with unified hover effects
                <div className="relative w-full rounded-lg overflow-hidden">
                  {/* PART A: Unified hover pattern (premium subtle UX) */}
                  {/* Applies to ALL tiles including YouTube/video for visual consistency */}
                  {applyHover && (
                    <>
                      {/* Dim overlay (2-4% opacity) */}
                      <div className="hover-overlay absolute inset-0 bg-black pointer-events-none z-10" />
                      
                      {/* Hover icon (top-right) */}
                      <div className="hover-icon absolute top-3 right-3 z-20 pointer-events-none">
                        <Maximize2 
                          size={16} 
                          className="text-white drop-shadow-lg"
                          strokeWidth={2}
                        />
                      </div>
                    </>
                  )}
                  
                  <Image
                    src={item.url}
                    alt={article.title ? `Image ${index + 1} for ${article.title}` : `Article image ${index + 1}`}
                    className="w-full h-auto object-contain"
                  />
                  
                  {/* PART C: Masonry tile title caption (hover-only, bottom of tile) */}
                  {/* Masonry caption must live inside the same stacking context as the tile */}
                  {/* so it appears above the dim overlay and does not get clipped */}
                  {item.masonryTitle && (
                    <div
                      className="
                        absolute bottom-0 left-0 right-0
                        z-20
                        px-2 py-1
                        text-xs font-medium
                        truncate
                        bg-black/60 text-white
                        opacity-0 group-hover:opacity-100
                        transition-opacity duration-150
                        pointer-events-none
                      "
                      title={item.masonryTitle.length > 40 ? item.masonryTitle : undefined}
                    >
                      {/* Desktop: show up to 40 chars, Mobile: show up to 28 chars */}
                      <span className="hidden md:inline">{truncateTitle(item.masonryTitle, false)}</span>
                      <span className="md:hidden">{truncateTitle(item.masonryTitle, true)}</span>
                    </div>
                  )}
                </div>
              ) : (
                // Render non-image media (YouTube, etc.) with unified hover effects
                // PART A: YouTube/video thumbnails now get the same hover treatment
                <div className="relative w-full rounded-lg overflow-hidden">
                  {/* Unified hover pattern for YouTube/video tiles */}
                  {applyHover && (
                    <>
                      {/* Dim overlay (2-4% opacity) */}
                      <div className="hover-overlay absolute inset-0 bg-black pointer-events-none z-10" />
                      
                      {/* Hover icon (top-right) */}
                      <div className="hover-icon absolute top-3 right-3 z-20 pointer-events-none">
                        <Maximize2 
                          size={16} 
                          className="text-white drop-shadow-lg"
                          strokeWidth={2}
                        />
                      </div>
                    </>
                  )}
                  
                  <EmbeddedMedia
                    media={{
                      type: item.type,
                      url: item.url,
                      thumbnail_url: item.thumbnail,
                      previewMetadata: item.previewMetadata,
                    }}
                    onClick={(e) => {
                      // EmbeddedMedia may pass an event or not, handle both cases
                      if (e && 'stopPropagation' in e) {
                        handleMediaClick(e as React.MouseEvent, item, index);
                      } else {
                        // Fallback if no event provided
                        const syntheticEvent = {
                          stopPropagation: () => {},
                        } as React.MouseEvent;
                        handleMediaClick(syntheticEvent, item, index);
                      }
                    }}
                  />
                  
                  {/* PART C: Masonry tile title caption (hover-only, bottom of tile) */}
                  {/* Masonry caption must live inside the same stacking context as the tile */}
                  {/* so it appears above the dim overlay and does not get clipped */}
                  {item.masonryTitle && (
                    <div
                      className="
                        absolute bottom-0 left-0 right-0
                        z-20
                        px-2 py-1
                        text-xs font-medium
                        truncate
                        bg-black/60 text-white
                        opacity-0 group-hover:opacity-100
                        transition-opacity duration-150
                        pointer-events-none
                      "
                      title={item.masonryTitle.length > 40 ? item.masonryTitle : undefined}
                    >
                      {/* Desktop: show up to 40 chars, Mobile: show up to 28 chars */}
                      <span className="hidden md:inline">{truncateTitle(item.masonryTitle, false)}</span>
                      <span className="md:hidden">{truncateTitle(item.masonryTitle, true)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Image Lightbox (Carousel Viewer) - Only for images */}
      {showLightbox && imageUrls.length > 0 && (
        <ImageLightbox
          isOpen={showLightbox}
          onClose={handleCarouselClose}
          images={imageUrls}
          initialIndex={lightboxIndex}
          sidebarContent={
            <ArticleDetail
              article={article}
              isModal={false}
            />
          }
        />
      )}
    </>
  );
};

