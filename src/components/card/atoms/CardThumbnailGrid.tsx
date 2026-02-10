/**
 * ============================================================================
 * CARD THUMBNAIL GRID: Adaptive Multi-Image Preview for Card Thumbnails
 * ============================================================================
 * 
 * PURPOSE:
 * Display flexible image layouts as card thumbnails based on image count.
 * 
 * ADAPTIVE LAYOUT RULES:
 * - 2 images: Side-by-side (1x2 layout)
 * - 3 images: 1 large left, 2 stacked right (masonry style)
 * - 4 images: 2x2 grid
 * - 5+ images: 2x2 grid with "+N" badge on 4th cell
 * 
 * RENDERING PRINCIPLES:
 * - Uses object-contain to preserve full image visibility (no cropping)
 * - Maintains card aspect ratio and rounded corners
 * - Consistent neutral background for all cells
 * - Click behavior unchanged (opens drawer)
 * 
 * IMPORTANT:
 * - This component is ONLY for card thumbnails (not drawer content)
 * - Does NOT replace single-image or video thumbnail behavior
 * - Layout adapts to image count for optimal visual presentation
 *
 * PHASE 2: Accessibility (ARIA, keyboard nav) and responsive breakpoints.
 * PHASE 3: Loading skeleton, error + retry, progressive fade-in, optional aspect-ratio-aware layout.
 * ============================================================================
 */

import React, { useCallback, useState } from 'react';
import { Image } from '@/components/Image';
import { LayoutGrid, ImageOff, RotateCcw } from 'lucide-react';

interface CardThumbnailGridProps {
  images: string[];
  articleTitle?: string;
  onGridClick?: (e: React.MouseEvent) => void;
  /** Phase 3: optional width/height ratio per image for aspect-ratio-aware layout */
  imageAspectRatios?: (number | null)[];
  // Link button is now rendered by parent (GridVariant) for consistency
  // These props are kept for backward compatibility but no longer used
  showLinkBadge?: boolean;
  linkUrl?: string | null;
}

/** Phase 3: Cell with loading skeleton, error state with retry, and progressive fade-in */
interface ThumbnailCellProps {
  src: string;
  alt: string;
  cellClassName: string;
  ariaLabel: string;
  onKeyDown: (e: React.KeyboardEvent) => void;
  children?: React.ReactNode;
}

