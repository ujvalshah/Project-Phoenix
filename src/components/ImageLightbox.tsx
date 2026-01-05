import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Minimize2 } from 'lucide-react';
import { Image } from '@/components/Image';

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent) => void;
  images: string[];
  initialIndex?: number;
  sidebarContent?: React.ReactNode;
}

type ViewerMode = 'carousel' | 'fullscreen';

/**
 * ============================================================================
 * IMAGE LIGHTBOX: Progressive-Disclosure Media Viewer
 * ============================================================================
 * 
 * INTERACTION MODEL:
 * 1. SINGLE IMAGE → Always opens in FULLSCREEN MODE
 * 2. MULTIPLE IMAGES → Opens in TWO-PANEL MODE (carousel + content)
 *    - Clicking image in carousel → switches to FULLSCREEN MODE
 *    - ESC in fullscreen → returns to TWO-PANEL MODE
 *    - ESC in two-panel → closes viewer
 * 
 * STATE MODEL:
 * - mode: "carousel" | "fullscreen"
 * - currentIndex: preserved when switching modes
 * 
 * RESPONSIVE BEHAVIOR:
 * - Desktop (>768px): Two-panel = horizontal (left: carousel, right: content)
 * - Mobile (≤768px): Two-panel = vertical stack (top: carousel, bottom: content)
 * - Safe-area padding for mobile devices
 * - 44px minimum tap targets
 * 
 * ============================================================================
 */

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ 
  isOpen, 
  onClose, 
  images, 
  initialIndex = 0,
  sidebarContent
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  // State model: mode switching with index preservation
  const [mode, setMode] = useState<ViewerMode>('carousel');
  const hasMultipleImages = images.length > 1;
  const hasSidebar = !!sidebarContent;
  
  // Zoom/pan state (only for fullscreen mode)
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Determine initial mode: single image = fullscreen, multiple = carousel
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      // Single image: always fullscreen; Multiple images: start in carousel mode
      setMode(hasMultipleImages ? 'carousel' : 'fullscreen');
      // Reset zoom/pan when opening
      setZoom(1);
      setPanX(0);
      setPanY(0);
    }
  }, [isOpen, initialIndex, hasMultipleImages]);

  // Reset zoom/pan when image changes
  useEffect(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, [currentIndex]);

  // Lock body scroll when viewer is open
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

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handleClose = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    onClose(e);
  }, [onClose]);

  // Switch to fullscreen mode (clicking image in carousel)
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (mode === 'carousel' && hasMultipleImages) {
      e.stopPropagation();
      setMode('fullscreen');
    }
  }, [mode, hasMultipleImages]);

  // Exit fullscreen back to carousel (only if multiple images)
  const handleExitFullscreen = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (hasMultipleImages) {
      setMode('carousel');
      // Reset zoom/pan when exiting fullscreen
      setZoom(1);
      setPanX(0);
      setPanY(0);
    } else {
      handleClose(e);
    }
  }, [hasMultipleImages, handleClose]);

  // Zoom handlers (fullscreen mode only)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (mode !== 'fullscreen') return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(1, Math.min(5, prev + delta)));
  }, [mode]);

  // Pan handlers (drag to pan when zoomed)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode !== 'fullscreen' || zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  }, [mode, zoom, panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || mode !== 'fullscreen' || zoom <= 1) return;
    e.preventDefault();
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  }, [isDragging, mode, zoom, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for mobile pinch-to-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (mode !== 'fullscreen' || e.touches.length !== 2) return;
    e.preventDefault();
    // Store initial touch distance for pinch
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
    (e.currentTarget as any).initialDistance = distance;
    (e.currentTarget as any).initialZoom = zoom;
  }, [mode, zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (mode !== 'fullscreen' || e.touches.length !== 2) return;
    e.preventDefault();
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
    const initialDistance = (e.currentTarget as any).initialDistance;
    const initialZoom = (e.currentTarget as any).initialZoom;
    if (initialDistance) {
      const scale = distance / initialDistance;
      setZoom(Math.max(1, Math.min(5, initialZoom * scale)));
    }
  }, [mode]);

  const handleTouchEnd = useCallback(() => {
    // Reset touch state
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'fullscreen' && hasMultipleImages) {
          // Exit fullscreen back to carousel
          setMode('carousel');
        } else {
          // Close viewer
          handleClose();
        }
      }
      if (mode === 'fullscreen' || !hasSidebar) {
        // Navigation only in fullscreen or when no sidebar
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'ArrowRight') handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, hasMultipleImages, hasSidebar, handleClose, handlePrev, handleNext]);

  if (!isOpen) return null;

  const isFullscreen = mode === 'fullscreen';
  const showTwoPanel = hasMultipleImages && hasSidebar && !isFullscreen;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={isFullscreen ? handleClose : undefined}
      style={{ 
        paddingTop: 'env(safe-area-inset-top)', 
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
    >
      {/* TWO-PANEL MODE: Carousel + Content (Multiple Images with Sidebar) */}
      {showTwoPanel ? (
        <div 
          className="w-full h-full flex flex-col md:flex-row"
          onClick={(e) => e.stopPropagation()}
        >
          {/* LEFT: Image Carousel Panel */}
          <div className="flex-1 relative flex items-center justify-center bg-black/50 overflow-hidden md:border-r border-slate-700">
            {/* Close Button */}
            <button 
              onClick={handleClose}
              className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50"
              aria-label="Close viewer"
            >
              <X size={24} />
            </button>

            {/* Image Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 font-medium z-50 bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-md min-h-[44px] flex items-center">
              {currentIndex + 1} / {images.length}
            </div>

            {/* Navigation Buttons - Two Panel Mode */}
            <button 
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center bg-black/80 hover:bg-black text-white rounded-full transition-all z-50 shadow-lg backdrop-blur-sm border border-white/10"
              aria-label="Previous image"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button 
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center bg-black/80 hover:bg-black text-white rounded-full transition-all z-50 shadow-lg backdrop-blur-sm border border-white/10"
              aria-label="Next image"
            >
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>

            {/* Image - Clickable to enter fullscreen */}
            <div 
              className="w-full h-full flex items-center justify-center p-4 md:p-8 cursor-zoom-in overflow-hidden"
              onClick={handleImageClick}
            >
              <Image
                src={images[currentIndex]} 
                alt={`Image ${currentIndex + 1} of ${images.length}`} 
                className="max-w-full max-h-full w-auto h-auto object-contain shadow-2xl select-none"
                style={{ 
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block'
                }}
                draggable={false}
              />
            </div>

            {/* Fullscreen hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs z-50 bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-md">
              Click image to view fullscreen
            </div>
          </div>

          {/* RIGHT: Content Panel (Desktop: Side-by-side, Mobile: Below) */}
          <div 
            className="w-full md:w-[400px] h-[50vh] md:h-full shrink-0 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-full">
              <div className="sticky top-0 right-0 p-2 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-end">
                <button 
                  onClick={handleClose} 
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  aria-label="Close viewer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                {sidebarContent}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* FULLSCREEN MODE: Single Image or Fullscreen from Carousel */
        <div className="w-full h-full relative flex items-center justify-center">
          {/* Close Button */}
          <button 
            onClick={isFullscreen && hasMultipleImages ? handleExitFullscreen : handleClose}
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50"
            aria-label={isFullscreen && hasMultipleImages ? "Exit fullscreen" : "Close viewer"}
          >
            {isFullscreen && hasMultipleImages ? <Minimize2 size={24} /> : <X size={24} />}
          </button>

          {/* Image Counter */}
          {hasMultipleImages && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 font-medium z-50 bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-md min-h-[44px] flex items-center">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Navigation Buttons - Fullscreen Mode */}
          {hasMultipleImages && (
            <>
              <button 
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center bg-black/80 hover:bg-black text-white rounded-full transition-all z-50 shadow-lg backdrop-blur-sm border border-white/10"
                aria-label="Previous image"
              >
                <ChevronLeft size={24} strokeWidth={2.5} />
              </button>
              <button 
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center bg-black/80 hover:bg-black text-white rounded-full transition-all z-50 shadow-lg backdrop-blur-sm border border-white/10"
                aria-label="Next image"
              >
                <ChevronRight size={24} strokeWidth={2.5} />
              </button>
            </>
          )}

          {/* Main Image Container - Zoom/Pan Support */}
          <div 
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{
              padding: '1rem',
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="flex items-center justify-center"
              style={{
                maxWidth: 'calc(100vw - 2rem - env(safe-area-inset-left) - env(safe-area-inset-right))',
                maxHeight: 'calc(100vh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
                width: '100%',
                height: '100%',
                transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                transformOrigin: 'center center',
              }}
            >
              <Image
                src={images[currentIndex]} 
                alt={`View ${currentIndex + 1} of ${images.length}`} 
                className="max-w-full max-h-full w-auto h-auto object-contain shadow-2xl select-none"
                style={{ 
                  userSelect: 'none', 
                  touchAction: 'none',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block'
                }}
                draggable={false}
              />
            </div>
            {/* Zoom indicator */}
            {zoom > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs z-50 bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-none">
                {Math.round(zoom * 100)}% • Drag to pan • Scroll to zoom
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
