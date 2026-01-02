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
 * ============================================================================
 */

import React from 'react';
import { Image } from '@/components/Image';

interface CardThumbnailGridProps {
  images: string[];
  articleTitle?: string;
  onGridClick?: (e: React.MouseEvent) => void;
}

export const CardThumbnailGrid: React.FC<CardThumbnailGridProps> = React.memo(({
  images,
  articleTitle,
  onGridClick,
}) => {
  // We expect at least 2 images for grid display
  if (!images || images.length < 2) return null;

  const imageCount = images.length;
  
  // Helper to generate alt text
  const getAltText = (idx: number): string => {
    return articleTitle
      ? `Image ${idx + 1} of ${imageCount} for ${articleTitle}`
      : `Image ${idx + 1} of ${imageCount}`;
  };

  // ============================================================================
  // LAYOUT 1: Two Images (side-by-side)
  // ============================================================================
  if (imageCount === 2) {
    return (
      <div 
        className="grid grid-cols-2 gap-0.5 w-full h-full"
        onClick={onGridClick}
      >
        {images.slice(0, 2).map((imageUrl, idx) => (
          <div
            key={idx}
            className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
          >
            <Image
              src={imageUrl}
              alt={getAltText(idx)}
              className="w-full h-full object-contain transition-transform duration-300 group-hover/media:scale-105"
            />
          </div>
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
        className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full"
        onClick={onGridClick}
      >
        {/* Left side: First image spans full height (2 rows) */}
        <div
          className="row-span-2 relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
        >
          <Image
            src={images[0]}
            alt={getAltText(0)}
            className="w-full h-full object-contain transition-transform duration-300 group-hover/media:scale-105"
          />
        </div>
        
        {/* Right side: Images 2 and 3 stacked vertically */}
        {images.slice(1, 3).map((imageUrl, idx) => (
          <div
            key={idx + 1}
            className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
          >
            <Image
              src={imageUrl}
              alt={getAltText(idx + 1)}
              className="w-full h-full object-contain transition-transform duration-300 group-hover/media:scale-105"
            />
          </div>
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
      className="grid grid-cols-2 gap-0.5 w-full h-full"
      onClick={onGridClick}
    >
      {displayImages.map((imageUrl, idx) => (
        <div
          key={idx}
          className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
        >
          <Image
            src={imageUrl}
            alt={getAltText(idx)}
            className="w-full h-full object-contain transition-transform duration-300 group-hover/media:scale-105"
          />
          
          {/* "+N" overlay on 4th cell if more than 4 images */}
          {idx === 3 && remainingCount > 0 && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <span className="text-white text-sm font-bold">
                +{remainingCount}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

CardThumbnailGrid.displayName = 'CardThumbnailGrid';

