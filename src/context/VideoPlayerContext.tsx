/**
 * ============================================================================
 * VIDEO PLAYER CONTEXT: Global Video State Management
 * ============================================================================
 *
 * PURPOSE:
 * - Single source of truth for active video playback
 * - Enforces single-video policy (only one video plays at a time)
 * - Manages floating mini player state
 * - Coordinates between card video and mini player
 *
 * CONSUMER GUIDANCE:
 * - Components that only dispatch (cards, article views): `useVideoPlayerActions()`.
 *   Actions identity is stable, so these consumers do NOT re-render on play/close.
 * - The player itself (and anything that reads current playback): `useVideoPlayerState()`.
 *
 * ============================================================================
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { extractYouTubeVideoId } from '@/utils/youtubeUtils';

interface VideoPlayerState {
  isPlaying: boolean;
  videoUrl: string | null;
  videoId: string | null;
  videoTitle: string | null;
  startTime: number;
  cardElementId: string | null; // For scrolling back to card
  articleId: string | null; // Article ID for reference
}

interface PlayVideoParams {
  videoUrl: string;
  videoTitle?: string;
  startTime?: number;
  cardElementId: string;
  articleId: string;
}

interface VideoPlayerActions {
  playVideo: (params: PlayVideoParams) => void;
  pauseVideo: () => void;
  resumeVideo: () => void;
  closeMiniPlayer: () => void;
  scrollToCard: () => void;
}

const VideoPlayerStateContext = createContext<VideoPlayerState | undefined>(undefined);
const VideoPlayerActionsContext = createContext<VideoPlayerActions | undefined>(undefined);

const initialVideoState: VideoPlayerState = {
  isPlaying: false,
  videoUrl: null,
  videoId: null,
  videoTitle: null,
  startTime: 0,
  cardElementId: null,
  articleId: null,
};

export const VideoPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<VideoPlayerState>(initialVideoState);
  // Refs let scrollToCard stay stable instead of depending on state.cardElementId.
  const cardElementIdRef = useRef<string | null>(null);

  const playVideo = useCallback((params: PlayVideoParams) => {
    const videoId = extractYouTubeVideoId(params.videoUrl);

    if (!videoId) {
      console.warn('[VideoPlayerContext] Invalid YouTube URL:', params.videoUrl);
      return;
    }

    cardElementIdRef.current = params.cardElementId;
    setState({
      isPlaying: true,
      videoUrl: params.videoUrl,
      videoId,
      videoTitle: params.videoTitle || null,
      startTime: params.startTime || 0,
      cardElementId: params.cardElementId,
      articleId: params.articleId,
    });
  }, []);

  const pauseVideo = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const resumeVideo = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const closeMiniPlayer = useCallback(() => {
    cardElementIdRef.current = null;
    setState(initialVideoState);
  }, []);

  const scrollToCard = useCallback(() => {
    const id = cardElementIdRef.current;
    if (!id) return;
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const actions = useMemo<VideoPlayerActions>(
    () => ({ playVideo, pauseVideo, resumeVideo, closeMiniPlayer, scrollToCard }),
    [playVideo, pauseVideo, resumeVideo, closeMiniPlayer, scrollToCard],
  );

  return (
    <VideoPlayerActionsContext.Provider value={actions}>
      <VideoPlayerStateContext.Provider value={state}>
        {children}
      </VideoPlayerStateContext.Provider>
    </VideoPlayerActionsContext.Provider>
  );
};

export const useVideoPlayerActions = (): VideoPlayerActions => {
  const ctx = useContext(VideoPlayerActionsContext);
  if (!ctx) {
    throw new Error('useVideoPlayerActions must be used within VideoPlayerProvider');
  }
  return ctx;
};

export const useVideoPlayerState = (): VideoPlayerState => {
  const ctx = useContext(VideoPlayerStateContext);
  if (!ctx) {
    throw new Error('useVideoPlayerState must be used within VideoPlayerProvider');
  }
  return ctx;
};

