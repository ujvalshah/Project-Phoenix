import React, { useMemo, useState } from 'react';
import { Article } from '@/types';
import { EmbeddedMedia } from '@/components/embeds/EmbeddedMedia';
import { Image } from '@/components/Image';
import {
  getMasonryVisibleMedia,
  collectMasonryMediaItems,
  buildLightboxSourceLinksForImageUrls,
  MasonryMediaItem,
} from '@/utils/masonryMediaHelper';
import { ImageLightbox } from '@/components/ImageLightbox';
import { ArticleDetail } from '@/components/ArticleDetail';
import { Maximize2 } from 'lucide-react';

/**
 * Visible title for non-YouTube masonry tiles (Path A).
 * Precedence: masonryTitle → article.title → item previewMetadata.title.
 * YouTube tiles use EmbeddedMedia’s built-in strip only — do not add a second band here.
 */
function resolveNonYouTubeMasonryTileTitle(
  item: MasonryMediaItem,
  article: Article,
): string | null {
  const masonry = item.masonryTitle?.trim();
  if (masonry) return masonry;
  const articleTitle = article.title?.trim();
  if (articleTitle) return articleTitle;
  const metaTitle = item.previewMetadata?.title?.trim();
  if (metaTitle) return metaTitle;
  return null;
}

function buildMasonryTileAriaLabel(item: MasonryMediaItem, article: Article): string {
  if (item.type === 'youtube') {
    const videoLabel =
      item.previewMetadata?.title?.trim() || article.title?.trim();
    return videoLabel ? `View video: ${videoLabel}` : 'View video details';
  }
  const resolved = resolveNonYouTubeMasonryTileTitle(item, article);
  if (item.type === 'image') {
    return resolved ? `View image in gallery: ${resolved}` : 'View image in gallery';
  }
  return resolved ? `View article details: ${resolved}` : 'View article details';
}

/** Bottom scrim + clamped title; always visible (hover is not required to read the tile). */
const MasonryNonYouTubeTitleScrim: React.FC<{ text: string; titleId: string }> = ({
  text,
  titleId,
}) => (
  <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
    <div className="bg-gradient-to-t from-black/85 via-black/65 to-transparent pb-1.5 pt-7 sm:pt-9 px-2.5">
      <p
        id={titleId}
        className="text-left text-[11px] sm:text-xs font-semibold leading-snug text-white drop-shadow-md line-clamp-2 max-sm:line-clamp-1"
        title={text.length > 80 ? text : undefined}
      >
        {text}
      </p>
    </div>
  </div>
);

