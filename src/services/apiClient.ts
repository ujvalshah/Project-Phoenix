
// In development, Vite proxies /api to localhost:5000.
import { recordApiTiming } from '../observability/telemetry.js';
import { captureException } from '../utils/sentry.js';
import { getNormalizedApiBase } from '../utils/urlUtils.js';

// Normalize API base URL: defaults to '/api', respects VITE_API_URL if set (ensures /api suffix)
const BASE_URL = getNormalizedApiBase();

// SECURITY: Token in localStorage is vulnerable to XSS. Prefer HttpOnly cookies; use credentials: 'include' and stop sending Authorization.
const AUTH_STORAGE_KEY = 'nuggets_auth_data_v2';

// Token refresh configuration
const REFRESH_BUFFER_SECONDS = 60; // Refresh 1 minute before expiry

// Helper to extract error message and details from response
async function extractError(response: Response): Promise<{ message: string; errors?: any[]; code?: string }> {
  try {
    const errorData = await response.json();
    return {
      message: errorData.message || `Request failed with status ${response.status}`,
      errors: errorData.errors,
      code: errorData.code,
    };
  } catch {
    return {
      message: `Request failed with status ${response.status}`
    };
  }
}

/**
 * Storage helper for auth tokens
 */
interface StoredAuthData {
  user: any;
  token: string; // Access token (legacy name for compatibility)
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number; // Seconds until access token expires
  refreshedAt?: number; // Timestamp when tokens were last refreshed
}

function getStoredAuth(): StoredAuthData | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

function setStoredAuth(data: StoredAuthData): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage errors
  }
}

