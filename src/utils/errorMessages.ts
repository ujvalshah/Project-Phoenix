/**
 * Error Message Mapping Utility
 * 
 * Maps backend error messages to clearer, user-friendly frontend messages.
 * This improves UX without changing backend behavior.
 */

/**
 * Maps authentication-related error messages to user-friendly copy
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

function getErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error) || !isRecord(error.response)) return undefined;
  return typeof error.response.status === 'number' ? error.response.status : undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (isRecord(error)) {
    if (typeof error.code === 'string') return error.code;
    if (isRecord(error.response) && isRecord(error.response.data) && typeof error.response.data.code === 'string') {
      return error.response.data.code;
    }
  }
  return undefined;
}

function getResponseMessage(error: unknown): string | undefined {
  if (!isRecord(error) || !isRecord(error.response) || !isRecord(error.response.data)) return undefined;
  return typeof error.response.data.message === 'string' ? error.response.data.message : undefined;
}

export function mapAuthError(error: unknown, context: 'login' | 'signup' | 'password_reset' | 'general' = 'general'): string {
  const rawMessage = getErrorMessage(error);
  const message = typeof rawMessage === 'string' ? rawMessage : 'An unexpected error occurred';
  
  // Handle network/connection errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return "We couldn't connect to the server. Please check your internet connection and try again.";
  }
  
  // Handle HTTP status-based errors
  const status = getErrorStatus(error);
  if (status) {
    
    if (status === 429) {
      return "Too many attempts. Please wait a moment and try again.";
    }
    
    if (status === 401) {
      // Map specific 401 messages
      if (message.toLowerCase().includes('invalid email or password') || 
          message.toLowerCase().includes('invalid credentials')) {
        return "The email or password you entered is incorrect. Please try again.";
      }
      if (message.toLowerCase().includes('social login')) {
        return "This account was created with social login. Please sign in with your social account.";
      }
      if (message.toLowerCase().includes('token') || message.toLowerCase().includes('unauthorized')) {
        return "Your session has expired. Please sign in again.";
      }
      return "Please sign in to continue.";
    }
    
    if (status === 409) {
      // Check for error code first (most reliable)
      const errorCode = getErrorCode(error);
      if (errorCode === 'EMAIL_ALREADY_EXISTS') {
        return "This email is already registered. Please sign in or use a different email.";
      }
      if (errorCode === 'USERNAME_ALREADY_EXISTS') {
        return "This username is already taken. Please choose a different username.";
      }
      // Fallback to message parsing
      if (message.toLowerCase().includes('email already')) {
        return "This email is already registered. Please sign in or use a different email.";
      }
      if (message.toLowerCase().includes('username already') || message.toLowerCase().includes('username taken')) {
        return "This username is already taken. Please choose a different username.";
      }
      return "This information is already in use. Please try a different value.";
    }
    
    if (status === 400) {
      // Validation errors - clean up Zod format
      return cleanValidationMessage(message);
    }
    
    if (status === 500) {
      return "Something went wrong on our end. Please try again in a moment.";
    }
  }
  
  // Map specific backend messages
  const lowerMessage = message.toLowerCase();
  
  // Login-specific messages
  if (context === 'login') {
    if (lowerMessage.includes('invalid email or password') || 
        lowerMessage.includes('invalid credentials')) {
      return "The email or password you entered is incorrect. Please try again.";
    }
    if (lowerMessage.includes('user not found')) {
      return "The email or password you entered is incorrect. Please try again.";
    }
  }
  
  // Password reset-specific messages
  if (context === 'password_reset') {
    const errorCode = getErrorCode(error);
    if (errorCode === 'INVALID_RESET_TOKEN') {
      return "This reset link has expired or is invalid. Please request a new one.";
    }
    if (lowerMessage.includes('expired') || lowerMessage.includes('invalid')) {
      return "This reset link has expired or is invalid. Please request a new one.";
    }
    if (lowerMessage.includes('password')) {
      return cleanValidationMessage(message);
    }
  }

  // Signup-specific messages
  if (context === 'signup') {
    // Check for error code first
    const errorCode = error?.response?.data?.code || error?.code;
    if (errorCode === 'EMAIL_ALREADY_EXISTS') {
      return "This email is already registered. Please sign in or use a different email.";
    }
    if (errorCode === 'USERNAME_ALREADY_EXISTS') {
      return "This username is already taken. Please choose a different username.";
    }
    // Fallback to message parsing
    if (lowerMessage.includes('email already registered') || lowerMessage.includes('email already')) {
      return "This email is already registered. Please sign in or use a different email.";
    }
    if (lowerMessage.includes('username already taken') || lowerMessage.includes('username already')) {
      return "This username is already taken. Please choose a different username.";
    }
    if (lowerMessage.includes('password') && lowerMessage.includes('required')) {
      return "Please enter a password that meets the requirements.";
    }
  }
  
  // Validation error patterns
  if (lowerMessage.includes('validation failed') || lowerMessage.includes('invalid')) {
    return cleanValidationMessage(message);
  }
  
  // Generic fallback - return cleaned message
  return cleanGenericMessage(message);
}

/**
 * Cleans up Zod validation error messages
 * Converts: "Email: Invalid email format. Password: Password must be at least 8 characters long"
 * To: "Please check your input: Invalid email format. Password must be at least 8 characters."
 */
