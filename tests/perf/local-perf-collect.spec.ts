/**
 * Automated local perf collection — reads `window.__DEV_PERF_RESULTS__` from dev builds
 * (`__NUGGETS_DEV_PERF_MARKS__` must be true — default in `vite dev`).
 *
 * Run: npm run perf:collect
 *
 * Multi-run (default 3): set PERF_COLLECT_RUNS (e.g. `cross-env PERF_COLLECT_RUNS=5 npm run perf:collect`).
 * Each run uses fresh browser contexts: desktop (idle + bell + auth) → storageState → mobile (nav, search, filter).
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { establishBrowserAuthSession } from '../e2e/helpers/browser-auth';

const BASE_URL = process.env.PLAYWRIGHT_WEB_ORIGIN || 'http://localhost:3000';

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

function requestedRunCount(): number {
  const raw = process.env.PERF_COLLECT_RUNS;
  const n = raw !== undefined ? Number.parseInt(raw, 10) : 3;
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(n, 20);
}

const KEYS = {
  initialIdle: 'initial-idle-settled',
  bell: 'bell-dropdown-first-open',
  nav: 'nav-drawer-first-open',
  search: 'mobile-search-overlay-first-open',
  filter: 'mobile-filter-sheet-first-open',
} as const;

const ALL_METRIC_KEYS = [
  KEYS.initialIdle,
  KEYS.bell,
  KEYS.nav,
  KEYS.search,
  KEYS.filter,
] as const;

type MetricValue =
  | {
      duration: number;
      status: 'ok';
      /** Present for metrics that attach dev perf `meta` (e.g. mobile search stage breakdown). */
      meta?: Record<string, string | number | boolean>;
    }
  | { status: 'missing'; reason?: string }
  | { status: 'skipped'; reason: string };

type SingleRunReport = {
  runIndex: number;
  runAt: string;
  desktop: Record<string, MetricValue>;
  mobile: Record<string, MetricValue>;
  notes: string[];
};

type MetricSummary = {
  median: number | null;
  min: number | null;
  max: number | null;
  countOk: number;
  countSkipped: number;
  countMissing: number;
};

type AggregateReport = {
  baseUrl: string;
  runCount: number;
  requestedRuns: number;
  viewport: {
    desktop: typeof DESKTOP_VIEWPORT;
    mobile: typeof MOBILE_VIEWPORT & { hasTouch: boolean };
  };
  notes: string[];
  runs: SingleRunReport[];
  summary: Record<string, MetricSummary>;
};

function ok(duration: number): { duration: number; status: 'ok' } {
  return { duration, status: 'ok' as const };
}

function missing(reason?: string): { status: 'missing'; reason?: string } {
  return reason !== undefined ? { status: 'missing' as const, reason } : { status: 'missing' as const };
}

function skipped(reason: string): { status: 'skipped'; reason: string } {
  return { status: 'skipped' as const, reason };
}

function medianSorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function buildSummary(runs: SingleRunReport[]): Record<string, MetricSummary> {
  const summary: Record<string, MetricSummary> = {};

  for (const key of ALL_METRIC_KEYS) {
    const durations: number[] = [];
    let countOk = 0;
    let countSkipped = 0;
    let countMissing = 0;

    for (const run of runs) {
      const bucket = key === KEYS.initialIdle || key === KEYS.bell ? run.desktop : run.mobile;
      const v = bucket[key];
      if (!v) {
        countMissing += 1;
        continue;
      }
      if (v.status === 'ok') {
        countOk += 1;
        durations.push(v.duration);
      } else if (v.status === 'skipped') {
        countSkipped += 1;
      } else {
        countMissing += 1;
      }
    }

    durations.sort((a, b) => a - b);
    summary[key] = {
      median: medianSorted(durations),
      min: durations.length ? durations[0]! : null,
      max: durations.length ? durations[durations.length - 1]! : null,
      countOk,
      countSkipped,
      countMissing,
    };
  }

  return summary;
}

