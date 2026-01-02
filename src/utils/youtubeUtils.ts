/**
 * YouTube Utilities
 * 
 * Functions to extract YouTube channel information and thumbnails
 */

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  try {
    // Handle both youtube.com/watch?v= and youtu.be/
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  } catch {
    return null;
  }
}

/**
 * Extract YouTube channel ID or username from channel URL
 */
export function extractYouTubeChannelId(channelUrl: string): string | null {
  if (!channelUrl) return null;

  try {
    // Match channel ID format: /channel/UC...
    const channelIdMatch = channelUrl.match(/\/channel\/([a-zA-Z0-9_-]+)/);
    if (channelIdMatch) {
      return channelIdMatch[1];
    }

    // Match username format: /user/username or /c/username or /@username
    const usernameMatch = channelUrl.match(/\/(?:user|c|@)([a-zA-Z0-9_-]+)/);
    if (usernameMatch) {
      return usernameMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch YouTube channel thumbnail using oEmbed
 * 
 * Strategy:
 * 1. Fetch YouTube oEmbed to get channel info
 * 2. Extract channel ID from author_url
 * 3. Return null (will use YouTube favicon as fallback)
 * 
 * Note: Channel thumbnail fetching via CORS proxy is unreliable.
 * The SourceBadge component will fallback to YouTube favicon automatically.
 */
export async function fetchYouTubeChannelThumbnail(
  videoUrl: string
): Promise<string | null> {
  if (!videoUrl || (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be'))) {
    return null;
  }

  try {
    // Fetch oEmbed to get channel info (this works without CORS issues)
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const oEmbedResponse = await fetch(oEmbedUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!oEmbedResponse.ok) {
      return null;
    }

    const oEmbedData = await oEmbedResponse.json();
    
    // Note: We could extract channel ID here, but fetching channel thumbnail
    // requires either:
    // 1. YouTube Data API v3 (requires API key)
    // 2. CORS proxy (unreliable, causes errors)
    // 3. Backend endpoint (best solution, but not implemented yet)
    // 
    // For now, we return null and let SourceBadge use YouTube favicon as fallback.
    // This avoids CORS errors and provides a consistent experience.
    
    return null;
  } catch (error) {
    // Silently fail - SourceBadge will use YouTube favicon as fallback
    return null;
  }
}

/**
 * Check if URL is a YouTube video
 */
export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be');
}

