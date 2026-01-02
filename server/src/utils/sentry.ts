/**
 * Sentry Error Tracking Configuration
 * 
 * Initializes Sentry for backend error tracking
 * Captures uncaught exceptions, unhandled rejections, and Express errors
 */

import * as Sentry from '@sentry/node';
import { getEnv } from '../config/envValidation.js';

// Track whether Sentry was successfully initialized
let sentryInitialized = false;

/**
 * Check if Sentry is enabled and initialized
 */
export function isSentryEnabled(): boolean {
  return sentryInitialized;
}

/**
 * Initialize Sentry if DSN is provided
 * Must be called after validateEnv() has been executed
 */
export function initSentry() {
  const env = getEnv();
  const dsn = env.SENTRY_DSN;

  if (!dsn) {
    console.warn('[Sentry] DSN not provided, error tracking disabled');
    sentryInitialized = false;
    return;
  }

  // Disable in development unless explicitly enabled
  if (env.NODE_ENV === 'development' && !env.SENTRY_ENABLE_DEV) {
    console.log('[Sentry] Disabled in development mode');
    sentryInitialized = false;
    return;
  }

  Sentry.init({
    dsn,
    environment: env.NODE_ENV || 'development',
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    integrations: [
      // Enable HTTP instrumentation
      new Sentry.Integrations.Http({ tracing: true }),
      // Enable Express integration
      new Sentry.Integrations.Express({ app: undefined as any }),
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
      }

      return event;
    },
  });

  sentryInitialized = true;
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

