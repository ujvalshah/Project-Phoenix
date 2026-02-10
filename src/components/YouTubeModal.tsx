/**
 * ============================================================================
 * YOUTUBE MODAL: Lazy-Loaded Video Player
 * ============================================================================
 * 
 * PERFORMANCE:
 * - Component is lazy-loaded (React.lazy) - zero impact on initial bundle
 * - Iframe only loads when modal opens (on-demand)
 * - Memory freed when modal closes
 * 
 * UX:
 * - Fullscreen-capable player
 * - Mobile-optimized (playsinline for iOS)
 * - Auto-play disabled (respects user preferences)
 * - Easy-to-access close button
 * 
 * ============================================================================
 */

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { extractYouTubeVideoId } from '@/utils/youtubeUtils';

interface YouTubeModalProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent) => void;
  videoUrl: string;
  videoTitle?: string;
  startTime?: number; // Start time in seconds (for timestamp seeking)
}

export const YouTubeModal: React.FC<YouTubeModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  videoTitle,
  startTime = 0,
}) => {
  const videoId = extractYouTubeVideoId(videoUrl);

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

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleClose = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    onClose(e);
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    // Close if clicking backdrop (not the modal content)
    if (e.target === e.currentTarget) {
      handleClose(e);
    }
  }, [handleClose]);


  if (!isOpen || !videoId) return null;

  // Build YouTube embed URL with privacy-enhanced mode and optional start time
  const embedParams = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  
  // Add start time if provided (for timestamp seeking)
  if (startTime > 0) {
    embedParams.set('start', Math.floor(startTime).toString());
  }
  
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?${embedParams.toString()}`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={videoTitle || 'YouTube video player'}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Close Button - Moved to top-left to avoid YouTube controls overlay */}
      <button
        onClick={handleClose}
        className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[60] w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-black/80 hover:bg-black/90 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
        aria-label="Close video"
      >
        <X size={18} className="sm:w-5 sm:h-5" />
      </button>

      {/* Video Container */}
      <div className="relative w-full h-full max-w-7xl max-h-[90vh] mx-2 sm:mx-4 flex flex-col">
        {/* Video Player */}
        <div className="relative w-full flex-1 min-h-0 bg-black rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <iframe
              key={`${videoId}-${startTime}`} // Force reload when startTime changes
              src={embedUrl}
              className="w-full h-full"
              title={videoTitle || 'YouTube video player'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>

        {/* Footer with title (optional, only if needed for context) */}
        {videoTitle && (
          <div className="mt-2 sm:mt-4">
            <h3 className="text-white text-sm sm:text-lg font-medium truncate">
              {videoTitle}
            </h3>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
