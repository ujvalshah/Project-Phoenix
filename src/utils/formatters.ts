export const formatDate = (isoString: string, includeTime: boolean = true): string => {
  if (!isoString) return '';
  
  try {
    const date = new Date(isoString);
    
    // Check for Invalid Date
    if (isNaN(date.getTime())) {
        return '';
    }
    
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2); // Get last 2 digits of year
    
    if (!includeTime) {
        return `${day} ${month} '${year}`;
    }

    const time = date.toLocaleString('en-US', { 
        hour: 'numeric', 
        minute: 'numeric', 
        hour12: true 
    });

    // Returns: "6:12 PM • 25 Nov '25"
    return `${time} • ${day} ${month} '${year}`;
  } catch (e) {
    console.error("Error formatting date:", isoString, e);
    return '';
  }
};

export const formatReadTime = (minutes: number): string => {
  if (minutes < 1) {
    return '1 min read';
  }
  if (minutes === 1) {
    return '1 min read';
  }
  return `${minutes} min read`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength).trim() + '...';
};

export const getInitials = (name: string): string => {
  if (!name) return '??';
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0][0].toUpperCase();
  // Use first letter of first word + first letter of last word
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

export const normalizeCategoryLabel = (input: string): string => {
  let cleaned = input.trim();
  if (!cleaned) return '';
  
  // Remove existing hash to re-add it cleanly
  cleaned = cleaned.replace(/^#/, '');
  
  // Preserve original casing for acronyms and all-caps words
  // Only apply title case to mixed-case or all-lowercase words
  cleaned = cleaned
    .split(' ')
    .map(word => {
      // If word is all uppercase (likely an acronym like "AI", "USA", "PE/VC")
      // or contains special characters that suggest it's an acronym, preserve it
      if (word === word.toUpperCase() && word.length > 1 && /^[A-Z0-9/&]+$/.test(word)) {
        return word; // Preserve acronyms like "AI", "USA", "PE/VC"
      }
      // If word is already mixed case or has special formatting, preserve it
      if (word !== word.toLowerCase() && word !== word.toUpperCase()) {
        return word; // Preserve mixed case like "iPhone", "McDonald's"
      }
      // Only apply title case to all-lowercase words
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
    
  return `#${cleaned}`;
};

/**
 * Converts a string to Sentence case (first letter uppercase, rest lowercase)
 * Handles edge cases like "AI" staying as "AI"
 */
export const toSentenceCase = (input: string): string => {
  if (!input) return '';
  // Split by spaces and capitalize first letter of each word
  return input
    .split(' ')
    .map((word, index) => {
      if (index === 0) {
        // First word: capitalize first letter, lowercase rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      } else {
        // Subsequent words: lowercase unless it's an acronym (all caps)
        if (word === word.toUpperCase() && word.length > 1) {
          return word; // Keep acronyms as-is
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
    })
    .join(' ');
};


