/**
 * Frontend Sentry Error Tracking Configuration
 * 
 * Initializes Sentry for frontend error tracking
 * Captures runtime errors, React error boundaries, and failed API calls
 */

import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry if DSN is provided
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.MODE || 'development';

  if (!dsn) {
    console.warn('[Sentry] DSN not provided, error tracking disabled');
    return;
  }

  // Disable in development unless explicitly enabled
  if (environment === 'development' && import.meta.env.VITE_SENTRY_ENABLE_DEV !== 'true') {
    console.log('[Sentry] Disabled in development mode');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event, hint) {
      // Sanitize sensitive data
      if (event.request) {
        if (event.request.headers) {
          const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
          sensitiveHeaders.forEach((header) => {
            if (event.request?.headers?.[header]) {
              event.request.headers[header] = '[REDACTED]';
            }
          });
        }
        if (event.request.cookies) {
          event.request.cookies = '[REDACTED]';
        }
      }

      // Don't send errors in development unless explicitly enabled
      if (environment === 'development' && import.meta.env.VITE_SENTRY_ENABLE_DEV !== 'true') {
        return null;
      }

      return event;
    },
  });

  console.log('[Sentry] Initialized for error tracking');
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: {
  requestId?: string;
  route?: string;
  userId?: string;
  extra?: Record<string, any>;
}) {
  Sentry.withScope((scope) => {
    if (context?.requestId) {
      scope.setTag('requestId', context.requestId);
    }
    if (context?.route) {
      scope.setTag('route', context.route);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture message with context
 */
export function captureMessage(message: string, level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info', context?: {
  requestId?: string;
  route?: string;
  userId?: string;
  extra?: Record<string, any>;
}) {
  Sentry.withScope((scope) => {
    if (context?.requestId) {
      scope.setTag('requestId', context.requestId);
    }
    if (context?.route) {
      scope.setTag('route', context.route);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureMessage(message, level);
  });
}