const ThumbnailCell: React.FC<ThumbnailCellProps> = ({
  src,
  alt,
  cellClassName,
  ariaLabel,
  onKeyDown,
  children,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(false);
    setLoading(true);
    setRetryCount((c) => c + 1);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cellClassName}
    >
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 p-2">
          <ImageOff className="w-6 h-6 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden />
          <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Image unavailable</span>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded px-2 py-1 min-h-[44px] min-w-[44px] justify-center"
            aria-label="Try loading image again"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      ) : (
        <>
          {loading && (
            <div
              className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-none"
              aria-hidden
            />
          )}
          <Image
            key={retryCount}
            src={src}
            alt={alt}
            onLoad={() => setLoading(false)}
            onError={() => setError(true)}
            className={`w-full h-full object-contain transition-transform duration-300 group-hover/image:scale-[1.02] transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
          />
        </>
      )}
      {children}
    </div>
  );
};
ThumbnailCell.displayName = 'ThumbnailCell';

export const CardThumbnailGrid: React.FC<CardThumbnailGridProps> = React.memo(({
  images,
  articleTitle,
  onGridClick,
  imageAspectRatios,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showLinkBadge = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  linkUrl,
}) => {
  // We expect at least 2 images for grid display
  if (!images || images.length < 2) return null;

  const imageCount = images.length;
  const baseCellClass =
    'relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer group/image min-h-[44px]';
  const hoverOverlay = (
    <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors duration-200 pointer-events-none" />
  );
  
  // Helper to generate alt text
  const getAltText = (idx: number): string => {
    return articleTitle
      ? `Image ${idx + 1} of ${imageCount} for ${articleTitle}`
      : `Image ${idx + 1} of ${imageCount}`;
  };

  // Phase 2: Keyboard handler for accessibility (Enter/Space activate grid)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onGridClick?.(e as unknown as React.MouseEvent);
      }
    },
    [onGridClick]
  );

  // Phase 3: aspect-ratio-aware columns for 2 images when ratios provided (width/height)
  const hasTwoAspectRatios =
    imageCount === 2 &&
    imageAspectRatios?.length >= 2 &&
    imageAspectRatios[0] != null &&
    imageAspectRatios[1] != null;
  const twoImageGridStyle = hasTwoAspectRatios
    ? {
        gridTemplateColumns: `${imageAspectRatios![0] / (imageAspectRatios![0] + imageAspectRatios![1])}fr ${imageAspectRatios![1] / (imageAspectRatios![0] + imageAspectRatios![1])}fr`,
      }
    : undefined;

  // ============================================================================
  // LAYOUT 1: Two Images (side-by-side; Phase 2: stack on mobile; Phase 3: optional aspect-ratio-aware)
  // ============================================================================
  if (imageCount === 2) {
    return (
      <div
        className={`grid gap-1 w-full h-full relative ${hasTwoAspectRatios ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}
        style={twoImageGridStyle}
        onClick={onGridClick}
        role="group"
        aria-label={`Image gallery, ${imageCount} images`}
      >
        {images.slice(0, 2).map((imageUrl, idx) => (
          <ThumbnailCell
            key={idx}
            src={imageUrl}
            alt={getAltText(idx)}
            cellClassName={baseCellClass}
            ariaLabel={`View image ${idx + 1} of ${imageCount}`}
            onKeyDown={handleKeyDown}
          >
            {hoverOverlay}
          </ThumbnailCell>
        ))}
      </div>
    );
  }

  // ============================================================================
  // LAYOUT 2: Three Images (1 left large, 2 right stacked)
  // ============================================================================
  if (imageCount === 3) {
    return (
      <div
        className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full relative"
        onClick={onGridClick}
        role="group"
        aria-label={`Image gallery, ${imageCount} images`}
      >
        <ThumbnailCell
          src={images[0]}
          alt={getAltText(0)}
          cellClassName={`row-span-2 ${baseCellClass}`}
          ariaLabel={`View image 1 of ${imageCount}`}
          onKeyDown={handleKeyDown}
        >
          {hoverOverlay}
        </ThumbnailCell>
        {images.slice(1, 3).map((imageUrl, idx) => (
          <ThumbnailCell
            key={idx + 1}
            src={imageUrl}
            alt={getAltText(idx + 1)}
            cellClassName={baseCellClass}
            ariaLabel={`View image ${idx + 2} of ${imageCount}`}
            onKeyDown={handleKeyDown}
          >
            {hoverOverlay}
          </ThumbnailCell>
        ))}
      </div>
    );
  }

  // ============================================================================
  // LAYOUT 3: Four or More Images (2x2 grid with +N badge for overflow)
  // ============================================================================
  const displayImages = images.slice(0, 4);
  const remainingCount = imageCount - 4;

  return (
    <div
      className="grid grid-cols-2 gap-1 w-full h-full relative"
      onClick={onGridClick}
      role="group"
      aria-label={`Image gallery, ${imageCount} images`}
    >
      {displayImages.map((imageUrl, idx) => (
        <ThumbnailCell
          key={idx}
          src={imageUrl}
          alt={getAltText(idx)}
          cellClassName={baseCellClass}
          ariaLabel={`View image ${idx + 1} of ${imageCount}`}
          onKeyDown={handleKeyDown}
        >
          {hoverOverlay}
          {/* "+N" overlay on 4th cell if more than 4 images (Phase 1: enhanced visibility) */}
          {idx === 3 && remainingCount > 0 && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none z-10">
              <LayoutGrid className="w-5 h-5 mb-1 text-white" strokeWidth={2} />
              <span className="text-white text-base font-bold">+{remainingCount}</span>
              <span className="text-white/80 text-xs mt-0.5">more</span>
            </div>
          )}
        </ThumbnailCell>
      ))}
    </div>
  );
});

CardThumbnailGrid.displayName = 'CardThumbnailGrid';

