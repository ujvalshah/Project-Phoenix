import React, { useMemo, useCallback } from 'react';
import { Image } from '@/components/Image';

interface ImageGridProps {
  images: string[];
  onImageClick: (index: number) => void;
  className?: string;
  articleTitle?: string; // For generating meaningful alt text
}

/**
 * Image grid layout matching design spec:
 * - 1 image: full width
 * - 2 images: 2 columns side-by-side
 * - 3 images: 2 columns (first spans 2 rows, next 2 on right)
 * - 4 images: 2x2 grid
 * - 5+ images: 2x2 grid with "+N" overlay on fourth image
 */
export const ImageGrid: React.FC<ImageGridProps> = React.memo(({ 
  images, 
  onImageClick,
  className = '',
  articleTitle,
}) => {
  // Memoize alt text generator
  const getImageAlt = useCallback((index: number, total: number) => {
    if (articleTitle) {
      return total > 1 
        ? `Image ${index + 1} of ${total} for ${articleTitle}`
        : `Image for ${articleTitle}`;
    }
    return total > 1 
      ? `Image ${index + 1} of ${total}`
      : 'Article image';
  }, [articleTitle]);

  // Filter out invalid images and ensure we have valid URLs
  const validImages = React.useMemo(() => {
    return images?.filter((img): img is string => 
      typeof img === 'string' && img.trim().length > 0
    ) || [];
  }, [images]);

  if (validImages.length === 0) return null;

  const getGridLayout = () => {
    const count = validImages.length;

    if (count === 1) {
      return (
        <div 
          className="w-full h-full cursor-pointer group flex items-center justify-center bg-slate-100 dark:bg-slate-900"
          onClick={() => onImageClick(0)}
        >
          <Image 
            src={validImages[0]} 
            alt={getImageAlt(0, 1)}
            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 max-w-full max-h-full" 
          />
        </div>
      );
    }

    if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-0.5 h-full">
          {validImages.slice(0, 2).map((img, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden cursor-pointer group"
              onClick={() => onImageClick(idx)}
            >
              <Image 
                src={img} 
                alt={getImageAlt(idx, 2)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              />
            </div>
          ))}
        </div>
      );
    }

    if (count === 3) {
      return (
        <div className="grid grid-cols-2 gap-0.5 h-full">
          <div
            className="row-span-2 relative overflow-hidden cursor-pointer group"
            onClick={() => onImageClick(0)}
          >
            <Image 
              src={validImages[0]} 
              alt={getImageAlt(0, 3)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
            />
          </div>
          {validImages.slice(1, 3).map((img, idx) => (
            <div
              key={idx + 1}
              className="relative overflow-hidden cursor-pointer group"
              onClick={() => onImageClick(idx + 1)}
            >
              <Image 
                src={img} 
                alt={getImageAlt(idx + 1, 3)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              />
            </div>
          ))}
        </div>
      );
    }

    if (count === 4) {
      return (
        <div className="grid grid-cols-2 gap-0.5 h-full">
          {validImages.slice(0, 4).map((img, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden cursor-pointer group"
              onClick={() => onImageClick(idx)}
            >
              <Image 
                src={img} 
                alt={getImageAlt(idx, 4)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              />
            </div>
          ))}
        </div>
      );
    }

    // 5+ images: Show 2x2 grid (4 images) with "+N" overlay on fourth image
    const remainingCount = count - 4;
    return (
      <div className="grid grid-cols-2 gap-0.5 h-full">
        {validImages.slice(0, 4).map((img, idx) => (
          <div
            key={idx}
            className="relative overflow-hidden cursor-pointer group"
            onClick={() => onImageClick(idx)}
          >
            <Image 
              src={img} 
              alt={getImageAlt(idx, count)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
            />
            {/* Show "+N" overlay on fourth image when there are 5+ images */}
            {idx === 3 && remainingCount > 0 && (
              <div 
                className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center cursor-pointer z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  onImageClick(3);
                }}
              >
                <span className="text-black text-lg font-bold">+{remainingCount}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`w-full h-full rounded-xl overflow-hidden ${className}`}>
      {getGridLayout()}
    </div>
  );
});

