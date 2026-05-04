import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.PLAYWRIGHT_WEB_ORIGIN || 'http://localhost:3000';
const TARGET_URL = process.env.PERF_LH_TARGET_URL || `${BASE_URL}/`;
const RUNS = Math.max(3, Number.parseInt(process.env.PERF_LH_RUNS ?? '3', 10) || 3);
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'home-feed-cwv-gates.json');

type LighthouseRun = {
  runIndex: number;
  lcpMs: number;
  cls: number;
  performanceScore: number | null;
};

type NumericSummary = {
  median: number;
  min: number;
  max: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function summarize(values: number[]): NumericSummary {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: median(sorted),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

function runLighthouse(outputFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--yes',
      'lighthouse@12',
      TARGET_URL,
      '--only-categories=performance',
      '--output=json',
      `--output-path=${outputFile}`,
      '--form-factor=mobile',
      '--screenEmulation.mobile',
      '--quiet',
      '--disable-full-page-screenshot',
      '--max-wait-for-load=90000',
      '--throttling-method=provided',
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
    ];
    const child = spawn('npx', args, { stdio: 'pipe', shell: process.platform === 'win32' });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Lighthouse failed with code ${String(code)}: ${stderr}`));
    });
  });
}

function readPrevCurrent(): { lcpMedianMs: number; clsMedian: number } | null {
  if (!fs.existsSync(OUTPUT_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8')) as {
      current?: { lcpMedianMs?: number; clsMedian?: number };
    };
    if (
      typeof raw.current?.lcpMedianMs === 'number' &&
      typeof raw.current?.clsMedian === 'number'
    ) {
      return { lcpMedianMs: raw.current.lcpMedianMs, clsMedian: raw.current.clsMedian };
    }
  } catch {
    // Ignore previous parse failures; new report is still useful.
  }
  return null;
}

test.describe('home feed CWV gates (Lighthouse median)', () => {
  test('enforces LCP<=2500ms and CLS<=0.1 (CLS<=0.05 warning)', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Lighthouse CWV gate is Chromium-only.');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const runs: LighthouseRun[] = [];

    for (let i = 0; i < RUNS; i += 1) {
      const file = path.join(OUTPUT_DIR, `lh-home-feed-run-${String(i + 1)}.json`);
      await runLighthouse(file);
      const report = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
        categories?: { performance?: { score?: number | null } };
        audits?: {
          'largest-contentful-paint'?: { numericValue?: number };
          'cumulative-layout-shift'?: { numericValue?: number };
        };
      };
      const lcpMs = report.audits?.['largest-contentful-paint']?.numericValue;
      const cls = report.audits?.['cumulative-layout-shift']?.numericValue;
      if (typeof lcpMs !== 'number' || typeof cls !== 'number') {
        throw new Error('Missing Lighthouse LCP/CLS audit values.');
      }
      runs.push({
        runIndex: i + 1,
        lcpMs: Math.round(lcpMs),
        cls: Number(cls.toFixed(4)),
        performanceScore:
          typeof report.categories?.performance?.score === 'number'
            ? Number((report.categories.performance.score * 100).toFixed(1))
            : null,
      });
    }

    const lcp = summarize(runs.map((r) => r.lcpMs));
    const cls = summarize(runs.map((r) => r.cls));
    const before = readPrevCurrent();
    const current = {
      lcpMedianMs: Math.round(lcp.median),
      clsMedian: Number(cls.median.toFixed(4)),
      lcpRangeMs: { min: lcp.min, max: lcp.max },
      clsRange: { min: Number(cls.min.toFixed(4)), max: Number(cls.max.toFixed(4)) },
      runCount: runs.length,
      gates: {
        lcpHardPass: Math.round(lcp.median) <= 2500,
        clsHardPass: cls.median <= 0.1,
        clsStretchPass: cls.median <= 0.05,
      },
    };

    const payload = {
      runAt: new Date().toISOString(),
      targetUrl: TARGET_URL,
      hardGates: {
        lcpMedianMsMax: 2500,
        clsMedianMax: 0.1,
      },
      warningTargets: {
        clsMedianTarget: 0.05,
      },
      before,
      after: current,
      runs,
      notes: [
        'Median is used across repeated Lighthouse runs.',
        'LCP and CLS are hard gates; CLS <= 0.05 is warning/stretch only.',
      ],
    };

    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

    expect(current.gates.lcpHardPass, `LCP median ${String(current.lcpMedianMs)}ms > 2500ms`).toBeTruthy();
    expect(current.gates.clsHardPass, `CLS median ${String(current.clsMedian)} > 0.1`).toBeTruthy();
  });
});