function cleanValidationMessage(message: string): string {
  // Remove field prefixes like "Email:", "Password:", etc.
  const cleaned = message
    .replace(/^(Email|Password|Username|Full name|Phone number):\s*/gi, '')
    .replace(/\s*\.\s*/g, '. ')
    .trim();
  
  // If it's a long validation message, simplify it
  if (cleaned.split('.').length > 2) {
    // Multiple validation errors - provide a summary
    if (cleaned.toLowerCase().includes('password')) {
      return "Please check your password. It must be at least 8 characters and include uppercase, lowercase, number, and special character.";
    }
    return "Please check your input and try again.";
  }
  
  // Single validation error - clean it up
  if (cleaned.toLowerCase().includes('email') && cleaned.toLowerCase().includes('format')) {
    return "Please enter a valid email address.";
  }
  if (cleaned.toLowerCase().includes('password') && cleaned.toLowerCase().includes('8')) {
    return "Password must be at least 8 characters long.";
  }
  if (cleaned.toLowerCase().includes('password') && cleaned.toLowerCase().includes('uppercase')) {
    return "Password must include at least one uppercase letter (A-Z).";
  }
  if (cleaned.toLowerCase().includes('password') && cleaned.toLowerCase().includes('lowercase')) {
    return "Password must include at least one lowercase letter (a-z).";
  }
  if (cleaned.toLowerCase().includes('password') && cleaned.toLowerCase().includes('number')) {
    return "Password must include at least one number (0-9).";
  }
  if (cleaned.toLowerCase().includes('password') && cleaned.toLowerCase().includes('special')) {
    return "Password must include at least one special character (!@#$%^&*).";
  }
  if (cleaned.toLowerCase().includes('username') && cleaned.toLowerCase().includes('3')) {
    return "Username must be at least 3 characters long.";
  }
  if (cleaned.toLowerCase().includes('full name') && cleaned.toLowerCase().includes('required')) {
    return "Please enter your full name.";
  }
  
  // Generic validation error
  return `Please check your input: ${cleaned}`;
}

/**
 * Cleans generic error messages to be more user-friendly
 */
function cleanGenericMessage(message: string): string {
  // Remove technical details
  const cleaned = message
    .replace(/^Error:\s*/i, '')
    .replace(/^API Error:\s*/i, '')
    .replace(/\d{3}\s*error/gi, '')
    .trim();
  
  // Don't expose internal error details
  if (cleaned.includes('ECONNREFUSED') || cleaned.includes('ENOTFOUND')) {
    return "We couldn't connect to the server. Please check your internet connection and try again.";
  }
  
  if (cleaned.includes('timeout')) {
    return "The request took too long. Please try again.";
  }
  
  // If message is too technical, provide generic fallback
  if (cleaned.includes('at ') || cleaned.includes('Error:') || cleaned.length > 200) {
    return "Something went wrong. Please try again.";
  }
  
  return cleaned || "An unexpected error occurred. Please try again.";
}

/**
 * Maps network errors to user-friendly messages
 */
export function mapNetworkError(error: unknown): string {
  if (error instanceof TypeError) {
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      return "We couldn't connect to the server. Please check your internet connection and try again.";
    }
  }
  
  const responseMessage = getResponseMessage(error);
  const message = getErrorMessage(error);
  if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || responseMessage?.includes('ECONNREFUSED') || responseMessage?.includes('ENOTFOUND')) {
    return "We couldn't connect to the server. Please check your internet connection and try again.";
  }
  
  if (message.includes('timeout') || responseMessage?.includes('timeout')) {
    return "The request took too long. Please try again.";
  }
  
  return mapAuthError(error, 'general');
}
