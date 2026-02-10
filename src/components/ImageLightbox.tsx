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
  
  // Touch gesture state for mobile
  const touchStateRef = React.useRef<{
    isPinching: boolean;
    isPanning: boolean;
    isSwiping: boolean;
    swipeStart: { x: number; y: number } | null;
    swipeThreshold: number;
    initialDistance: number | null;
    initialZoom: number;
    panStart: { x: number; y: number } | null;
    lastPan: { x: number; y: number } | null;
    lastTapTime: number;
    lastTapPosition: { x: number; y: number } | null;
  }>({
    isPinching: false,
    isPanning: false,
    isSwiping: false,
    swipeStart: null,
    swipeThreshold: 50, // Minimum distance for swipe gesture
    initialDistance: null,
    initialZoom: 1,
    panStart: null,
    lastPan: null,
    lastTapTime: 0,
    lastTapPosition: null,
  });

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
    
    // Calculate pan with boundary constraints
    let newPanX = e.clientX - dragStart.x;
    let newPanY = e.clientY - dragStart.y;
    
    // Get container dimensions for boundary calculation
    const container = e.currentTarget as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Calculate max pan based on zoom level
    const maxPanX = Math.max(0, (containerWidth * (zoom - 1)) / 2);
    const maxPanY = Math.max(0, (containerHeight * (zoom - 1)) / 2);
    
    // Constrain pan to boundaries
    newPanX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
    newPanY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));
    
    setPanX(newPanX);
    setPanY(newPanY);
  }, [isDragging, mode, zoom, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for mobile: supports pinch-to-zoom, pan, swipe navigation, and swipe-to-close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touchCount = e.touches.length;
    const state = touchStateRef.current;
    const now = Date.now();
    
    if (touchCount === 2) {
      // Two-finger pinch gesture (only in fullscreen mode)
      if (mode !== 'fullscreen') return;
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      
      state.isPinching = true;
      state.isPanning = false;
      state.isSwiping = false;
      state.initialDistance = distance;
      state.initialZoom = zoom;
      state.panStart = null;
      state.swipeStart = null;
      state.lastPan = null;
      
      // Prevent default only for pinch gesture
      e.preventDefault();
    } else if (touchCount === 1) {
      const touch = e.touches[0];
      const touchPos = { x: touch.clientX, y: touch.clientY };
      
      if (mode === 'fullscreen') {
        // Check for double-tap zoom (works when zoomed or not zoomed)
        if (state.lastTapTime > 0 && state.lastTapPosition) {
          const timeSinceLastTap = now - state.lastTapTime;
          const distanceFromLastTap = Math.hypot(
            touchPos.x - state.lastTapPosition.x,
            touchPos.y - state.lastTapPosition.y
          );
          
          // Double-tap detected: < 300ms and < 50px movement
          if (timeSinceLastTap < 300 && distanceFromLastTap < 50) {
            if (zoom <= 1) {
              // Zoom to 2x on double-tap when not zoomed
              setZoom(2);
            } else {
              // Reset zoom to 1x on double-tap when already zoomed
              setZoom(1);
            }
            setPanX(0);
            setPanY(0);
            state.lastTapTime = 0;
            state.lastTapPosition = null;
            e.preventDefault();
            return;
          }
        }
        
        if (zoom > 1) {
          // Single-touch pan gesture (only when zoomed)
          state.isPanning = true;
          state.isPinching = false;
          state.isSwiping = false;
          state.panStart = { x: touch.clientX - panX, y: touch.clientY - panY };
          state.lastPan = { x: touch.clientX, y: touch.clientY };
          
          // Prevent default when panning (to prevent page scroll)
          e.preventDefault();
        } else {
          // Single touch when not zoomed - prepare for swipe navigation
          state.isPanning = false;
          state.isPinching = false;
          state.isSwiping = true;
          state.swipeStart = { x: touch.clientX, y: touch.clientY };
          state.panStart = null;
          state.lastPan = null;
          // Don't prevent default yet - wait to see if it's a swipe
        }
      } else {
        // In carousel mode or any mode - prepare for swipe navigation
        state.isPanning = false;
        state.isPinching = false;
        state.isSwiping = true;
        state.swipeStart = { x: touch.clientX, y: touch.clientY };
        state.panStart = null;
        state.lastPan = null;
      }
    }
  }, [mode, zoom, panX, panY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touchCount = e.touches.length;
    const state = touchStateRef.current;
    
    if (touchCount === 2 && state.isPinching && state.initialDistance !== null && mode === 'fullscreen') {
      // Two-finger pinch: update zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      
      const scale = distance / state.initialDistance;
      const newZoom = Math.max(1, Math.min(5, state.initialZoom * scale));
      setZoom(newZoom);
      
      // Prevent default for pinch gesture
      e.preventDefault();
    } else if (touchCount === 1 && state.isPanning && state.panStart && zoom > 1 && mode === 'fullscreen') {
      // Single-touch pan: update pan position with boundary constraints (only when zoomed)
      const touch = e.touches[0];
      
      // Calculate pan delta from start position
      let newPanX = touch.clientX - state.panStart.x;
      let newPanY = touch.clientY - state.panStart.y;
      
      // Get container dimensions for boundary calculation
      const container = e.currentTarget as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      
      // Calculate max pan based on zoom level and container size
      // When zoomed, image is larger than container, so we can pan
      // Max pan = (imageSize * zoom - containerSize) / 2
      // For simplicity, we estimate image size from container (assuming image fills container at zoom=1)
      const maxPanX = Math.max(0, (containerWidth * (zoom - 1)) / 2);
      const maxPanY = Math.max(0, (containerHeight * (zoom - 1)) / 2);
      
      // Constrain pan to boundaries
      newPanX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
      newPanY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));
      
      setPanX(newPanX);
      setPanY(newPanY);
      state.lastPan = { x: touch.clientX, y: touch.clientY };
      
      // Prevent default to prevent page scroll when panning
      e.preventDefault();
    } else if (touchCount === 1 && state.isSwiping && state.swipeStart && zoom <= 1) {
      // Swipe gesture detection (only when not zoomed)
      const touch = e.touches[0];
      const deltaX = touch.clientX - state.swipeStart.x;
      const deltaY = touch.clientY - state.swipeStart.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      // Determine swipe direction: horizontal (navigation) or vertical (close)
      // Horizontal swipe takes precedence if both are significant
      if (absDeltaX > state.swipeThreshold || absDeltaY > state.swipeThreshold) {
        if (absDeltaX > absDeltaY) {
          // Horizontal swipe - navigation
          // Prevent default to allow swipe navigation
          e.preventDefault();
        } else if (absDeltaY > state.swipeThreshold && absDeltaY > absDeltaX) {
          // Vertical swipe down - close modal
          e.preventDefault();
        }
      }
    }
  }, [mode, zoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const state = touchStateRef.current;
    const now = Date.now();
    
    if (e.touches.length === 0 && state.isSwiping && state.swipeStart) {
      // Swipe gesture completed - check if it meets threshold
      const touch = e.changedTouches[0];
      if (touch) {
        const deltaX = touch.clientX - state.swipeStart.x;
        const deltaY = touch.clientY - state.swipeStart.y;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        // Horizontal swipe: navigate between images
        if (absDeltaX > state.swipeThreshold && absDeltaX > absDeltaY && hasMultipleImages) {
          if (deltaX > 0) {
            // Swipe right: previous image
            handlePrev();
          } else {
            // Swipe left: next image
            handleNext();
          }
        }
        // Vertical swipe down: close modal
        else if (absDeltaY > state.swipeThreshold && absDeltaY > absDeltaX && deltaY > 0) {
          handleClose();
        }
        // If single touch ended and we weren't panning/swiping, record tap for double-tap detection
        else if (!state.isPanning && !state.isPinching && zoom <= 1 && absDeltaX < 10 && absDeltaY < 10) {
          // Record tap position and time for double-tap detection
          state.lastTapTime = now;
          state.lastTapPosition = { x: touch.clientX, y: touch.clientY };
        }
      }
      
      // Reset swipe state
      state.isSwiping = false;
      state.swipeStart = null;
    } else if (e.touches.length === 0 && !state.isPanning && !state.isPinching && !state.isSwiping && zoom <= 1) {
      // If single touch ended and we weren't panning/swiping, record tap for double-tap detection
      const touch = e.changedTouches[0];
      if (touch) {
        // Record tap position and time for double-tap detection
        state.lastTapTime = now;
        state.lastTapPosition = { x: touch.clientX, y: touch.clientY };
      }
    }
    
    // If we were panning and touch ended, check if we should reset pan on next touch
    if (state.isPanning && e.touches.length === 0) {
      // Touch ended - keep pan position but reset gesture state
      state.isPanning = false;
      state.panStart = null;
      state.lastPan = null;
    }
    
    // If pinch ended, reset pinch state
    if (state.isPinching && e.touches.length < 2) {
      state.isPinching = false;
      state.initialDistance = null;
    }
    
    // If all touches ended, reset gesture flags (but keep tap info for double-tap)
    if (e.touches.length === 0) {
      state.isPinching = false;
      state.isPanning = false;
      state.isSwiping = false;
      state.swipeStart = null;
      state.panStart = null;
      state.lastPan = null;
      state.initialDistance = null;
    }
  }, [zoom, hasMultipleImages, handlePrev, handleNext, handleClose]);

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
          <div 
            className="flex-1 relative flex items-center justify-center bg-black/50 overflow-hidden md:border-r border-slate-700"
            style={{ touchAction: 'pan-y' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
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
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              // Critical: Use 'none' to handle all gestures manually
              // This allows us to implement pinch-zoom, pan, and double-tap zoom
              // without browser interference
              touchAction: 'none',
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
                transition: (isDragging || touchStateRef.current.isPanning) ? 'none' : 'transform 0.1s ease-out',
                transformOrigin: 'center center',
              }}
            >
              <Image
                src={images[currentIndex]} 
                alt={`View ${currentIndex + 1} of ${images.length}`} 
                className="max-w-full max-h-full w-auto h-auto object-contain shadow-2xl select-none"
                style={{ 
                  userSelect: 'none',
                  // Image inherits touch-action: none from container
                  // This prevents any native gestures, allowing our handlers full control
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
