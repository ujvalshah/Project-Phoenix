import type { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/envValidation.js';

const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

type CounterKey = string;
type HistogramKey = string;

const requestCount = new Map<CounterKey, number>();
const requestDurationBuckets = new Map<HistogramKey, number[]>();
const requestDurationSumMs = new Map<HistogramKey, number>();
const requestDurationCount = new Map<HistogramKey, number>();
const appCounter = new Map<CounterKey, number>();

function toRouteLabel(pathValue: string): string {
  // Normalize high-cardinality IDs in URLs to keep metrics cardinality safe.
  return pathValue
    .replace(/[0-9a-f]{24}/gi, ':id')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

function incrementCount(key: CounterKey): void {
  requestCount.set(key, (requestCount.get(key) ?? 0) + 1);
}

export function incrementAppCounter(name: string, labels?: Record<string, string>): void {
  const normalizedLabels = labels
    ? Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join(',')
    : '';
  const key = normalizedLabels ? `name=${name},${normalizedLabels}` : `name=${name}`;
  appCounter.set(key, (appCounter.get(key) ?? 0) + 1);
}

function observeLatency(key: HistogramKey, durationMs: number): void {
  const buckets = requestDurationBuckets.get(key) ?? Array(LATENCY_BUCKETS_MS.length).fill(0);
  for (let i = 0; i < LATENCY_BUCKETS_MS.length; i += 1) {
    if (durationMs <= LATENCY_BUCKETS_MS[i]) {
      buckets[i] += 1;
    }
  }
  requestDurationBuckets.set(key, buckets);
  requestDurationSumMs.set(key, (requestDurationSumMs.get(key) ?? 0) + durationMs);
  requestDurationCount.set(key, (requestDurationCount.get(key) ?? 0) + 1);
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    const method = req.method;
    const status = String(res.statusCode);
    const route = toRouteLabel(req.path || req.originalUrl || 'unknown');

    incrementCount(`method=${method},route=${route},status=${status}`);
    observeLatency(`method=${method},route=${route}`, durationMs);
  });
  next();
}

export function isMetricsEnabled(): boolean {
  return getEnv().METRICS_ENABLED;
}

export function hasMetricsToken(): boolean {
  const token = getEnv().METRICS_AUTH_TOKEN;
  return typeof token === 'string' && token.trim().length > 0;
}

export function isAuthorizedMetricsRequest(req: Request): boolean {
  const token = getEnv().METRICS_AUTH_TOKEN;
  if (!token || token.trim().length === 0) {
    return true;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  return authHeader.trim() === `Bearer ${token}`;
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];

  lines.push('# HELP http_server_requests_total Count of HTTP requests');
  lines.push('# TYPE http_server_requests_total counter');
  for (const [key, value] of requestCount.entries()) {
    const labels = key
      .split(',')
      .map((entry) => {
        const [labelKey, labelValue] = entry.split('=');
        return `${labelKey}="${labelValue}"`;
      })
      .join(',');
    lines.push(`http_server_requests_total{${labels}} ${value}`);
  }

  lines.push('# HELP http_server_request_duration_ms HTTP request duration in milliseconds');
  lines.push('# TYPE http_server_request_duration_ms histogram');
  for (const [key, bucketValues] of requestDurationBuckets.entries()) {
    const labels = key
      .split(',')
      .map((entry) => {
        const [labelKey, labelValue] = entry.split('=');
        return `${labelKey}="${labelValue}"`;
      })
      .join(',');
    for (let i = 0; i < LATENCY_BUCKETS_MS.length; i += 1) {
      lines.push(`http_server_request_duration_ms_bucket{${labels},le="${LATENCY_BUCKETS_MS[i]}"} ${bucketValues[i] ?? 0}`);
    }
    const count = requestDurationCount.get(key) ?? 0;
    const sum = requestDurationSumMs.get(key) ?? 0;
    lines.push(`http_server_request_duration_ms_bucket{${labels},le="+Inf"} ${count}`);
    lines.push(`http_server_request_duration_ms_sum{${labels}} ${sum.toFixed(3)}`);
    lines.push(`http_server_request_duration_ms_count{${labels}} ${count}`);
  }

  lines.push('# HELP app_events_total Application event counters');
  lines.push('# TYPE app_events_total counter');
  for (const [key, value] of appCounter.entries()) {
    const labels = key
      .split(',')
      .map((entry) => {
        const [labelKey, labelValue] = entry.split('=');
        return `${labelKey}="${labelValue}"`;
      })
      .join(',');
    lines.push(`app_events_total{${labels}} ${value}`);
  }

  return `${lines.join('\n')}\n`;
}