function clearStoredAuth(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if access token is about to expire
 */
function isTokenExpiringSoon(authData: StoredAuthData): boolean {
  if (!authData.expiresIn || !authData.refreshedAt) {
    return false; // No expiry info, can't determine
  }

  const now = Date.now() / 1000; // Current time in seconds
  const refreshedAtSeconds = authData.refreshedAt / 1000;
  const expiresAt = refreshedAtSeconds + authData.expiresIn;

  // Token expires within buffer period
  return now >= expiresAt - REFRESH_BUFFER_SECONDS;
}

class ApiClient {
  // Track active AbortControllers by request key to cancel previous requests
  private activeControllers = new Map<string, AbortController>();

  // Token refresh state
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshSubscribers: Array<(success: boolean) => void> = [];

  /**
   * Check if endpoint is a public auth endpoint (login/signup/refresh)
   * These endpoints return 401 for invalid credentials, NOT expired tokens
   * CRITICAL: Never logout on 401 from these endpoints
   */
  private isPublicAuthEndpoint(endpoint: string): boolean {
    return (
      endpoint === '/auth/login' ||
      endpoint === '/auth/signup' ||
      endpoint === '/auth/refresh'
    );
  }

  /**
   * Check if we have an authenticated session (token exists in storage)
   * Used to determine if 401 means "expired session" vs "not authenticated"
   */
  private hasAuthenticatedSession(): boolean {
    const authData = getStoredAuth();
    return !!(authData?.token);
  }

  /**
   * Check if we have a refresh token available
   */
  private hasRefreshToken(): boolean {
    const authData = getStoredAuth();
    return !!(authData?.refreshToken);
  }

  private getAuthHeader(): Record<string, string> {
    const authData = getStoredAuth();
    if (authData?.token) {
      return { 'Authorization': `Bearer ${authData.token}` };
    }
    return {};
  }

  /**
   * Attempt to refresh the access token using the refresh token
   * Returns true if refresh succeeded, false otherwise
   */
  private async refreshAccessToken(): Promise<boolean> {
    // If already refreshing, wait for that to complete
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    const authData = getStoredAuth();
    if (!authData?.refreshToken || !authData?.token) {
      return false;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh(authData);

    try {
      const success = await this.refreshPromise;
      // Notify all waiting subscribers
      this.refreshSubscribers.forEach((callback) => callback(success));
      this.refreshSubscribers = [];
      return success;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async doRefresh(authData: StoredAuthData): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`, // Send expired access token
        },
        body: JSON.stringify({ refreshToken: authData.refreshToken }),
      });

      if (!response.ok) {
        // Refresh failed - likely refresh token expired
        return false;
      }

      const data = await response.json();

      // Update stored tokens
      setStoredAuth({
        ...authData,
        token: data.accessToken || data.token,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || authData.refreshToken, // Keep old if not rotated
        expiresIn: data.expiresIn,
        refreshedAt: Date.now(),
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for ongoing refresh to complete
   */
  private waitForRefresh(): Promise<boolean> {
    return new Promise((resolve) => {
      this.refreshSubscribers.push(resolve);
    });
  }

  /**
   * Proactively refresh token if it's about to expire
   */
  private async maybeProactiveRefresh(): Promise<void> {
    const authData = getStoredAuth();
    if (authData && authData.refreshToken && isTokenExpiringSoon(authData)) {
      await this.refreshAccessToken();
    }
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

  private async request<T>(
    endpoint: string,
    options?: RequestInit & { cancelKey?: string; _isRetry?: boolean }
  ): Promise<T> {
    const method = options?.method || 'GET';
    const cancelKey = options?.cancelKey || this.getRequestKey(endpoint, method);
    const abortController = this.getAbortController(cancelKey);
    const { cancelKey: _, _isRetry, ...requestOptions } = options || {};
    const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    let statusCode: number | undefined;
    let success = false;
    let aborted = false;

    // Proactively refresh token if about to expire (non-blocking, best-effort)
    if (!_isRetry && !this.isPublicAuthEndpoint(endpoint)) {
      this.maybeProactiveRefresh().catch(() => {
        // Ignore proactive refresh errors
      });
    }

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
        
        // PHASE 6: Include request ID in error for correlation with backend logs
        if (requestId) {
          error.requestId = requestId;
        }
        
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
          const hasRefresh = this.hasRefreshToken();
          const authHeader = this.getAuthHeader();
          const tokenWasSent = !!authHeader['Authorization'];

          // CRITICAL: Never logout on 401 for public auth endpoints (login/signup)
          // These return 401 for invalid credentials, not expired tokens
          if (isPublicAuth) {
            // Public auth endpoint - just throw error with backend message, never logout
            throw error;
          }

          // Check if this is a token expiration that we can recover from
          const isTokenExpired =
            errorInfo.code === 'TOKEN_EXPIRED' ||
            errorInfo.message?.toLowerCase().includes('expired');

          // If token expired and we have a refresh token, attempt to refresh
          if (isTokenExpired && hasRefresh && tokenWasSent && !_isRetry) {
            // Wait for any ongoing refresh
            if (this.isRefreshing) {
              const refreshed = await this.waitForRefresh();
              if (refreshed) {
                // Retry the original request with new token
                return this.request<T>(endpoint, { ...options, _isRetry: true });
              }
            } else {
              // Attempt refresh
              const refreshed = await this.refreshAccessToken();
              if (refreshed) {
                // Retry the original request with new token
                return this.request<T>(endpoint, { ...options, _isRetry: true });
              }
            }
          }

          // For all other endpoints: logout only if we have an authenticated session
          // AND token was sent (meaning token is expired/invalid)
          // This handles:
          // - Expired tokens on protected endpoints (after refresh failed) → logout ✅
          // - Invalid tokens on protected endpoints → logout ✅
          // - Missing tokens (no session) → don't logout (user not logged in) ✅
          if (hasSession && tokenWasSent) {
            // Authenticated session with expired/invalid token → logout
            if (typeof window !== 'undefined') {
              // Clear auth data
              clearStoredAuth();
              // Only redirect if we're not already on login page
              if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
              }
            }
            // Check backend message to provide specific error
            throw new Error(
              isTokenExpired
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
      // SAFETY PATCH: Treat request cancellations as non-errors
      if (error?.name === 'AbortError' || error?.message?.includes('Request cancelled')) {
        // Only clean up if this controller is still the active one (not replaced by newer request)
        const currentController = this.activeControllers.get(cancelKey);
        if (currentController === abortController) {
          this.activeControllers.delete(cancelKey);
        }
        // Intentional cancellation — no action needed, return silently
        aborted = true;
        return undefined as T;
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
