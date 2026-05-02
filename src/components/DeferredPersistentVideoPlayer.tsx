import React, { lazy, Suspense } from 'react';
import { useVideoPlayerState } from '@/context/VideoPlayerContext';

const PersistentVideoPlayer = lazy(() =>
  import('./PersistentVideoPlayer').then((m) => ({ default: m.PersistentVideoPlayer })),
);

/**
 * Mini player loads only once a URL is committed to context, keeping `PersistentVideoPlayer`
 * (portal + iframe shell) off the startup chunk until playback starts.
 */
export const DeferredPersistentVideoPlayer: React.FC = () => {
  const state = useVideoPlayerState();
  if (!state.videoUrl) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <PersistentVideoPlayer />
    </Suspense>
  );
};
