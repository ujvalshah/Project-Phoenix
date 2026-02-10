/**
 * ============================================================================
 * USE VIDEO SCROLL DETECTION: IntersectionObserver Hook
 * ============================================================================
 * 
 * PURPOSE:
 * - Detects when expanded video card scrolls out of viewport
 * - Triggers mini player when card becomes invisible
 * - Uses IntersectionObserver for performance (no scroll event overhead)
 * 
 * PERFORMANCE:
 * - Native IntersectionObserver API (browser-optimized)
 * - Threshold: 0.1 (triggers when 10% visible)
 * - Root margin: -50px (triggers slightly before fully out of view)
 * 
 * ============================================================================
 */

import { useEffect, useRef, useState } from 'react';
import { useVideoPlayer } from '@/context/VideoPlayerContext';

interface UseVideoScrollDetectionOptions {
  cardElementId: string | null;
  enabled: boolean; // Only detect when video is expanded
}

export const useVideoScrollDetection = ({ cardElementId, enabled }: UseVideoScrollDetectionOptions) => {
  const { setShowMiniPlayer, state } = useVideoPlayer();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Don't observe if not enabled or no card element ID
    if (!enabled || !cardElementId || !state.videoUrl) {
      return;
    }

    const element = document.getElementById(cardElementId);
    if (!element) {
      console.warn('[useVideoScrollDetection] Card element not found:', cardElementId);
      return;
    }

    // Create IntersectionObserver
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isCurrentlyVisible = entry.isIntersecting;
        
        setIsVisible(isCurrentlyVisible);

        // Show mini player when card scrolls out of view
        // Hide mini player when card scrolls back into view
        if (!isCurrentlyVisible && state.isPlaying) {
          setShowMiniPlayer(true);
        } else if (isCurrentlyVisible) {
          setShowMiniPlayer(false);
        }
      },
      {
        threshold: 0.1, // Trigger when 10% visible
        rootMargin: '-50px', // Trigger slightly before fully out of view
      }
    );

    // Start observing
    observerRef.current.observe(element);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [cardElementId, enabled, state.videoUrl, state.isPlaying, setShowMiniPlayer]);

  return { isVisible };
};
