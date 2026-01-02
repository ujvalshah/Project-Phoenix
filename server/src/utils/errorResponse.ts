/**
 * Standardized Error Response Helper
 * 
 * All API endpoints must use this helper to ensure consistent error responses.
 * This eliminates silent failures and provides debuggable, consistent error shapes.
 */

import { Response } from 'express';

export interface StandardErrorResponse {
  error: true;
  message: string;
  code: string;
  timestamp: string;
  errors?: Array<{
    path: string | string[];
    message: string;
    code?: string;
  }>;
}

/**
 * Send a standardized error response
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  message: string,
  code: string,
  errors?: Array<{ path: string | string[]; message: string; code?: string }>
): void {
  const response: StandardErrorResponse = {
    error: true,
    message,
    code,
    timestamp: new Date().toISOString(),
  };

  if (errors && errors.length > 0) {
    response.errors = errors;
  }

  res.status(statusCode).json(response);
}

/**
 * Send validation error response (400)
 */
export function sendValidationError(
  res: Response,
  message: string,
  errors: Array<{ path: string | string[]; message: string; code?: string }>
): void {
  sendErrorResponse(res, 400, message, 'VALIDATION_ERROR', errors);
}

/**
 * Send unauthorized error response (401)
 */
export function sendUnauthorizedError(res: Response, message: string = 'Unauthorized'): void {
  sendErrorResponse(res, 401, message, 'UNAUTHORIZED');
}

/**
 * Send forbidden error response (403)
 */
export function sendForbiddenError(res: Response, message: string = 'Forbidden'): void {
  sendErrorResponse(res, 403, message, 'FORBIDDEN');
}

/**
 * Send not found error response (404)
 */
export function sendNotFoundError(res: Response, message: string = 'Resource not found'): void {
  sendErrorResponse(res, 404, message, 'NOT_FOUND');
}

/**
 * Send conflict error response (409) - for duplicate key errors
 */
export function sendConflictError(res: Response, message: string, code: string = 'CONFLICT'): void {
  sendErrorResponse(res, 409, message, code);
}

/**
 * Send internal server error response (500)
 */
export function sendInternalError(res: Response, message: string = 'Internal server error'): void {
  sendErrorResponse(res, 500, message, 'INTERNAL_SERVER_ERROR');
}

/**
 * Send too many requests error response (429)
 */
export function sendRateLimitError(res: Response, message: string = 'Too many requests'): void {
  sendErrorResponse(res, 429, message, 'RATE_LIMIT_EXCEEDED');
}

/**
 * Send payload too large error response (413)
 */
export function sendPayloadTooLargeError(res: Response, message: string = 'Payload too large'): void {
  sendErrorResponse(res, 413, message, 'PAYLOAD_TOO_LARGE');
}

/**
 * Handle MongoDB duplicate key error (11000)
 * Returns appropriate conflict response
 */
export function handleDuplicateKeyError(
  res: Response,
  error: any,
  fieldMap?: Record<string, { message: string; code: string }>
): boolean {
  if (error.code !== 11000) {
    return false;
  }

  const keyPattern = error.keyPattern || {};
  const keyValue = error.keyValue || {};

  // Default field mappings
  const defaultFieldMap: Record<string, { message: string; code: string }> = {
    'auth.email': { message: 'Email already registered', code: 'EMAIL_ALREADY_EXISTS' },
    'profile.username': { message: 'Username already taken', code: 'USERNAME_ALREADY_EXISTS' },
    'name': { message: 'Name already exists', code: 'NAME_ALREADY_EXISTS' },
  };

  const finalFieldMap = { ...defaultFieldMap, ...fieldMap };

  // Find the duplicate field
  for (const [field, config] of Object.entries(finalFieldMap)) {
    if (keyPattern[field]) {
      sendConflictError(res, config.message, config.code);
      return true;
    }
  }

  // Fallback for unknown duplicate fields
  const duplicateField = Object.keys(keyPattern)[0] || 'field';
  sendConflictError(res, `${duplicateField} already exists`, 'DUPLICATE_KEY_ERROR');
  return true;
}