async function waitForPerfKey(
  page: Page,
  key: string,
  timeoutMs = 25_000,
  options?: { requiredMetaKeys?: string[] },
): Promise<{
  duration: number;
  status: 'ok';
  meta?: Record<string, string | number | boolean>;
} | null> {
  const requiredMetaKeys = options?.requiredMetaKeys ?? [];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const entry = await page.evaluate(
      ({ k, metaKeys }: { k: string; metaKeys: string[] }) => {
        const w = window as Window & {
          __DEV_PERF_RESULTS__?: Record<
            string,
            {
              duration?: number;
              status?: string;
              meta?: Record<string, string | number | boolean>;
            }
          >;
        };
        const r = w.__DEV_PERF_RESULTS__?.[k];
        if (r?.status === 'ok' && typeof r.duration === 'number') {
          if (
            metaKeys.length > 0 &&
            (!r.meta || metaKeys.some((mk) => r.meta![mk] === undefined))
          ) {
            return null;
          }
          return { duration: r.duration, status: 'ok' as const, meta: r.meta };
        }
        return null;
      },
      { k: key, metaKeys: requiredMetaKeys },
    );
    if (entry) return entry;
    await page.waitForTimeout(80);
  }
  return null;
}

async function freshHome(p: Page): Promise<void> {
  await p.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await p.waitForTimeout(600);
}

/**
 * One isolated measurement pass: new desktop context → auth → bell; new mobile context with that storage → nav, search, filter.
 */
