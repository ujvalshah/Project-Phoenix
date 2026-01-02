import React, { useState, useEffect } from 'react';
import { Globe, File } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { isYouTubeUrl, fetchYouTubeChannelThumbnail } from '@/utils/youtubeUtils';

/**
 * Helper function to safely extract domain from URL
 * Handles http, https, www, and edge cases
 * Validates domain format to prevent invalid favicon requests
 */
export function extractDomain(url: string | undefined | null): string | null {
  if (!url) return null;

  try {
    // Handle cases where URL might not have protocol
    let urlToParse = url.trim();
    
    // Skip if it looks like a malformed URL (e.g., "http://x", "//youtube")
    if (urlToParse.match(/^https?:\/\/[^.\s/]+$/i) || urlToParse.match(/^\/\/[^.\s/]+$/i)) {
      return null;
    }
    
    if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
      // Skip if it doesn't look like a domain (single word without dots)
      if (!urlToParse.includes('.') && !urlToParse.includes('/')) {
        return null;
      }
      urlToParse = `https://${urlToParse}`;
    }

    const urlObj = new URL(urlToParse);
    let hostname = urlObj.hostname;

    // Validate hostname format - must contain at least one dot (e.g., example.com)
    // Exception: localhost is valid
    if (!hostname.includes('.') && hostname !== 'localhost') {
      return null;
    }

    // Remove 'www.' prefix if present
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    // Additional validation: ensure it looks like a valid domain
    // Must have at least one dot and valid characters
    if (!hostname.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/)) {
      return null;
    }

    return hostname || null;
  } catch (error) {
    // If URL parsing fails, try simple string extraction
    try {
      let cleaned = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/^\/\//, '');
      const parts = cleaned.split('/');
      const potentialDomain = parts[0];
      
      // Validate extracted domain
      if (potentialDomain && potentialDomain.includes('.') && 
          potentialDomain.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/)) {
        return potentialDomain;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Formats domain name for display
 * Strips 'www.' and '.com' and converts to uppercase
 */
function formatDomainForDisplay(domain: string): string {
  if (!domain) return 'SOURCE';

  let formatted = domain
    .replace(/^www\./i, '')
    .replace(/\.com$/i, '')
    .replace(/\.org$/i, '')
    .replace(/\.net$/i, '')
    .replace(/\.edu$/i, '')
    .replace(/\.gov$/i, '');

  // Capitalize first letter of each word
  formatted = formatted
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

  // If it's a single word, uppercase it (e.g., "WIRED", "NYTIMES")
  if (!formatted.includes(' ')) {
    formatted = formatted.toUpperCase();
  }

  return formatted || 'SOURCE';
}

interface SourceBadgeProps {
  /** The actual link URL (e.g., "https://twitter.com/user/status/123") */
  url?: string | null;
  /** User-specified domain override (e.g., "nytimes.com") */
  customDomain?: string | null;
  /** Size variant: 'sm' for icon-only, 'md' for icon+text */
  size?: 'sm' | 'md';
  /** Visual variant: 'overlay' for glassmorphic overlay on images, 'inline' for solid inline badge */
  variant?: 'overlay' | 'inline';
  /** Additional CSS classes for positioning/styling */
  className?: string;
}

/**
 * SourceBadge Component
 * 
 * Displays source identity with favicon and optional domain name.
 * Features glassmorphism styling for high contrast overlays.
 * 
 * @example
 * ```tsx
 * <SourceBadge 
 *   url="https://www.nytimes.com/article" 
 *   size="md" 
 *   className="absolute top-2 left-2"
 * />
 * ```
 */
export const SourceBadge: React.FC<SourceBadgeProps> = ({
  url,
  customDomain,
  size = 'sm',
  variant = 'overlay',
  className,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [youtubeChannelThumbnail, setYoutubeChannelThumbnail] = useState<string | null>(null);

  // Determine domain with priority: customDomain > parsed URL > null
  const domain = customDomain 
    ? customDomain.replace(/^www\./i, '').trim()
    : extractDomain(url);

  // Determine if this is a file/document (no domain)
  const isFile = !domain && (url?.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip)$/i) || !url);

  // Check if this is a YouTube URL
  const isYouTube = url ? isYouTubeUrl(url) : false;

  // Fetch YouTube channel thumbnail when URL is detected
  useEffect(() => {
    if (isYouTube && url && !customDomain) {
      // Only fetch if it's YouTube and no custom domain override
      let cancelled = false;
      setIsImageLoading(true);
      
      fetchYouTubeChannelThumbnail(url)
        .then((thumbnail) => {
          if (!cancelled) {
            if (thumbnail) {
              setYoutubeChannelThumbnail(thumbnail);
            }
            setIsImageLoading(false);
          }
        })
        .catch((error) => {
          // Silently fail - will fallback to YouTube favicon
          if (!cancelled) {
            setIsImageLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    } else {
      setYoutubeChannelThumbnail(null);
      setIsImageLoading(false);
    }
  }, [isYouTube, url, customDomain]);

  // Build favicon URL using Google S2 API (fallback for non-YouTube or when channel thumbnail fails)
  // Only create favicon URL if domain is valid
  const faviconUrl = youtubeChannelThumbnail 
    ? youtubeChannelThumbnail
    : (domain && domain.includes('.') // Ensure domain has at least one dot
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
      : null);

  // Full URL for tooltip (use customDomain if provided, otherwise use original URL)
  const displayUrl = customDomain 
    ? `https://${customDomain}` 
    : url || 'File';

  // Format domain for display text
  const displayText = domain ? formatDomainForDisplay(domain) : 'FILE';

  // Determine which icon to show
  // For YouTube, show fallback only if channel thumbnail failed to load
  const showFallbackIcon = imageError || (!faviconUrl && !isImageLoading) || (isFile && !isYouTube);
  const IconComponent = isFile ? File : Globe;

  // Variant-specific styling
  const variantStyles = variant === 'overlay' 
    ? {
        // Overlay variant: Glassmorphic for image overlays
        background: 'bg-white/80 dark:bg-black/60',
        backdrop: 'backdrop-blur-md',
        border: 'border border-white/20',
        shadow: 'shadow-sm',
        textColor: 'text-gray-800 dark:text-gray-200',
      }
    : {
        // Inline variant: Solid for inline placement
        background: 'bg-white dark:bg-slate-900',
        backdrop: '',
        border: 'border border-gray-200 dark:border-slate-700',
        shadow: 'shadow-sm',
        textColor: 'text-gray-600 dark:text-gray-400',
      };

  return (
    <div
      className={twMerge(
        // Base container styles
        'inline-flex items-center gap-2',
        // Variant-specific styles
        variantStyles.background,
        variantStyles.backdrop,
        variantStyles.border,
        variantStyles.shadow,
        'rounded-full',
        'py-1 px-2',
        // Ensure it's visible over images (for overlay variant)
        variant === 'overlay' ? 'relative z-20' : 'relative z-10',
        className
      )}
      title={displayUrl}
    >
      {/* Favicon or Fallback Icon */}
      <div className="relative size-4 shrink-0">
        {showFallbackIcon ? (
          <IconComponent 
            className="size-4 text-gray-700 dark:text-gray-300" 
            aria-hidden="true"
          />
        ) : (
          <>
            {isImageLoading && (
              <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-sm animate-pulse" />
            )}
            <img
              src={faviconUrl || undefined}
              alt={isYouTube ? `${domain} channel` : `${domain} favicon`}
              className={twMerge(
                'size-4 rounded-sm object-contain',
                isImageLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'
              )}
              onLoad={() => {
                setIsImageLoading(false);
                setImageError(false);
              }}
              onError={(e) => {
                // Silently handle favicon loading errors
                setImageError(true);
                setIsImageLoading(false);
                // Clear YouTube thumbnail on error to fallback to favicon
                if (isYouTube) {
                  setYoutubeChannelThumbnail(null);
                }
                // Prevent console error by stopping error propagation
                e.preventDefault();
              }}
              loading="lazy"
              decoding="async"
            />
          </>
        )}
      </div>

      {/* Domain Text (only for 'md' size) */}
      {size === 'md' && (
        <span className={twMerge(
          'text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
          variantStyles.textColor
        )}>
          {displayText}
        </span>
      )}
    </div>
  );
};

