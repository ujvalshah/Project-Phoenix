/**
 * Unified Error Handling Utility
 * 
 * Provides consistent error handling across the application
 */
import type { Article } from '@/types';

export interface AppError {
  message: string;
  code?: string;
  field?: string;
  originalError?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Format validation errors from backend (Zod or Mongoose)
 */
export function formatValidationError(error: unknown): AppError {
  const recordError = isRecord(error) ? error : {};
  const message =
    typeof recordError.message === 'string' ? recordError.message : 'Validation error';
  const path = recordError.path;
  const code = typeof recordError.code === 'string' ? recordError.code : 'UNKNOWN_ERROR';

  // Handle Zod errors (array path)
  if (Array.isArray(path)) {
    return {
      message,
      code: 'VALIDATION_ERROR',
      field: path.join('.'),
      originalError: error,
    };
  }
  
  // Handle Mongoose errors (string path)
  if (typeof path === 'string') {
    return {
      message,
      code: 'VALIDATION_ERROR',
      field: path,
      originalError: error,
    };
  }
  
  // Handle generic errors
  return {
    message: message || 'An error occurred',
    code,
    originalError: error,
  };
}

/**
 * Format API errors consistently
 */
export function formatApiError(error: unknown): AppError {
  const recordError = isRecord(error) ? error : {};
  // Handle validation errors from backend
  const nestedErrors = recordError.errors;
  if (Array.isArray(nestedErrors) && nestedErrors.length > 0) {
    const firstError = nestedErrors[0];
    return formatValidationError(firstError);
  }
  
  // Handle error objects with message
  if (typeof recordError.message === 'string') {
    return {
      message: recordError.message,
      code: typeof recordError.code === 'string' ? recordError.code : 'API_ERROR',
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
export function hasValidAuthor(article: unknown): article is { author: { id: string; name: string } } {
  if (!isRecord(article) || !isRecord(article.author)) {
    return false;
  }
  return (
    typeof article.author.id === 'string' &&
    typeof article.author.name === 'string'
  );
}

/**
 * Type guard: Check if Article is valid
 */
export function isValidArticle(article: unknown): article is {
  id: string;
  title?: string;
  author: { id: string; name: string };
} {
  if (!isRecord(article)) {
    return false;
  }
  return (
    typeof article.id === 'string' &&
    (article.title === undefined || typeof article.title === 'string') &&
    hasValidAuthor(article)
  );
}

/**
 * Sanitize article data - ensure all required fields exist
 */
export function sanitizeArticle(article: unknown): Article | null {
  if (!article) {
    return null;
  }
  if (!isRecord(article)) {
    return null;
  }
  
  const recordArticle = article as Record<string, unknown>;
  const authorRecord = isRecord(recordArticle.author)
    ? (recordArticle.author as Record<string, unknown>)
    : {};

  return {
    ...article,
    id:
      (typeof recordArticle.id === 'string' && recordArticle.id) ||
      (isRecord(recordArticle._id) && typeof recordArticle._id.toString === 'function'
        ? recordArticle._id.toString()
        : '') ||
      '',
    title: (typeof recordArticle.title === 'string' && recordArticle.title) || undefined, // Preserve empty titles (no fallback)
    content: (typeof recordArticle.content === 'string' && recordArticle.content) || '',
    excerpt: (typeof recordArticle.excerpt === 'string' && recordArticle.excerpt) || '',
    author: {
      id:
        (typeof authorRecord.id === 'string' && authorRecord.id) ||
        (typeof recordArticle.authorId === 'string' && recordArticle.authorId) ||
        '',
      name:
        (typeof authorRecord.name === 'string' && authorRecord.name) ||
        (typeof recordArticle.authorName === 'string' && recordArticle.authorName) ||
        'Unknown',
      avatar_url:
        authorRecord.avatar_url ??
        authorRecord.avatarUrl,
    },
    // CATEGORY PHASE-OUT: Removed categories field - tags are now the only classification field
    tags: Array.isArray(recordArticle.tags) ? recordArticle.tags : [],
    images: Array.isArray(recordArticle.images) ? recordArticle.images : [],
    publishedAt:
      (typeof recordArticle.publishedAt === 'string' && recordArticle.publishedAt) ||
      new Date().toISOString(),
    visibility:
      (typeof recordArticle.visibility === 'string' && recordArticle.visibility) ||
      'public',
    source_type:
      (typeof recordArticle.source_type === 'string' && recordArticle.source_type) ||
      'text',
    media: recordArticle.media ?? null,
    readTime:
      typeof recordArticle.readTime === 'number' ? recordArticle.readTime : 1,
  } as Article;
}

/**
 * Single normalization path for feed cards: shallow clone + defaults via {@link sanitizeArticle},
 * then guarantee author fields match {@link hasValidAuthor} expectations.
 * Call once per article before `NewsCard` when using `skipArticlePrepare` in `useNewsCard`.
 */
export function prepareArticleForNewsCard(article: unknown): Article | null {
  const s = sanitizeArticle(article);
  if (!s) return null;
  return s;
}

/**
 * Safe error logging (prevents console spam in production)
 */
export function logError(context: string, error: unknown, details?: Record<string, unknown>) {
  const errorCode =
    isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
  const errorMessage =
    isRecord(error) && typeof error.message === 'string'
      ? error.message
      : String(error ?? '');
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error, details || '');
  } else {
    // In production, only log critical errors
    if (errorCode === 'VALIDATION_ERROR' || errorCode === 'API_ERROR') {
      console.error(`[${context}]`, errorMessage, details || '');
    }
  }
}