async function collectSingleRun(browser: Browser, runIndex: number): Promise<SingleRunReport> {
  const runNotes: string[] = [];
  const desktop: SingleRunReport['desktop'] = {
    [KEYS.initialIdle]: missing('not observed yet'),
    [KEYS.bell]: missing('not observed yet'),
  };
  const mobile: SingleRunReport['mobile'] = {
    [KEYS.nav]: missing('not observed yet'),
    [KEYS.search]: missing('not observed yet'),
    [KEYS.filter]: missing('not observed yet'),
  };

  const desktopContext = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
  });
  const page = await desktopContext.newPage();
  let desktopClosed = false;

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });

    const idle = await waitForPerfKey(page, KEYS.initialIdle, 12_000);
    if (idle) {
      desktop[KEYS.initialIdle] = ok(idle.duration);
    } else {
      desktop[KEYS.initialIdle] = missing('not observed within 12s (dev server slow or perf marks off?)');
      runNotes.push(
        `[run ${runIndex}] initial-idle-settled not observed within 12s (dev server slow or perf marks off?)`,
      );
    }

    const authOk = await establishBrowserAuthSession(page);
    if (!authOk) {
      runNotes.push(
        `[run ${runIndex}] establishBrowserAuthSession failed — bell skipped (optional TEST_USER_EMAIL/PASSWORD)`,
      );
      desktop[KEYS.bell] = skipped('auth failed or Create button not visible');
    } else {
      await page.getByRole('button', { name: /^Notifications/ }).click();
      const bell = await waitForPerfKey(page, KEYS.bell, 25_000);
      if (bell) {
        desktop[KEYS.bell] = ok(bell.duration);
      } else {
        desktop[KEYS.bell] = skipped('measure missing after bell click');
      }
    }

    const storage = await desktopContext.storageState();
    await desktopContext.close();
    desktopClosed = true;

    const mobileContext = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      hasTouch: true,
      storageState: storage,
    });
    const mp = await mobileContext.newPage();

    try {
      await freshHome(mp);
      await mp.getByRole('button', { name: 'Open Menu' }).click();
      const nav = await waitForPerfKey(mp, KEYS.nav, 25_000);
      if (nav) {
        mobile[KEYS.nav] = ok(nav.duration);
      } else {
        mobile[KEYS.nav] = missing('not observed within 25s after Open Menu');
      }

      await freshHome(mp);
      await mp.locator('header').getByRole('button', { name: 'Search' }).first().click();
      const search = await waitForPerfKey(mp, KEYS.search, 25_000, {
        requiredMetaKeys: ['ms_trigger_to_interactive'],
      });
      if (search) {
        mobile[KEYS.search] = {
          duration: search.duration,
          status: 'ok',
          ...(search.meta ? { meta: search.meta } : {}),
        };
      } else {
        mobile[KEYS.search] = missing('not observed within 25s after Search click');
      }

      await freshHome(mp);
      await mp.getByTestId('header-mobile-filter-button').click();
      const filter = await waitForPerfKey(mp, KEYS.filter, 25_000);
      if (filter) {
        mobile[KEYS.filter] = ok(filter.duration);
      } else {
        mobile[KEYS.filter] = missing('not observed within 25s after filter button click');
      }
    } finally {
      await mobileContext.close();
    }
  } catch (e) {
    if (!desktopClosed) {
      await desktopContext.close().catch(() => {});
    }
    runNotes.push(`[run ${runIndex}] unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }

  return {
    runIndex,
    runAt: new Date().toISOString(),
    desktop,
    mobile,
    notes: runNotes,
  };
}

function writeOutputs(report: AggregateReport): void {
  const outDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'perf-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  const csvPath = path.join(outDir, 'perf-results.csv');
  const lines = ['run_index,section,metric,duration_ms,status,reason,meta_json'];
  const push = (runIndex: number, section: string, metric: string, v: MetricValue) => {
    const d = 'duration' in v && typeof v.duration === 'number' ? String(v.duration) : '';
    let reason = '';
    if (v.status === 'skipped') reason = v.reason;
    else if (v.status === 'missing' && 'reason' in v && v.reason) reason = v.reason;
    reason = reason.replace(/,/g, ';');
    const metaJson =
      v.status === 'ok' && 'meta' in v && v.meta
        ? JSON.stringify(v.meta).replace(/,/g, ';')
        : '';
    lines.push(`${runIndex},${section},${metric},${d},${v.status},${reason},${metaJson}`);
  };

  for (const run of report.runs) {
    for (const [k, v] of Object.entries(run.desktop)) push(run.runIndex, 'desktop', k, v);
    for (const [k, v] of Object.entries(run.mobile)) push(run.runIndex, 'mobile', k, v);
  }

  fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
}

test.describe('local perf collect', () => {
  test('write output/perf-results.json and .csv (multi-run)', async ({ browser }) => {
    const requestedRuns = requestedRunCount();
    const globalNotes: string[] = [
      `Requested ${requestedRuns} run(s); each run uses fresh desktop then fresh mobile browser contexts.`,
      `Mobile reuses the same run's authenticated storageState (no cross-run page reuse).`,
      `Viewport: desktop ${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}, mobile ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height} hasTouch=true.`,
    ];

    const perfRunsRaw = process.env.PERF_COLLECT_RUNS;
    if (perfRunsRaw !== undefined) {
      const parsed = Number.parseInt(perfRunsRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
        globalNotes.push(
          `PERF_COLLECT_RUNS="${perfRunsRaw}" normalized to ${requestedRuns} (valid range: 1–20).`,
        );
      }
    }

    const runs: SingleRunReport[] = [];

    for (let i = 0; i < requestedRuns; i++) {
      const run = await collectSingleRun(browser, i);
      runs.push(run);
      globalNotes.push(...run.notes);
    }

    const summary = buildSummary(runs);

    const report: AggregateReport = {
      baseUrl: BASE_URL,
      runCount: runs.length,
      requestedRuns,
      viewport: {
        desktop: { ...DESKTOP_VIEWPORT },
        mobile: { ...MOBILE_VIEWPORT, hasTouch: true },
      },
      notes: globalNotes,
      runs,
      summary,
    };

    writeOutputs(report);

    expect(fs.existsSync(path.join(process.cwd(), 'output', 'perf-results.json'))).toBeTruthy();
    expect(fs.existsSync(path.join(process.cwd(), 'output', 'perf-results.csv'))).toBeTruthy();
  });
});
