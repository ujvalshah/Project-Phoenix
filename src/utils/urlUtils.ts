/**
 * Shared content classification rule (must match backend logic)
 * 
 * An URL is considered an IMAGE if:
 * - It ends with .jpg / .jpeg / .png / .webp / .gif
 * - OR matches known CDN image hosts (images.ctfassets.net, thumbs.*, cdn.*)
 * 
 * DO NOT fetch metadata for image URLs.
 */
export const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  
  // Check for image file extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
    return true;
  }
  
  // Check for known CDN image hosts
  try {
    const hostname = new URL(url).hostname.toLowerCase();
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
      const pathname = new URL(url).pathname.toLowerCase();
      if (!pathname.endsWith('.html') && !pathname.endsWith('.php') && !pathname.endsWith('/')) {
        return true;
      }
    }
  } catch {
    // Invalid URL, fallback to extension check only
  }
  
  return false;
};

export const detectProviderFromUrl = (url: string): 'image' | 'video' | 'document' | 'link' | 'text' | 'youtube' | 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'rich' => {
  if (!url) return 'link';
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
  if (lowerUrl.includes('linkedin.com')) return 'linkedin';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  
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
 * Only fetch metadata for social networks and video sites where it provides significant value:
 * - Social: Twitter, LinkedIn, Instagram, TikTok (have rich oEmbed APIs)
 * - Video: YouTube (rich video metadata with thumbnails, titles, descriptions)
 * 
 * Skip metadata fetching for:
 * - Image URLs (DO NOT fetch metadata for images - they should render directly)
 * - News sites (often blocked by paywalls, generic metadata, users prefer custom titles)
 * - Regular blogs/articles (low value, high latency, users can add their own content)
 * - Generic links (minimal benefit, adds 2-5s delay)
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
  
  // Social networks - rich oEmbed APIs with valuable previews
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return true;
  if (lowerUrl.includes('linkedin.com')) return true;
  if (lowerUrl.includes('instagram.com')) return true;
  if (lowerUrl.includes('tiktok.com')) return true;
  
  // Video platforms - rich metadata with thumbnails and descriptions
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return true;
  
  // All other URLs (news sites, blogs, generic links) - skip metadata fetching
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
  
  // Social networks
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return true;
  if (lowerUrl.includes('linkedin.com')) return true;
  if (lowerUrl.includes('instagram.com')) return true;
  if (lowerUrl.includes('tiktok.com')) return true;
  if (lowerUrl.includes('facebook.com')) return true;
  if (lowerUrl.includes('threads.net')) return true;
  if (lowerUrl.includes('reddit.com')) return true;
  
  // Video platforms
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return true;
  if (lowerUrl.includes('vimeo.com')) return true;
  
  // All other content types/URLs - NO auto-title generation
  return false;
};


