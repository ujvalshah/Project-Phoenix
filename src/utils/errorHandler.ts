/**
 * Unified Error Handling Utility
 * 
 * Provides consistent error handling across the application
 */

export interface AppError {
  message: string;
  code?: string;
  field?: string;
  originalError?: any;
}

/**
 * Format validation errors from backend (Zod or Mongoose)
 */
export function formatValidationError(error: any): AppError {
  // Handle Zod errors (array path)
  if (Array.isArray(error.path)) {
    return {
      message: error.message || 'Validation error',
      code: 'VALIDATION_ERROR',
      field: error.path.join('.'),
      originalError: error,
    };
  }
  
  // Handle Mongoose errors (string path)
  if (typeof error.path === 'string') {
    return {
      message: error.message || 'Validation error',
      code: 'VALIDATION_ERROR',
      field: error.path,
      originalError: error,
    };
  }
  
  // Handle generic errors
  return {
    message: error.message || 'An error occurred',
    code: error.code || 'UNKNOWN_ERROR',
    originalError: error,
  };
}

/**
 * Format API errors consistently
 */
export function formatApiError(error: any): AppError {
  // Handle validation errors from backend
  if (error?.errors && Array.isArray(error.errors)) {
    const firstError = error.errors[0];
    return formatValidationError(firstError);
  }
  
  // Handle error objects with message
  if (error?.message) {
    return {
      message: error.message,
      code: error.code || 'API_ERROR',
      originalError: error,
    };
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      code: 'UNKNOWN_ERROR',
    };
  }
  
  // Fallback
  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    originalError: error,
  };
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: AppError): string {
  const fieldMapping: Record<string, string> = {
    'title': 'Title',
    'content': 'Content',
    'categories': 'Tags',
    'category': 'Tags',
    'tags': 'Tags', // PHASE 4: Map 'tags' field to user-friendly name
    'authorId': 'Author',
    'authorName': 'Author',
    'author': 'Author',
    'media': 'Media/URL',
    'images': 'Images',
    'url': 'URL',
    'author.id': 'Author',
    'author.name': 'Author',
  };
  
  const fieldName = error.field ? fieldMapping[error.field] || error.field : '';
  
  // PHASE 4: Handle tag-specific error messages
  if (error.field === 'tags' && error.message.includes('tag')) {
    return 'Tags required to post the nugget';
  }
  
  if (error.message.includes('required')) {
    return fieldName ? `${fieldName} is required.` : 'A required field is missing.';
  }
  
  if (error.message.includes('too long') || error.message.includes('exceeds')) {
    return fieldName ? `${fieldName} is too long.` : 'The value is too long.';
  }
  
  if (error.message.includes('too short') || error.message.includes('minimum')) {
    return fieldName ? `${fieldName} is too short.` : 'The value is too short.';
  }
  
  if (error.message.includes('invalid') || error.message.includes('format')) {
    return fieldName ? `${fieldName} format is invalid.` : 'The format is invalid.';
  }
  
  return error.message || 'An error occurred. Please try again.';
}

/**
 * Type guard: Check if Article has required author data
 */
export function hasValidAuthor(article: any): article is { author: { id: string; name: string } } {
  return (
    article &&
    article.author &&
    typeof article.author.id === 'string' &&
    typeof article.author.name === 'string'
  );
}

/**
 * Type guard: Check if Article is valid
 */
export function isValidArticle(article: any): article is {
  id: string;
  title?: string;
  author: { id: string; name: string };
} {
  return (
    article &&
    typeof article.id === 'string' &&
    (article.title === undefined || typeof article.title === 'string') &&
    hasValidAuthor(article)
  );
}

/**
 * Sanitize article data - ensure all required fields exist
 */
export function sanitizeArticle(article: any): any {
  if (!article) {
    return null;
  }
  
  return {
    ...article,
    id: article.id || article._id?.toString() || '',
    title: article.title || undefined, // Preserve empty titles (no fallback)
    content: article.content || '',
    excerpt: article.excerpt || '',
    author: {
      id: article.author?.id || article.authorId || '',
      name: article.author?.name || article.authorName || 'Unknown',
      avatar_url: article.author?.avatar_url || article.author?.avatarUrl,
    },
    categories: Array.isArray(article.categories) ? article.categories : (article.category ? [article.category] : []),
    tags: Array.isArray(article.tags) ? article.tags : [],
    images: Array.isArray(article.images) ? article.images : [],
    publishedAt: article.publishedAt || new Date().toISOString(),
    visibility: article.visibility || 'public',
    source_type: article.source_type || 'text',
    media: article.media || null,
  };
}

/**
 * Safe error logging (prevents console spam in production)
 */
export function logError(context: string, error: any, details?: Record<string, any>) {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error, details || '');
  } else {
    // In production, only log critical errors
    if (error?.code === 'VALIDATION_ERROR' || error?.code === 'API_ERROR') {
      console.error(`[${context}]`, error.message, details || '');
    }
  }
}



