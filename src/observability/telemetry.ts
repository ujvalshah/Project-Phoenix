// Passive observability hooks for future instrumentation.
// These functions do not send data anywhere; consumers can register handlers later.

import type React from 'react';
import { captureException } from '../utils/sentry';
import {
  ensureActiveSearchQueryId,
  endActiveSearchDraft,
  forceNewSearchQueryId,
  getCommittedSearchQueryId,
  getSearchSessionId,
  markSearchCommitted,
  peekActiveSearchQueryId,
  resetSearchTelemetryForAbandon,
} from './searchTelemetryIds';

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

export interface SearchEvent {
  name:
    | 'search_opened'
    | 'search_query_changed'
    | 'search_suggestions_requested'
    | 'search_suggestions_loaded'
    | 'search_suggestion_selected'
    | 'search_submitted'
    | 'search_request_started'
    | 'search_request_succeeded'
    | 'search_request_failed'
    | 'search_results_rendered'
    | 'search_result_clicked'
    | 'search_filter_applied'
    | 'search_zero_results'
    | 'search_query_reformulated'
    | 'search_abandoned';
  payload: Record<string, unknown>;
}

type Handlers = {
  onError?: (ctx: ErrorContext) => void;
  onApiTiming?: (timing: ApiTiming) => void;
  onPageMark?: (mark: PageMark) => void;
  onSearchEvent?: (event: SearchEvent) => void;
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

function resolveSearchQueryId(name: SearchEvent['name'], payload: Record<string, unknown>): string | undefined {
  if (typeof payload.searchQueryId === 'string' && payload.searchQueryId.length > 0) {
    return payload.searchQueryId;
  }

  const committed = getCommittedSearchQueryId();

  switch (name) {
    case 'search_request_started':
    case 'search_request_succeeded':
    case 'search_request_failed':
    case 'search_results_rendered':
    case 'search_zero_results':
      return committed ?? ensureActiveSearchQueryId();

    case 'search_result_clicked':
      return committed ?? peekActiveSearchQueryId() ?? ensureActiveSearchQueryId();

    case 'search_submitted':
      return markSearchCommitted();

    case 'search_abandoned': {
      const id = peekActiveSearchQueryId() ?? committed ?? undefined;
      resetSearchTelemetryForAbandon();
      return id;
    }

    case 'search_opened':
      return payload.forceNewQueryTrace === true ? forceNewSearchQueryId() : ensureActiveSearchQueryId();

    case 'search_query_changed':
    case 'search_suggestions_requested':
    case 'search_suggestions_loaded':
    case 'search_suggestion_selected':
    case 'search_query_reformulated':
    case 'search_filter_applied':
      return ensureActiveSearchQueryId();

    default:
      return ensureActiveSearchQueryId();
  }
}

/** Used by HomePage after a committed search renders — see searchTelemetryIds. */
export { endActiveSearchDraft };

export function recordSearchEvent(event: SearchEvent) {
  const raw: Record<string, unknown> = { ...event.payload };
  const searchQueryId = resolveSearchQueryId(event.name, raw);
  delete raw.forceNewQueryTrace;

  const merged: SearchEvent = {
    name: event.name,
    payload: {
      searchSessionId: getSearchSessionId(),
      ...(searchQueryId ? { searchQueryId } : {}),
      ...raw,
    },
  };

  handlers.onSearchEvent?.(merged);
  // Keep lightweight local signal for development and QA traces.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nuggets:search-event', { detail: merged }));
  }
}







