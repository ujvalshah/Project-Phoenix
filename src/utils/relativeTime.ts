/**
 * Relative Time Formatting Utilities
 * 
 * Formats dates in a user-friendly relative format (e.g., "2h ago", "Dec 15")
 */

/**
 * Format date as relative time (e.g., "2h ago", "3d ago") or short date ("Dec 15")
 * Falls back to short date format for older dates
 */
export function formatRelativeTime(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = new Date(isoString);
    
    // Check for Invalid Date
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    // Less than 1 minute ago
    if (diffSeconds < 60) {
      return 'Just now';
    }
    
    // Less than 1 hour ago
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    
    // Less than 24 hours ago
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    
    // Less than 7 days ago
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    
    // Less than 30 days ago - show as "X weeks ago"
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}w ago`;
    }
    
    // Older than 30 days - show short date format
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const currentYear = now.getFullYear();
    
    // If same year, don't show year
    if (year === currentYear) {
      return `${month} ${day}`;
    }
    
    // Show year for older dates
    return `${month} ${day}, ${year}`;
  } catch (e) {
    console.error("Error formatting relative time:", isoString, e);
    return '';
  }
}












