/**
 * ============================================================================
 * IMAGE LAYER: CLS-Safe Image Component with Blur-Up & Fallback
 * ============================================================================
 * 
 * RESPONSIBILITIES:
 * - Fixed 4:3 aspect ratio wrapper (reserves space before load)
 * - Skeleton placeholder (matches exact dimensions)
 * - Blur-up thumbnail from Cloudinary
 * - Full-res fade-in handoff
 * - object-fit: cover + centered framing
 * - Media placeholder on failure (never collapses)
 * - Sentry error logging
 * 
 * CLS PREVENTION:
 * - Container always maintains aspect ratio
 * - Skeleton uses identical dimensions
 * - Natural image height never controls layout
 * 
 * ============================================================================
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ImageOff, RefreshCw } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { captureException } from '@/utils/sentry';

export interface ImageLayerProps {
  /** Source URL for the full-resolution image */
  src: string | null | undefined;
  /** Blur placeholder URL (low-res thumbnail from Cloudinary) */
  blurPlaceholder?: string | null;
  /** Alt text for accessibility */
  alt?: string;
  /** CSS class names */
  className?: string;
  /** Aspect ratio (default: 4/3) */
  aspectRatio?: number;
  /** Priority loading hint (for first 2 feed images) */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Whether image is in viewport for lazy loading */
  isInViewport?: boolean;
  /** Optional domain text for media placeholder */
  sourceDomain?: string;
  /** Optional retry callback */
  onRetry?: () => void;
}

/**
 * Generate Cloudinary transformation URL for blur placeholder
 * 
 * @param imageUrl - Original image URL (Cloudinary or external)
 * @returns Blur placeholder URL with Cloudinary transformations
 */
function getCloudinaryBlurUrl(imageUrl: string): string {
  try {
    // Check if URL is already a Cloudinary URL
    const url = new URL(imageUrl);
    if (url.hostname.includes('cloudinary.com') || url.hostname.includes('res.cloudinary.com')) {
      // Extract public_id from Cloudinary URL
      const pathParts = url.pathname.split('/');
      const uploadIndex = pathParts.findIndex(part => part === 'upload');
      if (uploadIndex >= 0 && uploadIndex < pathParts.length - 1) {
        // Rebuild URL with blur transformation
        const transformation = 'w_300,h_225,c_fill,q_auto:low,blur_300,e_blur';
        const publicIdParts = pathParts.slice(uploadIndex + 2);
        const publicId = publicIdParts.join('/');
        return `https://res.cloudinary.com/${url.hostname.split('.')[0]}/image/upload/${transformation}/${publicId}`;
      }
    }
    
    // For non-Cloudinary URLs, use Cloudinary fetch transformation
    // This assumes Cloudinary is configured to fetch external URLs
    const encodedUrl = encodeURIComponent(imageUrl);
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';
    return `https://res.cloudinary.com/${cloudName}/image/fetch/w_300,h_225,c_fill,q_auto:low,blur_300,e_blur/${encodedUrl}`;
  } catch {
    // If URL parsing fails, return original URL
    return imageUrl;
  }
}

/**
 * Extract domain from URL for placeholder display
 */
function extractDomain(url: string | null | undefined): string {
  if (!url) return 'Source';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Source';
  }
}

/**
 * Media Placeholder Component
 * Shown when image fails to load - maintains container dimensions
 */
const MediaPlaceholder: React.FC<{
  sourceDomain?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ sourceDomain, onRetry, className }) => (
  <div
    className={twMerge(
      'absolute inset-0 flex flex-col items-center justify-center',
      'bg-slate-100 dark:bg-slate-800',
      'text-slate-400 dark:text-slate-500',
      className
    )}
    role="img"
    aria-label="Media placeholder"
  >
    <ImageOff size={32} className="mb-2" />
    {sourceDomain && (
      <p className="text-xs font-medium text-center px-4">{sourceDomain}</p>
    )}
    {onRetry && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        className={twMerge(
          'mt-3 px-3 py-1.5 text-xs font-medium',
          'bg-slate-200 dark:bg-slate-700',
          'hover:bg-slate-300 dark:hover:bg-slate-600',
          'rounded-lg transition-colors',
          'flex items-center gap-1.5'
        )}
        aria-label="Retry loading image"
      >
        <RefreshCw size={14} />
        Retry
      </button>
    )}
  </div>
);

/**
 * ImageLayer Component
 * 
 * Handles:
 * - Fixed aspect ratio container (prevents CLS)
 * - Skeleton loading state
 * - Blur-up transition
 * - Full-res image fade-in
 * - Error handling with placeholder
 */
