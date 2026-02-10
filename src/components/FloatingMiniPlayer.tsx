/**
 * ============================================================================
 * FLOATING MINI PLAYER: Persistent Video Player While Scrolling
 * ============================================================================
 * 
 * PURPOSE:
 * - Shows YouTube video in a small floating window when card scrolls out of view
 * - Allows users to continue watching while scrolling
 * - Provides controls: pause/play, close, expand to full modal
 * 
 * UX:
 * - Fixed position (bottom-right on desktop, bottom-center on mobile)
 * - Smooth enter/exit animations
 * - Mobile swipe-to-dismiss gesture
 * - Safe area aware (avoids notch/home indicator)
 * 
 * PERFORMANCE:
 * - Only renders when showMiniPlayer is true
 * - Single iframe policy (original card iframe paused when mini player appears)
 * 
 * ============================================================================
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Play, Pause } from 'lucide-react';
import { useVideoPlayer } from '@/context/VideoPlayerContext';
import { extractYouTubeVideoId } from '@/utils/youtubeUtils';

interface FloatingMiniPlayerProps {
  onExpand?: () => void; // Callback when expand button is clicked (optional)
}

export const FloatingMiniPlayer: React.FC<FloatingMiniPlayerProps> = ({ onExpand }) => {
  const { state, showMiniPlayer, setShowMiniPlayer, pauseVideo, resumeVideo, closeMiniPlayer, scrollToCard } = useVideoPlayer();
  const [isPlaying, setIsPlaying] = useState(true);
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const videoId = state.videoId ? extractYouTubeVideoId(state.videoUrl || '') : null;

  // Handle play/pause toggle
  const handleTogglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseVideo();
      setIsPlaying(false);
    } else {
      resumeVideo();
      setIsPlaying(true);
    }
  }, [isPlaying, pauseVideo, resumeVideo]);

  // Handle close
  const handleClose = useCallback(() => {
    closeMiniPlayer();
    setIsPlaying(false);
    setSwipeOffset({ x: 0, y: 0 });
  }, [closeMiniPlayer]);

  // Handle expand (opens full modal or scrolls to card)
  const handleExpand = useCallback(() => {
    if (onExpand) {
      onExpand();
    } else {
      // Default: scroll back to card
      scrollToCard();
    }
    setShowMiniPlayer(false);
  }, [onExpand, scrollToCard, setShowMiniPlayer]);

  // Handle click on mini player (scrolls back to card)
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't scroll if clicking controls
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) {
      return;
    }
    scrollToCard();
  }, [scrollToCard]);

  // Mobile swipe-to-dismiss gesture
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setSwipeStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeStart) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    
    // Only allow downward swipe
    if (deltaY > 0) {
      setSwipeOffset({ x: deltaX, y: deltaY });
    }
  }, [swipeStart]);

  const handleTouchEnd = useCallback(() => {
    if (!swipeStart) return;
    
    const threshold = 100; // Minimum swipe distance to dismiss
    
    if (swipeOffset.y > threshold) {
      // Dismiss mini player
      handleClose();
    } else {
      // Reset position
      setSwipeOffset({ x: 0, y: 0 });
    }
    
    setSwipeStart(null);
  }, [swipeStart, swipeOffset, handleClose]);

  // Handle ESC key to close
  useEffect(() => {
    if (!showMiniPlayer) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMiniPlayer, handleClose]);

  // Sync playing state with context
  useEffect(() => {
    setIsPlaying(state.isPlaying);
  }, [state.isPlaying]);

  if (!showMiniPlayer || !videoId || !state.videoUrl) return null;

  // Build YouTube embed URL
  const embedParams = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    autoplay: isPlaying ? '1' : '0',
  });
  
  if (state.startTime > 0) {
    embedParams.set('start', Math.floor(state.startTime).toString());
  }
  
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?${embedParams.toString()}`;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[9999] transition-all duration-300 ease-out"
      style={{
        // Desktop: bottom-right, Mobile: bottom-center
        bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        right: 'clamp(16px, 4vw, 24px)',
        left: 'auto',
        width: 'clamp(280px, 30vw, 400px)',
        maxWidth: 'calc(100vw - 32px)',
        transform: `translate(${swipeOffset.x}px, ${swipeOffset.y}px)`,
        opacity: swipeOffset.y > 0 ? Math.max(0, 1 - swipeOffset.y / 200) : 1,
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-label="Mini video player"
    >
      <div
        className="relative bg-black rounded-xl overflow-hidden shadow-2xl"
        style={{
          aspectRatio: '16/9',
        }}
      >
        {/* Video Iframe */}
        <div className="absolute inset-0">
          <iframe
            ref={iframeRef}
            key={`mini-${videoId}-${state.startTime}`}
            src={embedUrl}
            className="w-full h-full"
            title={state.videoTitle || 'YouTube video player'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>

        {/* Controls Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none">
          {/* Top Controls Bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-2 pointer-events-auto">
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              aria-label="Close mini player"
            >
              <X size={16} className="sm:w-4 sm:h-4" />
            </button>

            {/* Expand Button */}
            <button
              onClick={handleExpand}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              aria-label="Expand to full screen"
            >
              <Maximize2 size={16} className="sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Center Play/Pause Button */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
            <button
              onClick={handleTogglePlayPause}
              className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? (
                <Pause size={24} className="sm:w-6 sm:h-6" />
              ) : (
                <Play size={24} className="sm:w-6 sm:h-6 ml-0.5" />
              )}
            </button>
          </div>

          {/* Bottom Title Overlay */}
          {state.videoTitle && (
            <div className="absolute bottom-0 left-0 right-0 p-2 pointer-events-none">
              <div className="bg-gradient-to-t from-black/80 via-black/60 to-transparent rounded-b-xl p-2">
                <p className="text-white text-xs sm:text-sm font-medium truncate">
                  {state.videoTitle}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
