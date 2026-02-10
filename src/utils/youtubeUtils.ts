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

/**
 * Extract timestamp from YouTube URL
 * Supports formats:
 * - t=36 (36 seconds)
 * - t=1m30s (1 minute 30 seconds = 90 seconds)
 * - t=36s (36 seconds)
 * - t=1h2m30s (1 hour 2 minutes 30 seconds)
 * 
 * @returns Timestamp in seconds, or null if not found/invalid
 */
export function extractYouTubeTimestamp(url: string): number | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    
    // Check for 't' parameter (most common)
    const tParam = urlObj.searchParams.get('t');
    if (tParam) {
      return parseTimestamp(tParam);
    }
    
    // Check for 'time_continue' parameter (alternative format)
    const timeContinue = urlObj.searchParams.get('time_continue');
    if (timeContinue) {
      const parsed = parseInt(timeContinue, 10);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  } catch {
    // If URL parsing fails, try regex fallback
    const tMatch = url.match(/[?&]t=([^&]+)/);
    if (tMatch) {
      return parseTimestamp(tMatch[1]);
    }
    
    return null;
  }
}

/**
 * Parse timestamp string to seconds
 * Supports: "36", "1m30s", "36s", "1h2m30s"
 */
function parseTimestamp(timestamp: string): number | null {
  if (!timestamp) return null;
  
  // If it's just a number, treat as seconds
  const numericOnly = /^\d+$/.test(timestamp);
  if (numericOnly) {
    return parseInt(timestamp, 10);
  }
  
  // Parse complex formats like "1m30s" or "1h2m30s"
  let totalSeconds = 0;
  
  // Match hours: "1h" or "1h2m30s"
  const hoursMatch = timestamp.match(/(\d+)h/);
  if (hoursMatch) {
    totalSeconds += parseInt(hoursMatch[1], 10) * 3600;
  }
  
  // Match minutes: "2m" or "1h2m30s"
  const minutesMatch = timestamp.match(/(\d+)m/);
  if (minutesMatch) {
    totalSeconds += parseInt(minutesMatch[1], 10) * 60;
  }
  
  // Match seconds: "30s" or "1h2m30s" or just "30" at the end
  const secondsMatch = timestamp.match(/(\d+)s?$/);
  if (secondsMatch) {
    totalSeconds += parseInt(secondsMatch[1], 10);
  }
  
  return totalSeconds > 0 ? totalSeconds : null;
}

/**
 * Check if a URL is a YouTube timestamp link (has timestamp parameter)
 */
export function isYouTubeTimestampLink(url: string | null | undefined): boolean {
  if (!url) return false;
  return isYouTubeUrl(url) && extractYouTubeTimestamp(url) !== null;
}

/**
 * Extract both video ID and timestamp from YouTube URL
 */
export function extractYouTubeVideoIdAndTimestamp(url: string): {
  videoId: string | null;
  timestamp: number | null;
} {
  return {
    videoId: extractYouTubeVideoId(url),
    timestamp: extractYouTubeTimestamp(url),
  };
}

