/**
 * ============================================================================
 * DETAIL VIEW BOTTOM SHEET: Full Infographic View with Zoom + Pan
 * ============================================================================
 * 
 * FEATURES:
 * - Bottom sheet modal (mobile-first)
 * - Blurred thumbnail immediate render (shared element illusion)
 * - Async high-res image fetch + fade-in
 * - Zoom + pan support for tall infographics
 * - Sticky DetailHeader (Close button)
 * - Sticky ActionDock (safe-area insets)
 * - Focus trap + ESC to close
 * - ARIA labels for accessibility
 * 
 * BEHAVIOR:
 * - Preview image = cropped fixed-ratio thumbnail
 * - Full-size image lives ONLY in Detail View
 * - Zero layout shift during transition
 * - Long infographics scroll inside Detail View
 * 
 * ============================================================================
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Article } from '@/types';
import { ImageLayer } from './ImageLayer';
import { DetailHeader } from './DetailHeader';
import { ActionDock } from './ActionDock';
import { twMerge } from 'tailwind-merge';
import { getThumbnailUrl } from '@/utils/mediaClassifier';

export interface DetailViewBottomSheetProps {
  /** Article to display */
  article: Article | null;
  /** Whether bottom sheet is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Optional action handlers */
  onLike?: (article: Article) => void;
  onBookmark?: (article: Article) => void;
  onShare?: (article: Article) => void;
  /** Optional thumbnail URL for blurred handoff */
  thumbnailUrl?: string;
}

/**
 * Extract source URL for ActionDock
 */
function getSourceUrl(article: Article | null): string | undefined {
  if (!article) return undefined;
  
  if (article.primaryMedia?.url) return article.primaryMedia.url;
  if (article.media?.url) return article.media.url;
  if (article.primaryMedia?.previewMetadata?.url) return article.primaryMedia.previewMetadata.url;
  if (article.media?.previewMetadata?.url) return article.media.previewMetadata.url;
  
  return undefined;
}

/**
 * Get full-resolution image URL
 */
function getFullImageUrl(article: Article | null): string | null {
  if (!article) return null;
  
  // For images, use the original URL
  if (article.primaryMedia?.type === 'image' && article.primaryMedia.url) {
    return article.primaryMedia.url;
  }
  
  if (article.media?.type === 'image' && article.media.url) {
    return article.media.url;
  }
  
  // For YouTube, use thumbnail as full image
  if (article.primaryMedia?.thumbnail) {
    return article.primaryMedia.thumbnail;
  }
  
  if (article.media?.thumbnail_url) {
    return article.media.thumbnail_url;
  }
  
  // Fallback to preview metadata image
  if (article.primaryMedia?.previewMetadata?.imageUrl) {
    return article.primaryMedia.previewMetadata.imageUrl;
  }
  
  if (article.media?.previewMetadata?.imageUrl) {
    return article.media.previewMetadata.imageUrl;
  }
  
  return getThumbnailUrl(article);
}

/**
 * DetailViewBottomSheet Component
 */
export const DetailViewBottomSheet: React.FC<DetailViewBottomSheetProps> = ({
  article,
  isOpen,
  onClose,
  onLike,
  onBookmark,
  onShare,
  thumbnailUrl,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPan, setInitialPan] = useState({ x: 0, y: 0 });
  
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);
  
  // Get image URLs
  const fullImageUrl = getFullImageUrl(article);
  const blurThumbnail = thumbnailUrl || getThumbnailUrl(article);
  
  // Reset zoom/pan when article changes
  useEffect(() => {
    if (article) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setImageLoaded(false);
    }
  }, [article?.id]);
  
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    
    const focusableElements = document.querySelectorAll<HTMLElement>(
      '[role="dialog"] button, [role="dialog"] [href], [role="dialog"] input, [role="dialog"] select, [role="dialog"] textarea, [role="dialog"] [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    firstElement.focus();
    
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen]);
  
  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 4));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPan({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);
  
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);
  
  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPan(pan);
  }, [zoom, pan]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPan({
      x: initialPan.x + deltaX,
      y: initialPan.y + deltaY,
    });
  }, [isDragging, zoom, dragStart, initialPan]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Touch handlers for pinch zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchDistanceRef.current = distance;
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setInitialPan(pan);
    }
  }, [zoom, pan]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const scale = distance / lastTouchDistanceRef.current;
      setZoom((prev) => Math.max(1, Math.min(prev * scale, 4)));
      lastTouchDistanceRef.current = distance;
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      e.preventDefault();
      const deltaX = e.touches[0].clientX - dragStart.x;
      const deltaY = e.touches[0].clientY - dragStart.y;
      
      setPan({
        x: initialPan.x + deltaX,
        y: initialPan.y + deltaY,
      });
    }
  }, [isDragging, zoom, dragStart, initialPan]);
  
  const handleTouchEnd = useCallback(() => {
    lastTouchDistanceRef.current = null;
    setIsDragging(false);
  }, []);
  
  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => {
      const newZoom = Math.max(1, Math.min(prev + delta, 4));
      if (newZoom === 1) {
        setPan({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);
  
  if (!isOpen || !article) return null;
  
  const sourceUrl = getSourceUrl(article);
  
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-view-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Bottom Sheet Container */}
      <div
        className={twMerge(
          'relative flex flex-col',
          'w-full h-full',
          'bg-white dark:bg-slate-950',
          'animate-in slide-in-from-bottom duration-300 ease-out',
          'safe-area-inset-bottom'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <DetailHeader
          title={article.title || 'Untitled'}
          onClose={onClose}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleReset}
        />
        
        {/* Image Container - Scrollable with Zoom + Pan */}
        <div
          ref={imageContainerRef}
          className={twMerge(
            'flex-1 overflow-auto',
            'relative',
            'touch-none' // Prevent default touch behaviors
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <div
            className={twMerge(
              'flex items-center justify-center',
              'min-h-full w-full p-4',
              'transition-transform duration-200 ease-out'
            )}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Image Layer with Blur-Up */}
            <div className="relative w-full max-w-4xl">
              <ImageLayer
                src={fullImageUrl}
                blurPlaceholder={blurThumbnail}
                alt={article.title || 'Infographic'}
                aspectRatio={undefined} // Natural aspect ratio in detail view
                fetchPriority="high"
                isInViewport={true}
                onRetry={() => {
                  setImageLoaded(false);
                }}
              />
              {/* Image loaded state is managed by ImageLayer internally */}
              
              {/* Full-resolution indicator - shown when image is loaded */}
              {fullImageUrl && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-white text-xs font-medium">
                  Full Resolution
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Sticky Action Dock */}
        {article && (
          <ActionDock
            article={article}
            sourceUrl={sourceUrl}
            onLike={onLike ? () => onLike(article) : undefined}
            onBookmark={onBookmark ? () => onBookmark(article) : undefined}
            onShare={onShare ? () => onShare(article) : undefined}
          />
        )}
      </div>
    </div>,
    document.body
  );
};

