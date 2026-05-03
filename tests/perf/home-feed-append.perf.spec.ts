import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.PLAYWRIGHT_WEB_ORIGIN || 'http://localhost:3000';
const APPEND_MEASURE_NAME = 'feed-append-duration';
const HOME_FEED_REQUEST_ALIAS = 'home-feed-page';
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'home-feed-append-perf-results.json');
const TRACE_PATH = path.join(OUTPUT_DIR, 'home-feed-append-trace.zip');

type FeedRequestStat = {
  key: string;
  page: number | null;
  count: number;
};

function requestedAppendCycles(): number {
  const raw = process.env.PERF_HOME_APPEND_CYCLES;
  const n = raw !== undefined ? Number.parseInt(raw, 10) : 7;
  if (!Number.isFinite(n)) return 7;
  return Math.max(5, Math.min(10, n));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function p95(values: number[]): number | null {
  if (values.length < 2) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx] ?? null;
}

function stableSearchParams(searchParams: URLSearchParams): string {
  const pairs = [...searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

function isHomeFeedPageRequest(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!url.pathname.endsWith('/articles')) return false;
    if (url.pathname.includes('/collections/')) return false;
    if (url.searchParams.has('authorId')) return false;
    if (!url.searchParams.get('page')) return false;
    if (!url.searchParams.get('limit')) return false;
    return true;
  } catch {
    return false;
  }
}

function feedRequestKey(urlString: string): { key: string; page: number | null } {
  const url = new URL(urlString);
  const pageRaw = url.searchParams.get('page');
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : null;
  const query = stableSearchParams(url.searchParams);
  return {
    key: `${url.pathname}?${query}`,
    page: Number.isFinite(page ?? Number.NaN) ? page : null,
  };
}

test.describe('home feed append perf harness', () => {
  test('collects append, longtask, and feed-request metrics', async ({ browserName, context, page }) => {
    test.skip(browserName !== 'chromium', 'Perf harness is Chromium-only.');

    const targetCycles = requestedAppendCycles();
    const shouldCaptureTrace = process.env.PERF_HOME_APPEND_TRACE === '1';
    const maxScrollAttempts = Number.parseInt(process.env.PERF_HOME_APPEND_MAX_SCROLLS ?? '90', 10) || 90;

    if (shouldCaptureTrace) {
      await context.tracing.start({ screenshots: false, snapshots: true });
    }

    await page.addInitScript(() => {
      (window as Window & { __FEED_APPEND_LONGTASK__?: { totalBlockingTimeMs: number; count: number } })
        .__FEED_APPEND_LONGTASK__ = { totalBlockingTimeMs: 0, count: 0 };

      if (!('PerformanceObserver' in window)) return;
      try {
        const observer = new PerformanceObserver((list) => {
          const metrics = (window as Window & { __FEED_APPEND_LONGTASK__?: { totalBlockingTimeMs: number; count: number } })
            .__FEED_APPEND_LONGTASK__;
          if (!metrics) return;
          for (const entry of list.getEntries()) {
            const blocking = Math.max(0, entry.duration - 50);
            metrics.totalBlockingTimeMs += blocking;
            metrics.count += 1;
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch {
        // no-op: unsupported in current runtime
      }
    });

    const requestCounts = new Map<string, number>();
    const pageCounts = new Map<number, number>();
    let feedPageRequests = 0;

    const onFeedRequest = (urlString: string): void => {
      if (!isHomeFeedPageRequest(urlString)) return;
      const { key, page } = feedRequestKey(urlString);
      feedPageRequests += 1;
      requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
      if (page !== null) {
        pageCounts.set(page, (pageCounts.get(page) ?? 0) + 1);
      }
    };

    page.on('requestfinished', (request) => {
      onFeedRequest(request.url());
    });
    page.on('requestfailed', (request) => {
      onFeedRequest(request.url());
    });

    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.locator('[data-article-id]').first().waitFor({ state: 'visible', timeout: 60_000 });

      await page.evaluate((measureName) => {
        performance.clearMeasures(measureName);
      }, APPEND_MEASURE_NAME);

      let appendCount = 0;
      let stalledIterations = 0;
      let previousCount = 0;

      for (let i = 0; i < maxScrollAttempts; i += 1) {
        if (appendCount >= targetCycles) break;

        await page.evaluate(() => {
          window.scrollBy({ top: Math.max(window.innerHeight * 0.95, 640), behavior: 'instant' });
        });
        await page.waitForTimeout(350);

        appendCount = await page.evaluate((measureName) => {
          return performance.getEntriesByName(measureName, 'measure').length;
        }, APPEND_MEASURE_NAME);

        if (appendCount === previousCount) {
          stalledIterations += 1;
        } else {
          stalledIterations = 0;
          previousCount = appendCount;
        }

        if (stalledIterations >= 20) break;
      }

      const appendDurationsMs = await page.evaluate((measureName) => {
        return performance
          .getEntriesByName(measureName, 'measure')
          .map((entry) => Math.round(entry.duration))
          .filter((n) => Number.isFinite(n));
      }, APPEND_MEASURE_NAME);

      const longTask = await page.evaluate(() => {
        const metrics = (
          window as Window & { __FEED_APPEND_LONGTASK__?: { totalBlockingTimeMs: number; count: number } }
        ).__FEED_APPEND_LONGTASK__;
        return {
          totalBlockingTimeMs: Math.round(metrics?.totalBlockingTimeMs ?? 0),
          count: metrics?.count ?? 0,
        };
      });

      const requestStats: FeedRequestStat[] = [...requestCounts.entries()]
        .map(([key, count]) => {
          let parsedPage: number | null = null;
          try {
            const [, query = ''] = key.split('?');
            const pageValue = new URLSearchParams(query).get('page');
            const n = pageValue ? Number.parseInt(pageValue, 10) : Number.NaN;
            parsedPage = Number.isFinite(n) ? n : null;
          } catch {
            parsedPage = null;
          }
          return { key, page: parsedPage, count };
        })
        .sort((a, b) => a.key.localeCompare(b.key));

      const duplicateRequestKeys = requestStats.filter((s) => s.count > 1).map((s) => s.key);
      const duplicatePages = [...pageCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => a.page - b.page);

      const report = {
        runAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        browser: browserName,
        targetAppendCycles: targetCycles,
        appendCyclesObserved: appendDurationsMs.length,
        appendDurationsMs,
        averageAppendDurationMs: average(appendDurationsMs),
        p95AppendDurationMs: p95(appendDurationsMs),
        longTask,
        network: {
          alias: HOME_FEED_REQUEST_ALIAS,
          requestCount: feedPageRequests,
          uniqueRequestSignatureCount: requestStats.length,
          requests: requestStats,
          byPage: [...pageCounts.entries()]
            .map(([page, count]) => ({ page, count }))
            .sort((a, b) => a.page - b.page),
          duplicateRequestSuspicion: duplicateRequestKeys.length > 0 || duplicatePages.length > 0,
          duplicateRequestKeys,
          duplicatePages,
        },
        trace: shouldCaptureTrace ? TRACE_PATH : null,
        notes: [
          'append durations come from performance measures named feed-append-duration',
          'network alias uses /articles requests that include page and limit params',
        ],
      };

      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf-8');

      expect(appendDurationsMs.length).toBeGreaterThanOrEqual(Math.min(5, targetCycles));
      expect(fs.existsSync(OUTPUT_JSON)).toBeTruthy();
    } finally {
      if (shouldCaptureTrace) {
        await context.tracing.stop({ path: TRACE_PATH });
      }
    }
  });
});
