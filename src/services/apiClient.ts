
// In development, Vite proxies /api to localhost:5000.
import { recordApiTiming } from '../observability/telemetry.js';
import { captureException } from '../utils/sentry.js';
import { getNormalizedApiBase } from '../utils/urlUtils.js';

// Normalize API base URL: defaults to '/api', respects VITE_API_URL if set (ensures /api suffix)
const BASE_URL = getNormalizedApiBase();

// CSRF cookie name (set by backend, non-HttpOnly so JS can read it)
const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * Read a cookie value by name from document.cookie.
 */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

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

class ApiClient {
  // Track active AbortControllers by request key to cancel previous requests
  private activeControllers = new Map<string, AbortController>();

  // Token refresh state
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshSubscribers: Array<(success: boolean) => void> = [];

  // Session expired callback — registered by AuthContext to handle logout
  private sessionExpiredCallback: (() => void) | null = null;

  /**
   * Register a callback to be invoked when the session expires (401 after failed refresh).
   * AuthContext should call this on mount to wire up its logout logic.
   */
  onSessionExpired(callback: () => void): void {
    this.sessionExpiredCallback = callback;
  }

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
   * Attempt to refresh the access token using HttpOnly cookies.
   * The browser sends both access_token and refresh_token cookies automatically.
   * Returns true if refresh succeeded, false otherwise.
   */
  private async refreshAccessToken(): Promise<boolean> {
    // If already refreshing, wait for that to complete
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh();

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

  private async doRefresh(): Promise<boolean> {
    try {
      const csrfToken = getCookie(CSRF_COOKIE_NAME);
      const csrfHeaders = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Sends HttpOnly access_token + refresh_token cookies
        headers: { 'Content-Type': 'application/json', ...csrfHeaders },
        body: JSON.stringify({}), // Body kept for backward compat; tokens come from cookies
      });

      // 503 = Redis/token service temporarily unavailable - retry with backoff
      if (response.status === 503) {
        const delays = [1000, 2000, 4000];
        for (const delay of delays) {
          await new Promise(resolve => setTimeout(resolve, delay));
          const retryResponse = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...csrfHeaders },
            body: JSON.stringify({}),
          });

          if (retryResponse.ok) {
            return true; // Backend sets new cookies automatically
          }
          if (retryResponse.status !== 503) {
            return false;
          }
        }
        return false;
      }

      if (!response.ok) {
        return false;
      }

      // Success — backend has set new HttpOnly cookies in the response
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

  /**
   * Handle session expiration — notify AuthContext to clean up UI state
   */
  private handleSessionExpired(): void {
    if (this.sessionExpiredCallback) {
      this.sessionExpiredCallback();
    } else if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      // Fallback: redirect to home if no callback registered
      window.location.href = '/';
    }
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

    // Build headers: include CSRF token on state-changing requests
    const isMutation = method !== 'GET' && method !== 'HEAD';
    const csrfToken = isMutation ? getCookie(CSRF_COOKIE_NAME) : undefined;

    const config: RequestInit = {
      ...requestOptions,
      signal: abortController.signal,
      credentials: 'include', // Send HttpOnly cookies with every request
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
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
          const isPublicAuth = this.isPublicAuthEndpoint(endpoint);
          const isBookmarkEndpoint =
            endpoint.startsWith('/bookmarks') || endpoint.startsWith('/bookmark-collections');

          // Check if error message indicates token issue
          const isTokenError = errorInfo.message?.toLowerCase().includes('token') ||
                              errorInfo.message?.toLowerCase().includes('expired') ||
                              errorInfo.message?.toLowerCase().includes('invalid');

          if (isPublicAuth) {
            throw error;
          }

          // Bookmark authorization errors should never force a global session reset.
          if (isBookmarkEndpoint) {
            throw error;
          }

          // Token-related 403 → session expired
          if (isTokenError) {
            this.handleSessionExpired();
            const isExpired = errorInfo.message?.toLowerCase().includes('expired');
            throw new Error(isExpired
              ? 'Your session has expired. Please sign in again.'
              : 'Your session is invalid. Please sign in again.'
            );
          }

          throw error;
        }
        if (response.status === 401) {
          const isPublicAuth = this.isPublicAuthEndpoint(endpoint);

          // CRITICAL: Never logout on 401 for public auth endpoints (login/signup)
          if (isPublicAuth) {
            throw error;
          }

          const isTokenExpired =
            errorInfo.code === 'TOKEN_EXPIRED' ||
            errorInfo.message?.toLowerCase().includes('expired');

          // Attempt refresh on 401 (cookie-based: browser has the refresh token)
          if (!_isRetry) {
            if (this.isRefreshing) {
              const refreshed = await this.waitForRefresh();
              if (refreshed) {
                return this.request<T>(endpoint, { ...options, _isRetry: true });
              }
            } else {
              const refreshed = await this.refreshAccessToken();
              if (refreshed) {
                return this.request<T>(endpoint, { ...options, _isRetry: true });
              }
            }
          }

          // Refresh failed or was already retried → session expired
          this.handleSessionExpired();
          throw new Error(
            isTokenExpired
              ? 'Your session has expired. Please sign in again.'
              : 'Your session is invalid. Please sign in again.'
          );
        }
        if (response.status === 429) {
          throw new Error('Too many attempts. Please wait a moment and try again.');
        }
        if (response.status === 500) {
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
        const currentController = this.activeControllers.get(cancelKey);
        if (currentController === abortController) {
          this.activeControllers.delete(cancelKey);
        }
        aborted = true;
        return undefined as T;
      }

      // Handle network errors (connection refused, timeout, etc.)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        captureException(error, {
          requestId: requestId || undefined,
          route: endpoint,
          extra: {
            method,
            status: statusCode,
            networkError: true,
          },
        });

        const isDevelopment = import.meta.env.DEV;
        const msg = isDevelopment
          ? "We couldn't connect to the server. Please ensure the backend server is running on port 5000."
          : "We couldn't connect to the server. Please check your internet connection and try again.";
        const networkErr = new Error(msg) as Error & { isNetworkError: boolean; response?: undefined };
        networkErr.isNetworkError = true;
        throw networkErr;
      }

      // Capture API errors (non-network) in Sentry
      if (statusCode && statusCode >= 500) {
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

      // Re-throw other errors as-is
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
