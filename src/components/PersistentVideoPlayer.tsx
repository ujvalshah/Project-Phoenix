/**
 * ============================================================================
 * PERSISTENT VIDEO PLAYER: Mini player in corner + fullscreen on expand
 * ============================================================================
 *
 * - Clicking a video thumbnail opens playback in this fixed corner player only.
 * - One iframe; expand button uses requestFullscreen() so playback continues.
 * - Close, swipe-to-dismiss, scroll-to-card, ESC supported.
 *
 * ============================================================================
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2 } from 'lucide-react';
import { useVideoPlayer } from '@/context/VideoPlayerContext';
import { extractYouTubeVideoId } from '@/utils/youtubeUtils';

const MINI_WIDTH = 280;
const MINI_RIGHT = 16;
const MINI_BOTTOM = 16;

export const PersistentVideoPlayer: React.FC<{ onExpand?: () => void }> = ({ onExpand }) => {
  const { state, closeMiniPlayer, scrollToCard } = useVideoPlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const videoId = state.videoId ?? (state.videoUrl ? extractYouTubeVideoId(state.videoUrl) : null);

  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      autoplay: '1',
    });
    if (state.startTime > 0) {
      params.set('start', String(Math.floor(state.startTime)));
    }
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  }, [videoId, state.startTime]);

  const handleClose = useCallback(() => {
    closeMiniPlayer();
    setSwipeOffset({ x: 0, y: 0 });
  }, [closeMiniPlayer]);

  const handleExpand = useCallback(() => {
    const el = containerRef.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen();
    } else if (onExpand) {
      onExpand();
    } else {
      scrollToCard();
    }
  }, [onExpand, scrollToCard]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) return;
      scrollToCard();
    },
    [scrollToCard]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const t = e.touches[0];
    const dy = t.clientY - swipeStartRef.current.y;
    if (dy > 0) setSwipeOffset((prev) => ({ ...prev, y: dy }));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeOffset.y > 100) handleClose();
    else setSwipeOffset({ x: 0, y: 0 });
    swipeStartRef.current = null;
  }, [swipeOffset.y, handleClose]);

  useEffect(() => {
    if (!state.videoUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.videoUrl, handleClose]);

  if (!state.videoUrl || !videoId || !embedUrl) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[9999] overflow-hidden rounded-xl bg-black shadow-2xl transition-transform duration-300 ease-out"
      style={{
        bottom: `calc(${MINI_BOTTOM}px + env(safe-area-inset-bottom, 0px))`,
        right: `calc(${MINI_RIGHT}px + env(safe-area-inset-right, 0px))`,
        left: 'auto',
        width: `min(${MINI_WIDTH}px, calc(100vw - 32px))`,
        aspectRatio: '16/9',
        transform: `translate(${swipeOffset.x}px, ${swipeOffset.y}px)`,
        opacity: swipeOffset.y > 0 ? Math.max(0, 1 - swipeOffset.y / 200) : 1,
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-label="Video player"
    >
      <div className="absolute inset-0">
        <iframe
          key={videoId}
          src={embedUrl}
          className="w-full h-full"
          title={state.videoTitle ?? 'YouTube video player'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none">
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
            aria-label="Close video"
          >
            <X size={16} className="sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            onClick={handleExpand}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
            aria-label="Expand to fullscreen"
          >
            <Maximize2 size={16} className="sm:w-4 sm:h-4" />
          </button>
        </div>
        {state.videoTitle && (
          <div className="absolute bottom-0 left-0 right-0 p-2 pointer-events-none">
            <div className="bg-gradient-to-t from-black/80 via-black/60 to-transparent rounded-b-xl p-2">
              <p className="text-white text-xs sm:text-sm font-medium truncate">{state.videoTitle}</p>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
