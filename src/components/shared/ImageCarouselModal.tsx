/**
 * ============================================================================
 * IMAGE CAROUSEL MODAL: In-App Image Viewing
 * ============================================================================
 * 
 * PURPOSE:
 * - Replace new-tab image opening with in-app modal
 * - Preserve reading context (no navigation away)
 * - Support multiple images with carousel navigation
 * - Maintain accessibility (keyboard, ESC to close)
 * 
 * FEATURES:
 * - Full image visibility (no cropping, object-fit: contain)
 * - Arrow navigation (left/right)
 * - Keyboard support (←/→ arrows, ESC to close)
 * - Body scroll lock when open
 * - Click outside to close
 * - Current image indicator (1/N)
 * 
 * CONSTRAINTS:
 * - No typography changes
 * - No body scroll when open
 * - No layout shifts
 * - Minimal dependencies (uses React portals only)
 * 
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Image } from '@/components/Image';

interface ImageCarouselModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[]; // Array of image URLs
  initialIndex?: number; // Start at this index (clicked image)
  titles?: string[]; // Optional titles for each image
}

export const ImageCarouselModal: React.FC<ImageCarouselModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  titles,
}) => {
  // Current image index state
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Update current index when initialIndex changes (e.g., different image clicked)
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, isOpen]);
  
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  // Navigation functions
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);
  
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);
  
  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToPrevious, goToNext]);
  
  // Don't render if not open
  if (!isOpen) return null;
  
  const currentImage = images[currentIndex];
  const currentTitle = titles?.[currentIndex];
  const hasMultipleImages = images.length > 1;
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Image carousel"
    >
      {/* Click outside to close */}
      <div 
        className="absolute inset-0" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Content Container */}
      <div className="relative w-full h-full max-w-7xl max-h-screen p-4 md:p-8 flex flex-col">
        {/* Header: Close button + Counter */}
        <div className="flex items-center justify-between mb-4 z-10">
          {/* Image counter (left) */}
          {hasMultipleImages && (
            <div className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
              {currentIndex + 1} / {images.length}
            </div>
          )}
          
          {/* Spacer */}
          {!hasMultipleImages && <div />}
          
          {/* Close button (right) */}
          <button
            onClick={onClose}
            className="text-white hover:text-slate-300 transition-colors p-2 hover:bg-white/10 rounded-full"
            aria-label="Close image viewer"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Image Container with Navigation */}
        <div className="flex-1 flex items-center justify-center relative">
          {/* Previous button (left) */}
          {hasMultipleImages && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 text-white hover:text-slate-300 transition-colors p-3 hover:bg-white/10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous image"
            >
              <ChevronLeft size={32} strokeWidth={2.5} />
            </button>
          )}
          
          {/* Image Display Area
              - No cropping (object-fit: contain)
              - Preserves aspect ratio
              - Fits within viewport
              - Centered horizontally and vertically */}
          <div 
            className="relative w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={currentImage}
              alt={currentTitle || `Image ${currentIndex + 1} of ${images.length}`}
              className="max-w-full max-h-full w-auto h-auto object-contain"
              style={{
                // Ensure image never exceeds viewport
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            />
          </div>
          
          {/* Next button (right) */}
          {hasMultipleImages && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 text-white hover:text-slate-300 transition-colors p-3 hover:bg-white/10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next image"
            >
              <ChevronRight size={32} strokeWidth={2.5} />
            </button>
          )}
        </div>
        
        {/* Optional: Image title/caption at bottom */}
        {currentTitle && (
          <div className="mt-4 text-center">
            <p className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm inline-block">
              {currentTitle}
            </p>
          </div>
        )}
        
        {/* Keyboard hints (optional, subtle) */}
        {hasMultipleImages && (
          <div className="mt-2 text-center">
            <p className="text-slate-400 text-xs">
              Use arrow keys to navigate • ESC to close
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};





