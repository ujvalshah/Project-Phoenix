/**
 * Sentry façade — no `@sentry/*` static imports here.
 * The real SDK lives in `sentryBootstrap.ts` and loads in a separate async chunk.
 *
 * Startup path: AuthContext / apiClient / telemetry import **this file only** (lightweight).
 */

export function initSentry(): void {
  void import('./sentryBootstrap.js').then((m) => {
    m.initSentryImpl();
  });
}

export function captureException(
  error: Error,
  context?: {
    requestId?: string;
    route?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
): void {
  try {
    void import('./sentryBootstrap.js').then((m) => {
      m.captureExceptionImpl(error, context);
    });
  } catch {
    /* capture must never throw into callers */
  }
}

export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: {
    requestId?: string;
    route?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
): void {
  try {
    void import('./sentryBootstrap.js').then((m) => {
      m.captureMessageImpl(message, level, context);
    });
  } catch {
    /* capture must never throw into callers */
  }
}
