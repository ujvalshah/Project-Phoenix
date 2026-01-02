
// In development, Vite proxies /api to localhost:5000.
import { recordApiTiming } from '../observability/telemetry.js';
import { captureException } from '../utils/sentry.js';
const BASE_URL = '/api';

const AUTH_STORAGE_KEY = 'nuggets_auth_data_v2';

// Helper to extract error message and details from response
async function extractError(response: Response): Promise<{ message: string; errors?: any[] }> {
  try {
    const errorData = await response.json();
    return {
      message: errorData.message || `Request failed with status ${response.status}`,
      errors: errorData.errors
    };
  } catch {
    return {
      message: `Request failed with status ${response.status}`
    };
  }
}

class ApiClient {
  // Track active AbortControllers by request key to cancel previous requests
  private activeControllers = new Map<string, AbortController>();

  /**
   * Check if endpoint is a public auth endpoint (login/signup)
   * These endpoints return 401 for invalid credentials, NOT expired tokens
   * CRITICAL: Never logout on 401 from these endpoints
   */
  private isPublicAuthEndpoint(endpoint: string): boolean {
    return endpoint === '/auth/login' || endpoint === '/auth/signup';
  }

  /**
   * Check if we have an authenticated session (token exists in storage)
   * Used to determine if 401 means "expired session" vs "not authenticated"
   */
  private hasAuthenticatedSession(): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const { token } = JSON.parse(stored);
          return !!token;
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
    return false;
  }

  private getAuthHeader(): Record<string, string> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const { token } = JSON.parse(stored);
          if (token) {
            return { 'Authorization': `Bearer ${token}` };
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors or storage access errors
    }
    return {};
  }

  /**
   * Cancel previous request for the same key and create a new AbortController
   */
  private getAbortController(requestKey: string): AbortController {
    // Cancel previous request if exists
    const previousController = this.activeControllers.get(requestKey);
    if (previousController) {
      previousController.abort();
    }

    // Create new controller
    const controller = new AbortController();
    this.activeControllers.set(requestKey, controller);
    return controller;
  }

  /**
   * Generate a unique key for request cancellation tracking
   * Uses endpoint + method to identify requests that should cancel each other
   */
  private getRequestKey(endpoint: string, method: string = 'GET'): string {
    return `${method}:${endpoint}`;
  }

  private async request<T>(endpoint: string, options?: RequestInit & { cancelKey?: string }): Promise<T> {
    const method = options?.method || 'GET';
    const cancelKey = options?.cancelKey || this.getRequestKey(endpoint, method);
    const abortController = this.getAbortController(cancelKey);
    const { cancelKey: _, ...requestOptions } = options || {};
    const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    let statusCode: number | undefined;
    let success = false;
    let aborted = false;
    const config = {
      ...requestOptions,
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(), // Auto-attach token
        ...requestOptions?.headers,
      },
    };

    let requestId: string | null = null;
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      statusCode = response.status;
      
      // Extract request ID from response headers for correlation
      requestId = response.headers.get('X-Request-Id');

      if (!response.ok) {
        const errorInfo = await extractError(response);
        const error: any = new Error(errorInfo.message);
        
        // Attach errors array if present (for validation errors)
        if (errorInfo.errors) {
          error.errors = errorInfo.errors;
        }
        
        // Attach response data for debugging
        error.response = { status: response.status, data: errorInfo };
        
        // For 404, preserve the response data in the error
        if (response.status === 404) {
          const notFoundError: any = new Error(errorInfo.message || 'The requested resource was not found.');
          notFoundError.response = { status: response.status, data: errorInfo };
          throw notFoundError;
        }
        if (response.status === 403) {
          // Handle 403 Forbidden (often used for expired/invalid tokens)
          const isPublicAuth = this.isPublicAuthEndpoint(endpoint);
          const hasSession = this.hasAuthenticatedSession();
          const authHeader = this.getAuthHeader();
          const tokenWasSent = !!authHeader['Authorization'];
          
          // Check if error message indicates token issue
          const isTokenError = errorInfo.message?.toLowerCase().includes('token') || 
                              errorInfo.message?.toLowerCase().includes('expired') ||
                              errorInfo.message?.toLowerCase().includes('invalid');
          
          // Never logout on public auth endpoints
          if (isPublicAuth) {
            throw error;
          }
          
          // If it's a token-related 403 and we have a session, treat it like 401
          if (isTokenError && hasSession && tokenWasSent) {
            // Token expired/invalid → logout
            if (typeof window !== 'undefined') {
              try {
                localStorage.removeItem(AUTH_STORAGE_KEY);
              } catch (e) {
                // Ignore storage errors
              }
              if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
              }
            }
            const isExpired = errorInfo.message?.toLowerCase().includes('expired') || 
                            errorInfo.message?.toLowerCase().includes('token expired');
            throw new Error(isExpired 
              ? 'Your session has expired. Please sign in again.'
              : 'Your session is invalid. Please sign in again.'
            );
          }
          
          // Otherwise, just throw the 403 error
          throw error;
        }
        if (response.status === 401) {
          const isPublicAuth = this.isPublicAuthEndpoint(endpoint);
          const hasSession = this.hasAuthenticatedSession();
          const authHeader = this.getAuthHeader();
          const tokenWasSent = !!authHeader['Authorization'];

          // CRITICAL: Never logout on 401 for public auth endpoints (login/signup)
          // These return 401 for invalid credentials, not expired tokens
          if (isPublicAuth) {
            // Public auth endpoint - just throw error with backend message, never logout
            throw error;
          }

          // For all other endpoints: logout only if we have an authenticated session
          // AND token was sent (meaning token is expired/invalid)
          // This handles:
          // - Expired tokens on protected endpoints → logout ✅
          // - Invalid tokens on protected endpoints → logout ✅
          // - Missing tokens (no session) → don't logout (user not logged in) ✅
          if (hasSession && tokenWasSent) {
            // Authenticated session with expired/invalid token → logout
            if (typeof window !== 'undefined') {
              // Clear auth data
              try {
                localStorage.removeItem(AUTH_STORAGE_KEY);
              } catch (e) {
                // Ignore storage errors
              }
              // Only redirect if we're not already on login page
              if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
              }
            }
            // Check backend message to provide specific error
            const isExpired = errorInfo.message?.toLowerCase().includes('expired') || 
                            errorInfo.message?.toLowerCase().includes('token expired');
            throw new Error(isExpired 
              ? 'Your session has expired. Please sign in again.'
              : 'Your session is invalid. Please sign in again.'
            );
          }

          // No authenticated session OR token wasn't sent → just throw error without logging out
          // This handles cases where:
          // - User tries to access protected endpoint without being logged in
          // - Public endpoint returns 401 for other reasons
          throw error;
        }
        if (response.status === 429) {
          throw new Error('Too many attempts. Please wait a moment and try again.');
        }
        if (response.status === 500) {
          // Preserve backend error message if available, otherwise use generic message
          const backendMessage = errorInfo.message && errorInfo.message !== 'Internal server error' 
            ? errorInfo.message 
            : 'Something went wrong on our end. Please try again in a moment.';
          const serverError: any = new Error(backendMessage);
          serverError.response = error.response;
          throw serverError;
        }
        
        // For other errors (like 400 validation errors), throw with errors array attached
        throw error;
      }

      if (response.status === 204) {
        return {} as T;
      }

      success = true;
      return response.json();
    } catch (error: any) {
      // Handle AbortError (request was cancelled) - don't treat as error
      if (error.name === 'AbortError') {
        // Only clean up if this controller is still the active one (not replaced by newer request)
        const currentController = this.activeControllers.get(cancelKey);
        if (currentController === abortController) {
          this.activeControllers.delete(cancelKey);
        }
        // Return a rejected promise that won't trigger error handlers
        aborted = true;
        return Promise.reject(new Error('Request cancelled'));
      }
      
      // Handle network errors (connection refused, timeout, etc.)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Capture network errors in Sentry
        captureException(error, {
          requestId: requestId || undefined,
          route: endpoint,
          extra: {
            method,
            status: statusCode,
            networkError: true,
          },
        });
        
        // In development, show helpful message; in production, show generic message
        const isDevelopment = import.meta.env.DEV;
        if (isDevelopment) {
          throw new Error(
            "We couldn't connect to the server. Please ensure the backend server is running on port 5000."
          );
        }
        throw new Error("We couldn't connect to the server. Please check your internet connection and try again.");
      }
      
      // Capture API errors (non-network) in Sentry
      if (statusCode && statusCode >= 500) {
        // Only capture server errors (5xx), not client errors (4xx)
        captureException(error, {
          requestId: requestId || undefined,
          route: endpoint,
          extra: {
            method,
            status: statusCode,
            errorMessage: error.message,
          },
        });
      }
      
      // Re-throw other errors as-is (they'll be mapped by authService)
      throw error;
    } finally {
      const endedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const durationMs = endedAt - startedAt;
      if (!aborted) {
        recordApiTiming({
          endpoint,
          method,
          status: statusCode,
          durationMs,
          ok: success
        });
      }
      // Clean up controller after request completes (success or error)
      // Only delete if this is still the active controller (not replaced by newer request)
      const currentController = this.activeControllers.get(cancelKey);
      if (currentController === abortController) {
        this.activeControllers.delete(cancelKey);
      }
    }
  }

  get<T>(url: string, headers?: HeadersInit, cancelKey?: string) {
    return this.request<T>(url, { method: 'GET', headers, cancelKey });
  }

  post<T>(url: string, body: any, headers?: HeadersInit, cancelKey?: string) {
    return this.request<T>(url, { method: 'POST', body: JSON.stringify(body), headers, cancelKey });
  }

  put<T>(url: string, body: any, headers?: HeadersInit, cancelKey?: string) {
    return this.request<T>(url, { method: 'PUT', body: JSON.stringify(body), headers, cancelKey });
  }

  patch<T>(url: string, body: any, headers?: HeadersInit, cancelKey?: string) {
    return this.request<T>(url, { method: 'PATCH', body: JSON.stringify(body), headers, cancelKey });
  }

  delete<T>(url: string, headers?: HeadersInit, cancelKey?: string) {
    return this.request<T>(url, { method: 'DELETE', headers, cancelKey });
  }
}

export const apiClient = new ApiClient();
