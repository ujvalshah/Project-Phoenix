/**
 * Sentry SDK implementation chunk — `@sentry/*` loads only via dynamic import from `sentry.ts`.
 * Do not import this module statically from startup-critical paths.
 */

import * as Sentry from '@sentry/react';
import type { Integration } from '@sentry/core';

let initAttempted = false;

function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/**
 * Initialize Sentry if DSN is provided (same env rules as legacy `sentry.ts`).
 */
export function initSentryImpl(): void {
  if (initAttempted) return;
  initAttempted = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.MODE || 'development';
  const release =
    import.meta.env.VITE_SENTRY_RELEASE ||
    import.meta.env.VITE_RELEASE ||
    undefined;

  if (!dsn) {
    console.warn('[Sentry] DSN not provided, error tracking disabled');
    return;
  }

  if (environment === 'development' && import.meta.env.VITE_SENTRY_ENABLE_DEV !== 'true') {
    return;
  }

  const replaysSessionSampleRate = parseSampleRate(
    import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
    environment === 'production' ? 0 : 0.1,
  );
  const replaysOnErrorSampleRate = parseSampleRate(
    import.meta.env.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
    1,
  );

  const integrations: Integration[] = [
    Sentry.browserTracingIntegration(),
    ...(replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0
      ? [
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ]
      : []),
  ];

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    integrations,
    beforeSend(event, _hint) {
      if (event.request) {
        if (event.request.headers) {
          const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
          sensitiveHeaders.forEach((header) => {
            if (event.request?.headers?.[header]) {
              event.request.headers[header] = '[REDACTED]';
            }
          });
        }
        if ('cookies' in event.request && event.request.cookies !== undefined) {
          delete event.request.cookies;
        }
      }

      if (environment === 'development' && import.meta.env.VITE_SENTRY_ENABLE_DEV !== 'true') {
        return null;
      }

      return event;
    },
  });
}

export function captureExceptionImpl(
  error: Error,
  context?: {
    requestId?: string;
    route?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
): void {
  initSentryImpl();
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

export function captureMessageImpl(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: {
    requestId?: string;
    route?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
): void {
  initSentryImpl();
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
