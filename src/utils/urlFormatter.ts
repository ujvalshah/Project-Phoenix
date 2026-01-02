/**
 * URL Formatting Utilities
 * 
 * Used for displaying URLs in a user-friendly way in card content
 */

/**
 * Extract domain name from a URL
 * @param url - Full URL string
 * @returns Domain name (e.g., "youtube.com", "linkedin.com")
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove 'www.' prefix if present
    return urlObj.hostname.replace(/^www\./i, '');
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
    return match ? match[1] : url;
  }
}

/**
 * Replace URLs in text with their domain names
 * @param text - Text that may contain URLs
 * @returns Text with URLs replaced by domain names
 */
export function replaceUrlsWithDomains(text: string): string {
  // Match URLs (http://, https://, or just www.)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  
  return text.replace(urlRegex, (url) => {
    // Ensure URL has protocol
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return extractDomain(urlWithProtocol);
  });
}

/**
 * Check if a string is primarily a URL
 * @param text - Text to check
 * @returns True if text is mostly/entirely a URL
 */
export function isPrimarilyUrl(text: string): boolean {
  const trimmed = text.trim();
  // If text is mostly a URL pattern, consider it a URL
  return /^https?:\/\/[^\s]+$/i.test(trimmed) || 
         /^www\.[^\s]+$/i.test(trimmed) ||
         (trimmed.length > 20 && /https?:\/\//i.test(trimmed) && trimmed.split(/\s+/).length <= 2);
}












