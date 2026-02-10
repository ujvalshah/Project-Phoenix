/**
 * ============================================================================
 * PERSISTENT VIDEO PLAYER: Mini player (YouTube-style, responsive)
 * ============================================================================
 *
 * - Mobile/touch: Swipe down to dismiss; drag handle at top. No X (reduces clutter).
 * - Desktop/laptop: Larger player, close (X) button (no swipe). ESC closes.
 * - Fullscreen via YouTube’s native player control.
 *
 * ============================================================================
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useVideoPlayer } from '@/context/VideoPlayerContext';
import { extractYouTubeVideoId } from '@/utils/youtubeUtils';

const MINI_RIGHT = 16;
const MINI_BOTTOM = 16;

export const PersistentVideoPlayer: React.FC<{ onExpand?: () => void }> = () => {
  const { state, closeMiniPlayer } = useVideoPlayer();
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
    if (swipeOffset.y > 80) handleClose();
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
      className="fixed z-[9999] overflow-hidden rounded-xl bg-black shadow-2xl transition-[transform,opacity] duration-300 ease-out
        w-[min(280px,calc(100vw-32px))] md:w-[min(400px,min(38vw,560px))] aspect-video
        bottom-[calc(16px+env(safe-area-inset-bottom,0px))] right-[calc(16px+env(safe-area-inset-right,0px))] left-auto"
      style={{
        transform: `translate(0px, ${swipeOffset.y}px)`,
        opacity: swipeOffset.y > 0 ? Math.max(0, 1 - swipeOffset.y / 180) : 1,
      }}
      role="dialog"
      aria-label="Video player - swipe down or use close button to close"
    >
      {/* Close (X): shown only when hover is available (desktop/laptop); hidden on touch-only devices */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute top-2 right-2 z-20 hidden size-10 shrink-0 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white/50 [@media(hover:hover)]:flex"
        aria-label="Close video"
      >
        <X size={20} strokeWidth={2} />
      </button>
      {/* Drag handle: swipe down from here on touch devices (iframe captures touches on the video) */}
      <div
        className="absolute top-0 left-0 right-0 z-10 h-8 flex items-center justify-center touch-none select-none [@media(hover:hover)]:h-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <span className="w-10 h-1 rounded-full bg-white/40 [@media(hover:hover)]:bg-white/30" aria-hidden />
      </div>
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
      {state.videoTitle && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <p className="text-white text-xs sm:text-sm font-medium truncate">{state.videoTitle}</p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
