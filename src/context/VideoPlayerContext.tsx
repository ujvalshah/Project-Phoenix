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
 * ============================================================================
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
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

interface VideoPlayerContextType {
  // State
  state: VideoPlayerState;
  
  // Actions
  playVideo: (params: {
    videoUrl: string;
    videoTitle?: string;
    startTime?: number;
    cardElementId: string;
    articleId: string;
  }) => void;
  pauseVideo: () => void;
  resumeVideo: () => void;
  closeMiniPlayer: () => void;
  scrollToCard: () => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextType | undefined>(undefined);

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

  // Play video (replaces any existing video)
  const playVideo = useCallback((params: {
    videoUrl: string;
    videoTitle?: string;
    startTime?: number;
    cardElementId: string;
    articleId: string;
  }) => {
    const videoId = extractYouTubeVideoId(params.videoUrl);
    
    if (!videoId) {
      console.warn('[VideoPlayerContext] Invalid YouTube URL:', params.videoUrl);
      return;
    }

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

  // Pause video
  const pauseVideo = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  // Resume video
  const resumeVideo = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  // Close player entirely (clears state so PersistentVideoPlayer unmounts)
  const closeMiniPlayer = useCallback(() => {
    setState(initialVideoState);
  }, []);

  // Scroll to original card (e.g. when user clicks on mini player)
  const scrollToCard = useCallback(() => {
    if (!state.cardElementId) return;
    const element = document.getElementById(state.cardElementId);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [state.cardElementId]);

  const value: VideoPlayerContextType = {
    state,
    playVideo,
    pauseVideo,
    resumeVideo,
    closeMiniPlayer,
    scrollToCard,
  };

  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  );
};

export const useVideoPlayer = (): VideoPlayerContextType => {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error('useVideoPlayer must be used within VideoPlayerProvider');
  }
  return context;
};
