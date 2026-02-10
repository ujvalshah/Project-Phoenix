/**
 * ============================================================================
 * PERSISTENT VIDEO PLAYER: Single Moving Iframe (Option 1)
 * ============================================================================
 *
 * One iframe instance; only its container position/size changes. Playback
 * continues when switching between "inline" (over card) and "mini" (corner).
 *
 * - Inline: container positioned over card media area (id video-card-{articleId}-media).
 * - Mini: container fixed bottom-right. Position updated on scroll/resize when inline.
 * - Single source of truth for rect state; CSS transition for smooth animation.
 *
 * ============================================================================
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2 } from 'lucide-react';
import { useVideoPlayer, getVideoCardMediaElementId } from '@/context/VideoPlayerContext';
import { extractYouTubeVideoId } from '@/utils/youtubeUtils';

const MINI_WIDTH = 280;
const MINI_HEIGHT = Math.round(MINI_WIDTH * (9 / 16));
const MINI_RIGHT = 16;
const MINI_BOTTOM = 16;

function getMiniRect(): { top: number; left: number; width: number; height: number } {
  if (typeof window === 'undefined') {
    return { top: 0, left: 0, width: MINI_WIDTH, height: MINI_HEIGHT };
  }
  const safeBottom = 16; // env(safe-area-inset-bottom) handled by CSS if needed
  const w = Math.min(MINI_WIDTH, window.innerWidth - 32);
  const h = Math.round(w * (9 / 16));
  return {
    width: w,
    height: h,
    top: window.innerHeight - safeBottom - h,
    left: window.innerWidth - MINI_RIGHT - w,
  };
}

export const PersistentVideoPlayer: React.FC<{
  onExpand?: () => void;
}> = ({ onExpand }) => {
  const {
    state,
    showMiniPlayer,
    setShowMiniPlayer,
    closeMiniPlayer,
    scrollToCard,
  } = useVideoPlayer();

  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const videoId = state.videoId ?? (state.videoUrl ? extractYouTubeVideoId(state.videoUrl) : null);
  const articleId = state.articleId;

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

  const updateCardRect = useCallback(() => {
    if (!articleId || showMiniPlayer) return;
    const el = document.getElementById(getVideoCardMediaElementId(articleId));
    if (!el) {
      setRect(getMiniRect());
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [articleId, showMiniPlayer]);

  useEffect(() => {
    if (!state.videoUrl || !articleId) {
      setRect(null);
      return;
    }
    if (showMiniPlayer) {
      setRect(getMiniRect());
      return;
    }
    // Run after paint so card placeholder (with id) is in DOM
    const raf = requestAnimationFrame(() => {
      updateCardRect();
    });
    const onScrollOrResize = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        updateCardRect();
        rafRef.current = null;
      });
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [state.videoUrl, articleId, showMiniPlayer, updateCardRect]);

  const handleClose = useCallback(() => {
    closeMiniPlayer();
    setSwipeOffset({ x: 0, y: 0 });
  }, [closeMiniPlayer]);

  const handleExpand = useCallback(() => {
    if (onExpand) onExpand();
    else scrollToCard();
    setShowMiniPlayer(false);
  }, [onExpand, scrollToCard, setShowMiniPlayer]);

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

  if (!state.videoUrl || !videoId || !embedUrl || rect == null) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    transition: 'top 0.25s ease-out, left 0.25s ease-out, width 0.25s ease-out, height 0.25s ease-out',
    transform: `translate(${swipeOffset.x}px, ${swipeOffset.y}px)`,
    opacity: swipeOffset.y > 0 ? Math.max(0, 1 - swipeOffset.y / 200) : 1,
  };

  return createPortal(
    <div
      className="overflow-hidden rounded-xl bg-black shadow-2xl"
      style={style}
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
          {showMiniPlayer && (
            <button
              type="button"
              onClick={handleExpand}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              aria-label="Expand"
            >
              <Maximize2 size={16} className="sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
        {state.videoTitle && showMiniPlayer && (
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
