/**
 * Shared content classification rule (must match backend logic)
 *
 * An URL is considered an IMAGE if:
 * - It ends with .jpg / .jpeg / .png / .webp / .gif
 * - OR matches known CDN image hosts (images.ctfassets.net, thumbs.*, cdn.*)
 * - OR matches social media image CDNs (Twitter, LinkedIn, etc.)
 *
 * DO NOT fetch metadata for image URLs.
 */
export const isImageUrl = (url: string): boolean => {
  if (!url) return false;

  // Check for image file extensions (most common case)
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
    return true;
  }

  // Check for known CDN image hosts
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    // ═══════════════════════════════════════════════════════════════════════
    // SOCIAL MEDIA IMAGE CDNs (explicitly checked for safety)
    // ═══════════════════════════════════════════════════════════════════════

    // Twitter/X: pbs.twimg.com serves ONLY images (videos use video.twimg.com)
    // URLs: https://pbs.twimg.com/media/xxx?format=jpg&name=large
    if (hostname === 'pbs.twimg.com' && pathname.startsWith('/media/')) {
      return true;
    }

    // LinkedIn: media.licdn.com serves images
    // URLs: https://media.licdn.com/dms/image/xxx
    if (hostname.includes('media.licdn.com') && pathname.includes('/image/')) {
      return true;
    }

    // Reddit: i.redd.it and preview.redd.it serve images
    if (hostname === 'i.redd.it' || hostname === 'preview.redd.it') {
      return true;
    }

    // Imgur: i.imgur.com serves images
    if (hostname === 'i.imgur.com') {
      return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GENERIC CDN PATTERNS (with additional safety checks)
    // ═══════════════════════════════════════════════════════════════════════

    if (
      hostname.includes('images.ctfassets.net') ||
      hostname.includes('thumbs.') ||
      hostname.includes('cdn.') ||
      hostname.includes('img.') ||
      hostname.includes('image.')
    ) {
      // Additional check: ensure it's likely an image URL (not just a CDN serving HTML)
      // If it has query params like ?fm=webp or ?q=70, it's likely an image
      if (url.includes('fm=') || url.includes('q=') || url.includes('format=')) {
        return true;
      }
      // If pathname suggests image (no .html, .php, etc.)
      if (!pathname.endsWith('.html') && !pathname.endsWith('.php') && !pathname.endsWith('/')) {
        return true;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FALLBACK: Check for image format in query params
    // Only when combined with image-like pathname patterns
    // ═══════════════════════════════════════════════════════════════════════

    // Twitter-style ?format=jpg query params - only if pathname looks like media
    if (/[?&]format=(jpg|jpeg|png|gif|webp)/i.test(url)) {
      // Pathname should contain 'media', 'image', 'photo', or similar
      if (/\/(media|image|photo|pic|img)\//i.test(pathname)) {
        return true;
      }
    }

  } catch {
    // Invalid URL, fallback to extension check only
  }

  return false;
};

export const detectProviderFromUrl = (url: string): 'image' | 'video' | 'document' | 'link' | 'text' | 'youtube' => {
  if (!url) return 'link';
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  
  // Use shared image detection logic
  if (isImageUrl(url)) return 'image';
  
  // Check for video extensions
  if (/\.(mp4|webm|ogg)$/i.test(url)) return 'video';
  
  // Check for document extensions
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i.test(url)) return 'document';
  
  return 'link';
};

/**
 * Check if a URL should have metadata fetched
 * Only fetch metadata for video sites where it provides significant value:
 * - Video: YouTube (rich video metadata with thumbnails, titles, descriptions)
 * 
 * Skip metadata fetching for:
 * - Image URLs (DO NOT fetch metadata for images - they should render directly)
 * - News sites (often blocked by paywalls, generic metadata, users prefer custom titles)
 * - Regular blogs/articles (low value, high latency, users can add their own content)
 * - Generic links (minimal benefit, adds 2-5s delay)
 * - Social networks (no longer supported)
 * 
 * @param url - The URL to check
 * @returns true if metadata should be fetched, false otherwise
 */
export const shouldFetchMetadata = (url: string): boolean => {
  if (!url) return false;
  
  // CRITICAL: DO NOT fetch metadata for image URLs
  // Images should render directly without metadata fetching
  if (isImageUrl(url)) return false;
  
  const lowerUrl = url.toLowerCase();
  
  // Video platforms - rich metadata with thumbnails and descriptions
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return true;
  
  // All other URLs (news sites, blogs, generic links, social networks) - skip metadata fetching
  return false;
};

/**
 * Check if auto-title generation is allowed for a given content type or URL
 * 
 * AUTO-TITLE GENERATION IS STRICTLY LIMITED TO:
 * - Social Networks: X/Twitter, LinkedIn, Facebook, Threads, Reddit
 * - Video Platforms: YouTube, Vimeo, other video-hosting platforms
 * 
 * FORBIDDEN for:
 * - News websites
 * - Articles/Blogs
 * - Documentation
 * - PDFs
 * - Images
 * - Generic URLs
 * 
 * @param contentTypeOrUrl - Content type string ('social', 'video', 'article', etc.) or URL string
 * @returns true ONLY if content type is 'social' or 'video', false otherwise
 */
export const shouldAutoGenerateTitle = (contentTypeOrUrl: string): boolean => {
  if (!contentTypeOrUrl) return false;
  
  // If it's a content type string (from backend)
  if (contentTypeOrUrl === 'social' || contentTypeOrUrl === 'video') {
    return true;
  }
  
  // If it's a URL, check if it's a social or video platform
  const lowerUrl = contentTypeOrUrl.toLowerCase();
  
  // Social networks (limited support)
  if (lowerUrl.includes('facebook.com')) return true;
  if (lowerUrl.includes('threads.net')) return true;
  if (lowerUrl.includes('reddit.com')) return true;
  
  // Video platforms
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return true;
  if (lowerUrl.includes('vimeo.com')) return true;
  
  // All other content types/URLs - NO auto-title generation
  return false;
};

/**
 * Normalize API base URL to ensure it always includes /api suffix
 * 
 * Handles both development (relative /api) and production (full URL with /api) cases.
 * 
 * In development mode, always uses relative /api paths (Vite proxy handles routing).
 * In production mode, respects VITE_API_URL if set, otherwise uses relative /api.
 * 
 * @returns Normalized API base URL that always ends with /api
 * 
 * Examples (Development):
 * - Always returns '/api' (uses Vite proxy to localhost:5000)
 * 
 * Examples (Production):
 * - undefined → '/api' (relative path, same domain)
 * - 'https://api.example.com' → 'https://api.example.com/api'
 * - 'https://api.example.com/' → 'https://api.example.com/api'
 * - 'https://api.example.com/api' → 'https://api.example.com/api'
 * - '/api' → '/api'
 */
export function getNormalizedApiBase(): string {
  // In development, always use relative /api (Vite proxy handles it)
  if (import.meta.env.DEV) {
    return '/api';
  }
  
  // In production, respect VITE_API_URL if set
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If not set, use relative /api (same domain deployment)
  if (!envUrl) {
    return '/api';
  }
  
  const url = envUrl.trim();
  
  // If already ends with /api, return as-is
  if (url.endsWith('/api')) {
    return url;
  }
  
  // If ends with /, append 'api'
  if (url.endsWith('/')) {
    return `${url}api`;
  }
  
  // Otherwise, append '/api'
  return `${url}/api`;
}


