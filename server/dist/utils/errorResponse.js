/**
 * Standardized Error Response Helper
 *
 * All API endpoints must use this helper to ensure consistent error responses.
 * This eliminates silent failures and provides debuggable, consistent error shapes.
 */
/**
 * Send a standardized error response
 */
export function sendErrorResponse(res, statusCode, message, code, errors) {
    const response = {
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
export function sendValidationError(res, message, errors) {
    sendErrorResponse(res, 400, message, 'VALIDATION_ERROR', errors);
}
/**
 * Send unauthorized error response (401)
 */
export function sendUnauthorizedError(res, message = 'Unauthorized') {
    sendErrorResponse(res, 401, message, 'UNAUTHORIZED');
}
/**
 * Send forbidden error response (403)
 */
export function sendForbiddenError(res, message = 'Forbidden') {
    sendErrorResponse(res, 403, message, 'FORBIDDEN');
}
/**
 * Send not found error response (404)
 */
export function sendNotFoundError(res, message = 'Resource not found') {
    sendErrorResponse(res, 404, message, 'NOT_FOUND');
}
/**
 * Send conflict error response (409) - for duplicate key errors
 */
export function sendConflictError(res, message, code = 'CONFLICT') {
    sendErrorResponse(res, 409, message, code);
}
/**
 * Send internal server error response (500)
 */
export function sendInternalError(res, message = 'Internal server error') {
    sendErrorResponse(res, 500, message, 'INTERNAL_SERVER_ERROR');
}
/**
 * Send too many requests error response (429)
 */
export function sendRateLimitError(res, message = 'Too many requests') {
    sendErrorResponse(res, 429, message, 'RATE_LIMIT_EXCEEDED');
}
/**
 * Send payload too large error response (413)
 */
export function sendPayloadTooLargeError(res, message = 'Payload too large') {
    sendErrorResponse(res, 413, message, 'PAYLOAD_TOO_LARGE');
}
/**
 * Handle MongoDB duplicate key error (11000)
 * Returns appropriate conflict response
 */
export function handleDuplicateKeyError(res, error, fieldMap) {
    if (error.code !== 11000) {
        return false;
    }
    const keyPattern = error.keyPattern || {};
    const keyValue = error.keyValue || {};
    // Default field mappings
    const defaultFieldMap = {
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
//# sourceMappingURL=errorResponse.js.map