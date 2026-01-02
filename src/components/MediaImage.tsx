import React, { useState, useEffect } from 'react';
import { Image } from './Image';

export interface MediaImageProps {
  mediaId: string;
  alt?: string;
  className?: string;
  fallbackSrc?: string;
  lazy?: boolean;
  aspectRatio?: string;
  onError?: () => void;
  onLoad?: () => void;
}

interface MediaMetadata {
  secureUrl: string;
  width?: number;
  height?: number;
  publicId?: string;
}

/**
 * MediaImage component
 * 
 * Renders images from Cloudinary via MongoDB Media records.
 * Fetches media metadata if needed and renders using secureUrl.
 * 
 * CRITICAL: Never hardcode Cloudinary URLs in JSX.
 * All images must be referenced by mediaId.
 */
export const MediaImage: React.FC<MediaImageProps> = ({
  mediaId,
  alt = 'Image',
  className = '',
  fallbackSrc,
  lazy = true,
  aspectRatio,
  onError,
  onLoad,
}) => {
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Fetch media metadata from backend
    const fetchMedia = async () => {
      try {
        const response = await fetch(`/api/media/${mediaId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch media');
        }
        const data = await response.json();
        setMetadata({
          secureUrl: data.secureUrl,
          width: data.width,
          height: data.height,
          publicId: data.publicId,
        });
      } catch (err) {
        console.error('[MediaImage] Failed to fetch media:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [mediaId]);

  if (loading) {
    return (
      <div className={`bg-slate-200 dark:bg-slate-800 animate-pulse ${className}`} style={{ aspectRatio }} />
    );
  }

  if (error || !metadata) {
    if (fallbackSrc) {
      return (
        <Image
          src={fallbackSrc}
          alt={alt}
          className={className}
          onError={onError}
          onLoad={onLoad}
        />
      );
    }
    return (
      <div className={`bg-slate-200 dark:bg-slate-800 flex items-center justify-center ${className}`} style={{ aspectRatio }}>
        <span className="text-xs text-slate-500">Failed to load image</span>
      </div>
    );
  }

  return (
    <Image
      src={metadata.secureUrl}
      alt={alt}
      className={className}
      loading={lazy ? 'lazy' : 'eager'}
      onError={() => {
        setError(true);
        if (onError) onError();
      }}
      onLoad={onLoad}
      style={aspectRatio ? { aspectRatio } : undefined}
    />
  );
};





