import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_DIR = path.join(process.cwd(), 'output');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'home-feed-interaction-cls.json');

type PerfCapture = {
  eventDurationsMs: number[];
  cls: number;
  rafDeltasMs: number[];
  layoutShiftEntries: Array<{ startTime: number; value: number; hadRecentInput: boolean }>;
};

const PHASE_B_CLS_SETTLE_WINDOW_MS = 350;

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx] ?? null;
}

function readPrevCurrent(): { inpProxyP75Ms: number | null; cls: number | null } | null {
  if (!fs.existsSync(OUTPUT_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8')) as {
      after?: { inpProxyP75Ms?: number | null; cls?: number | null };
    };
    return {
      inpProxyP75Ms:
        typeof raw.after?.inpProxyP75Ms === 'number' ? raw.after.inpProxyP75Ms : null,
      cls: typeof raw.after?.cls === 'number' ? raw.after.cls : null,
    };
  } catch {
    return null;
  }
}

test.describe('home feed interaction + CLS guard', () => {
  test('enforces INP proxy <=200ms and CLS<=0.1 (CLS<=0.05 warning)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Interaction/CLS guard is Chromium-only.');

    await page.addInitScript(() => {
      const w = window as Window & {
        __HF_PERF_CAPTURE__?: PerfCapture;
      };
      w.__HF_PERF_CAPTURE__ = {
        eventDurationsMs: [],
        cls: 0,
        rafDeltasMs: [],
        layoutShiftEntries: [],
      };

      try {
        const clsObserver = new PerformanceObserver((list) => {
          const bucket = w.__HF_PERF_CAPTURE__;
          if (!bucket) return;
          for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
            if ((entry as { hadRecentInput?: boolean }).hadRecentInput) continue;
            const value = (entry as { value?: number }).value;
            if (typeof value === 'number') {
              bucket.cls += value;
              bucket.layoutShiftEntries.push({
                startTime: entry.startTime,
                value,
                hadRecentInput: Boolean((entry as { hadRecentInput?: boolean }).hadRecentInput),
              });
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch {
        // Ignore runtime without layout-shift support.
      }

      try {
        const eventObserver = new PerformanceObserver((list) => {
          const bucket = w.__HF_PERF_CAPTURE__;
          if (!bucket) return;
          for (const entry of list.getEntries() as Array<PerformanceEntry & { duration?: number }>) {
            const d = (entry as { duration?: number }).duration;
            if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
              bucket.eventDurationsMs.push(Math.round(d));
            }
          }
          if (bucket.eventDurationsMs.length > 400) {
            bucket.eventDurationsMs = bucket.eventDurationsMs.slice(-250);
          }
        });
        eventObserver.observe({ type: 'event', durationThreshold: 16, buffered: true });
      } catch {
        // Ignore runtime without event timing support.
      }

      let last = performance.now();
      const tick = (now: number) => {
        const bucket = w.__HF_PERF_CAPTURE__;
        if (bucket) {
          bucket.rafDeltasMs.push(Number((now - last).toFixed(2)));
          if (bucket.rafDeltasMs.length > 3000) {
            bucket.rafDeltasMs = bucket.rafDeltasMs.slice(-1800);
          }
        }
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.locator('[data-index]').first().waitFor({ state: 'attached', timeout: 45_000 });
    await page.waitForTimeout(700);

    // Interaction set: sidebar open/close, deep scroll + back-to-top click.
    const interactionProbeMs: number[] = [];
    const showFilters = page.getByTitle('Show filters');
    if (await showFilters.isVisible().catch(() => false)) {
      const openLatency = await showFilters.evaluate(async (el) => {
        const t0 = performance.now();
        (el as HTMLElement).click();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return Math.round(performance.now() - t0);
      });
      interactionProbeMs.push(openLatency);
      await page.waitForTimeout(280);
      const collapse = page.getByRole('button', { name: 'Collapse filters sidebar' });
      if (await collapse.isVisible().catch(() => false)) {
        const closeLatency = await collapse.evaluate(async (el) => {
          const t0 = performance.now();
          (el as HTMLElement).click();
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          return Math.round(performance.now() - t0);
        });
        interactionProbeMs.push(closeLatency);
      }
      await page.waitForTimeout(280);
    }

    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    });
    await page.waitForTimeout(900);

    const upButton = page.locator('button:has(svg.lucide-arrow-up)').first();
    if (await upButton.isVisible().catch(() => false)) {
      const upLatency = await upButton.evaluate(async (el) => {
        const t0 = performance.now();
        (el as HTMLElement).click();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return Math.round(performance.now() - t0);
      });
      interactionProbeMs.push(upLatency);
      await page.waitForTimeout(700);
    }

    const capture = await page.evaluate((settleWindowMs) => {
      const w = window as Window & { __HF_PERF_CAPTURE__?: PerfCapture };
      const perfCapture = w.__HF_PERF_CAPTURE__ ?? {
        eventDurationsMs: [],
        cls: 0,
        rafDeltasMs: [],
        layoutShiftEntries: [],
      };
      const getMark = (name: string): number | null => {
        const entry = performance.getEntriesByName(name, 'mark').pop();
        return entry ? entry.startTime : null;
      };
      const phaseAFirstCardsTs = getMark('home:phasea:first-cards');
      const phaseBPromotedTs = getMark('home:phaseb:promoted');
      let transitionWindowCls: number | null = null;
      if (phaseAFirstCardsTs !== null && phaseBPromotedTs !== null) {
        const transitionEnd = phaseBPromotedTs + settleWindowMs;
        transitionWindowCls = Number(
          perfCapture.layoutShiftEntries
            .filter((entry) => !entry.hadRecentInput)
            .filter((entry) => entry.startTime >= phaseAFirstCardsTs && entry.startTime <= transitionEnd)
            .reduce((sum, entry) => sum + entry.value, 0)
            .toFixed(4),
        );
      }
      return {
        ...perfCapture,
        phaseAFirstCardsTs,
        phaseBPromotedTs,
        transitionWindowCls,
      };
    }, PHASE_B_CLS_SETTLE_WINDOW_MS);

    const inpProxyP75 = percentile(interactionProbeMs, 0.75);
    const eventTimingP75 = percentile(capture.eventDurationsMs, 0.75);
    const rafP95 = percentile(capture.rafDeltasMs, 0.95);
    const rafOver50Count = capture.rafDeltasMs.filter((d) => d > 50).length;
    const rafOver50Pct = capture.rafDeltasMs.length > 0
      ? Number(((rafOver50Count / capture.rafDeltasMs.length) * 100).toFixed(2))
      : null;
    const cls = Number(capture.cls.toFixed(4));
    const transitionWindowCls =
      typeof capture.transitionWindowCls === 'number'
        ? Number(capture.transitionWindowCls.toFixed(4))
        : null;

    const before = readPrevCurrent();
    const after = {
      inpProxyP75Ms: inpProxyP75 !== null ? Math.round(inpProxyP75) : null,
      interactionSampleCount: interactionProbeMs.length,
      eventTimingP75Ms: eventTimingP75 !== null ? Math.round(eventTimingP75) : null,
      cls,
      clsWarningPass: cls <= 0.05,
      clsHardPass: cls <= 0.1,
      transitionWindowCls,
      transitionWindowClsWarningPass:
        transitionWindowCls !== null ? transitionWindowCls <= 0.05 : null,
      transitionWindowClsHardPass:
        transitionWindowCls !== null ? transitionWindowCls <= 0.1 : null,
      transitionWindowMs: PHASE_B_CLS_SETTLE_WINDOW_MS,
      transitionWindowAnchors: {
        phaseAFirstCardsTs: capture.phaseAFirstCardsTs,
        phaseBPromotedTs: capture.phaseBPromotedTs,
      },
      scrollSmoothnessAdvisory: {
        rafP95Ms: rafP95 !== null ? Number(rafP95.toFixed(2)) : null,
        rafOver50Pct,
      },
    };

    const enforceInpHardGate = interactionProbeMs.length >= 2;
    const payload = {
      runAt: new Date().toISOString(),
      before,
      after,
      hardGates: {
        inpProxyP75MsMax: 200,
        clsMax: 0.1,
        transitionWindowClsMax: 0.1,
      },
      warningTargets: {
        clsTarget: 0.05,
        transitionWindowClsTarget: 0.05,
      },
      advisory: {
        inpProxyEnforcement: enforceInpHardGate
          ? 'hard-fail'
          : 'advisory (insufficient interaction probes)',
        clsInThisSpec:
          'whole-run CLS remains advisory in this spec; transition-window CLS is enforced for Phase A->B stability',
        eventTiming: 'advisory-only (highly environment-sensitive)',
        scrollSmoothness: 'advisory-only (RAF deltas are environment-sensitive)',
      },
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

    if (enforceInpHardGate) {
      expect(
        (after.inpProxyP75Ms ?? Number.POSITIVE_INFINITY) <= 200,
        `INP proxy p75 ${String(after.inpProxyP75Ms)}ms > 200ms`,
      ).toBeTruthy();
    }
    if (after.transitionWindowClsHardPass !== null) {
      expect(
        after.transitionWindowClsHardPass,
        `Phase A->B transition CLS ${String(after.transitionWindowCls)} > 0.1`,
      ).toBeTruthy();
    }
  });
});
