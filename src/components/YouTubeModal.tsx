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
import { X, ExternalLink } from 'lucide-react';
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

  const handleOpenInYouTube = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(videoUrl, '_blank', 'noopener,noreferrer');
  }, [videoUrl]);

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
    >
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Close video"
      >
        <X size={20} />
      </button>

      {/* Video Container */}
      <div className="relative w-full h-full max-w-7xl max-h-[90vh] mx-4 flex flex-col">
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

        {/* Footer with title and actions */}
        {(videoTitle || videoUrl) && (
          <div className="mt-4 flex items-center justify-between gap-4">
            {videoTitle && (
              <h3 className="text-white text-lg font-medium truncate flex-1">
                {videoTitle}
              </h3>
            )}
            <button
              onClick={handleOpenInYouTube}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black shrink-0"
              aria-label="Open video in YouTube"
            >
              <ExternalLink size={16} />
              <span className="font-medium">Open in YouTube</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