interface MediaBlockProps {
  article: Article;
  mediaItemId?: string; // If specified, render only this media item (for individual tile rendering)
  /**
   * When provided (MasonryGrid path), skips expensive collectMasonryMediaItems/getMasonryVisibleMedia
   * per tile — same array is shared for all tiles of an article.
   */
  prefetchedAllMasonryItems?: MasonryMediaItem[];
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
 *
 * Masonry titles (Path A):
 * - Non-YouTube: bottom gradient + clamped title (masonryTitle → article.title → preview title);
 *   always visible; fine-pointer hover polish remains on `.masonry-tile` (index.css).
 * - YouTube: title strip comes only from EmbeddedMedia (no second scrim here).
 */
export const MediaBlock: React.FC<MediaBlockProps> = ({
  article,
  mediaItemId,
  prefetchedAllMasonryItems,
  onCategoryClick,
  onArticleClick,
}) => {
  const allMediaItems = useMemo(
    () => prefetchedAllMasonryItems ?? collectMasonryMediaItems(article),
    [article, prefetchedAllMasonryItems],
  );

  const visibleMediaItems = useMemo(
    () =>
      prefetchedAllMasonryItems
        ? prefetchedAllMasonryItems.filter((item) => item.showInMasonry === true)
        : getMasonryVisibleMedia(article),
    [article, prefetchedAllMasonryItems],
  );

  const itemsToRender = useMemo(() => {
    if (visibleMediaItems.length === 0) return [];
    return mediaItemId
      ? visibleMediaItems.filter((item) => item.id === mediaItemId)
      : visibleMediaItems;
  }, [visibleMediaItems, mediaItemId]);

  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  const allImageUrls = useMemo(() => {
    return allMediaItems.filter((item) => item.type === 'image').map((item) => item.url);
  }, [allMediaItems]);

  const lightboxSourceLinks = useMemo(
    () => buildLightboxSourceLinksForImageUrls(article, allImageUrls),
    [article, allImageUrls],
  );

  if (itemsToRender.length === 0) return null;

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
      // Open image carousel viewer with ALL images from the nugget
      // Find the clicked image's index in the complete list of all images
      setLightboxImages(allImageUrls);
      setLightboxIndex(allImageUrls.indexOf(item.url));
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
    // If focus is on an interactive child (e.g., the overlay link button),
    // do not trigger the tile's open behavior.
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a')) {
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (item.type === 'image') {
        // Open image carousel viewer with ALL images from the nugget
        setLightboxImages(allImageUrls);
        setLightboxIndex(allImageUrls.indexOf(item.url));
        setShowLightbox(true);
      } else {
        if (onArticleClick) {
          onArticleClick(article);
        }
      }
    }
  };

  // Render the media item(s) - typically just one when mediaItemId is specified
  // When mediaItemId is specified, itemsToRender contains exactly one item
  return (
    <>
      {itemsToRender.map((item, index) => {
          const isYouTube = item.type === 'youtube';
          const nonYouTubeTitle =
            !isYouTube ? resolveNonYouTubeMasonryTileTitle(item, article) : null;
          const ariaLabel = buildMasonryTileAriaLabel(item, article);
          const visibleTitleId = nonYouTubeTitle
            ? `masonry-tile-title-${article.id}-${item.id}`
            : undefined;
          const imageAlt = nonYouTubeTitle
            ? `Image ${index + 1} for ${nonYouTubeTitle}`
            : article.title
              ? `Image ${index + 1} for ${article.title}`
              : `Article image ${index + 1}`;

          return (
            <div
              key={item.id}
              className="group relative w-full cursor-pointer masonry-tile"
              onClick={(e) => handleMediaClick(e, item, index)}
              onKeyDown={(e) => handleKeyDown(e, item, index)}
              tabIndex={0}
              role="button"
              aria-labelledby={visibleTitleId}
              aria-label={!visibleTitleId ? ariaLabel : undefined}
            >
              {item.type === 'image' ? (
                <div className="relative w-full rounded-lg overflow-hidden">
                  <>
                    <div className="hover-overlay absolute inset-0 bg-black pointer-events-none z-10" />
                    <div className="hover-icon absolute top-3 right-3 z-20 pointer-events-none">
                      <Maximize2
                        size={16}
                        className="text-white drop-shadow-lg"
                        strokeWidth={2}
                      />
                    </div>
                  </>

                  <Image
                    src={item.url}
                    alt={imageAlt}
                    className="w-full h-auto object-contain"
                  />

                  {nonYouTubeTitle ? (
                    <MasonryNonYouTubeTitleScrim
                      text={nonYouTubeTitle}
                      titleId={visibleTitleId as string}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="relative w-full rounded-lg overflow-hidden">
                  <>
                    <div className="hover-overlay absolute inset-0 bg-black pointer-events-none z-10" />
                    <div className="hover-icon absolute top-3 right-3 z-20 pointer-events-none">
                      <Maximize2
                        size={16}
                        className="text-white drop-shadow-lg"
                        strokeWidth={2}
                      />
                    </div>
                  </>

                  <EmbeddedMedia
                    media={{
                      type: item.type,
                      url: item.url,
                      thumbnail_url: item.thumbnail,
                      previewMetadata: item.previewMetadata,
                    }}
                    onClick={(e) => {
                      if (e && 'stopPropagation' in e) {
                        handleMediaClick(e as React.MouseEvent, item, index);
                      } else {
                        const syntheticEvent = {
                          stopPropagation: () => {},
                        } as React.MouseEvent;
                        handleMediaClick(syntheticEvent, item, index);
                      }
                    }}
                  />

                  {!isYouTube && nonYouTubeTitle ? (
                    <MasonryNonYouTubeTitleScrim
                      text={nonYouTubeTitle}
                      titleId={visibleTitleId as string}
                    />
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

      {/* Image Lightbox (Carousel Viewer) - Only for images */}
      {/* Shows ALL images from the nugget, not just visible masonry tiles */}
      {showLightbox && allImageUrls.length > 0 && (
        <ImageLightbox
          isOpen={showLightbox}
          onClose={handleCarouselClose}
          images={allImageUrls}
          initialIndex={lightboxIndex}
          sourceLinksPerImage={lightboxSourceLinks}
          sidebarContent={
            <ArticleDetail
              article={article}
              isModal={false}
              showHeader={true}
              onClose={handleCarouselClose}
            />
          }
        />
      )}
    </>
  );
};