export const ImageLayer: React.FC<ImageLayerProps> = ({
  src,
  blurPlaceholder,
  alt = 'Preview',
  className,
  aspectRatio = 4 / 3,
  fetchPriority = 'auto',
  isInViewport = true,
  sourceDomain,
  onRetry,
}) => {
  const [imageState, setImageState] = useState<
    'loading' | 'blur-loaded' | 'full-loaded' | 'error'
  >('loading');
  const [hasErrored, setHasErrored] = useState(false);
  
  // Generate blur placeholder URL if not provided
  const blurUrl = useMemo(() => {
    if (blurPlaceholder) return blurPlaceholder;
    if (src) return getCloudinaryBlurUrl(src);
    return null;
  }, [src, blurPlaceholder]);
  
  // Extract domain for placeholder
  const displayDomain = useMemo(() => {
    return sourceDomain || extractDomain(src);
  }, [sourceDomain, src]);
  
  // Calculate padding-bottom for aspect ratio (only if aspectRatio is provided)
  const aspectPadding = useMemo(() => {
    if (!aspectRatio) return undefined;
    return `${(1 / aspectRatio) * 100}%`;
  }, [aspectRatio]);
  
  // Container style - apply aspect ratio padding only if specified
  const containerStyle = useMemo(() => {
    if (!aspectRatio || !aspectPadding) return {}; // Natural aspect ratio
    return { paddingBottom: aspectPadding };
  }, [aspectRatio, aspectPadding]);
  
  // Handle blur placeholder load
  const handleBlurLoad = useCallback(() => {
    setImageState('blur-loaded');
  }, []);
  
  // Handle full-res image load
  const handleFullLoad = useCallback(() => {
    setImageState('full-loaded');
  }, []);
  
  // Handle image error
  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      e.preventDefault();
      setHasErrored(true);
      setImageState('error');
      
      // Log to Sentry
      captureException(new Error('ImageLayer: Image failed to load'), {
        extra: {
          imageUrl: src,
          blurUrl,
          aspectRatio,
        },
      });
    },
    [src, blurUrl, aspectRatio]
  );
  
  // Retry handler
  const handleRetry = useCallback(() => {
    setHasErrored(false);
    setImageState('loading');
  }, []);
  
  // Don't render if no source
  if (!src) {
    return (
      <div
        className={twMerge('relative w-full overflow-hidden', className)}
        style={containerStyle}
      >
        <MediaPlaceholder
          sourceDomain={displayDomain}
          className="rounded-lg"
        />
      </div>
    );
  }
  
  const shouldLoad = isInViewport || fetchPriority === 'high';
  const isLoading = imageState === 'loading';
  const showBlur = imageState === 'blur-loaded' && !hasErrored;
  const showFull = imageState === 'full-loaded' && !hasErrored;
  const showError = hasErrored || imageState === 'error';
  
  return (
    <div
      className={twMerge(
        'relative w-full overflow-hidden',
        'bg-slate-100 dark:bg-slate-800',
        className
      )}
      style={containerStyle}
    >
      {/* Skeleton Placeholder - Exact same dimensions as container */}
      {isLoading && (
        <div
          className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-700"
          aria-hidden="true"
        />
      )}
      
      {/* Blur Placeholder Image - Low-res blurred version */}
      {blurUrl && !showError && shouldLoad && (
        <img
          src={blurUrl}
          alt=""
          className={twMerge(
            'absolute inset-0 w-full h-full',
            'object-cover object-center',
            'transition-opacity duration-300',
            showBlur && !showFull ? 'opacity-100' : 'opacity-0',
            showFull ? 'hidden' : ''
          )}
          aria-hidden="true"
          loading="eager"
          decoding="async"
          onLoad={handleBlurLoad}
          onError={handleError}
        />
      )}
      
      {/* Full-Resolution Image - High-res with fade-in */}
      {!showError && shouldLoad && (
        <img
          src={src}
          alt={alt}
          className={twMerge(
            aspectRatio ? 'absolute inset-0 w-full h-full' : 'w-full h-auto',
            'object-cover object-center',
            'transition-opacity duration-500',
            showFull ? 'opacity-100' : 'opacity-0'
          )}
          loading={isInViewport ? 'lazy' : 'lazy'}
          decoding="async"
          fetchPriority={fetchPriority}
          width={aspectRatio ? 800 : undefined}
          height={aspectRatio ? 600 : undefined}
          onLoad={handleFullLoad}
          onError={handleError}
        />
      )}
      
      {/* Error Placeholder - Maintains dimensions */}
      {showError && (
        <MediaPlaceholder
          sourceDomain={displayDomain}
          onRetry={onRetry || handleRetry}
          className="rounded-lg"
        />
      )}
    </div>
  );
};

