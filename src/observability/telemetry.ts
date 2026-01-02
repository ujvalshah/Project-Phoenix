// Passive observability hooks for future instrumentation.
// These functions do not send data anywhere; consumers can register handlers later.

import type React from 'react';
import { captureException, captureMessage } from '../utils/sentry';

export interface ErrorContext {
  error: Error;
  info?: React.ErrorInfo;
  source?: string;
}

export interface ApiTiming {
  endpoint: string;
  method: string;
  status?: number;
  durationMs: number;
  ok: boolean;
}

export interface PageMark {
  name: string;
  detail?: Record<string, any>;
}

type Handlers = {
  onError?: (ctx: ErrorContext) => void;
  onApiTiming?: (timing: ApiTiming) => void;
  onPageMark?: (mark: PageMark) => void;
  slowThresholdMs?: number;
};

const handlers: Handlers = {};
const DEFAULT_SLOW_MS = 1200;

export function configureTelemetry(next: Handlers) {
  Object.assign(handlers, next);
}

export function recordError(ctx: ErrorContext) {
  // Automatically send to Sentry
  captureException(ctx.error, {
    route: window.location.pathname,
    extra: {
      source: ctx.source,
      componentStack: ctx.info?.componentStack,
    },
  });
  
  // Call custom handlers if registered
  handlers.onError?.(ctx);
}

export function recordApiTiming(timing: ApiTiming) {
  const threshold = handlers.slowThresholdMs ?? DEFAULT_SLOW_MS;
  if (timing.durationMs >= threshold) {
    handlers.onApiTiming?.(timing);
  }
}

export function markPagePerformance(mark: PageMark) {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(`app:${mark.name}`);
  }
  handlers.onPageMark?.(mark);
}








