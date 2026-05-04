import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type RowAudit = {
  index: number;
  top: number;
  bottom: number;
  height: number;
  rowBottomVsDeepestCardBottom: number | null;
};

type Snapshot = {
  label: string;
  scrollY: number;
  measureParentClientWidth: number | null;
  measureParentScrollWidth: number | null;
  firstVisibleRowShellWidth: number | null;
  constrainingWrapperWidth: number | null;
  maxWidthWrapperWidth: number | null;
  virtualListAnchorAbsoluteY: number | null;
  visibleRows: RowAudit[];
  adjacentRowsNonOverlap: boolean;
  horizontalOverflowSamples: Array<{
    tag: string;
    className: string;
    rightDelta: number;
    width: number;
    path: string;
  }>;
};

async function captureSnapshot(
  page: Page,
  label: string,
  includeOverflowSamples = true,
): Promise<Snapshot> {
  const data = await page.evaluate(({ includeOverflow }) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-index]'))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const idx = Number.parseInt(el.getAttribute('data-index') ?? '-1', 10);
        return { el, idx, top: r.top, bottom: r.bottom, height: r.height };
      })
      .filter((x) => x.idx >= 0 && x.bottom > 0 && x.top < window.innerHeight)
      .sort((a, b) => a.idx - b.idx);

    const firstVisible = rows[0]?.el ?? null;
    const shellContainer = firstVisible?.parentElement ?? null;
    const measureParent = shellContainer?.parentElement ?? null;
    const anchor = measureParent?.parentElement ?? null;

    const constrainingWrapper =
      measureParent?.closest<HTMLElement>('.px-4.lg\\:px-6') ??
      measureParent?.closest<HTMLElement>('[class*="px-4"][class*="lg:px-6"]') ??
      null;
    const maxWidthWrapper =
      measureParent?.closest<HTMLElement>('.max-w-\\[1800px\\]') ??
      measureParent?.closest<HTMLElement>('[class*="max-w-[1800px]"]') ??
      null;

    const first3 = rows.slice(0, 3).map((row) => {
      const cards = Array.from(row.el.querySelectorAll<HTMLElement>('[data-article-id]'));
      const deepest = cards.reduce((max, card) => {
        const cr = card.getBoundingClientRect();
        return Math.max(max, cr.bottom);
      }, Number.NEGATIVE_INFINITY);
      return {
        index: row.idx,
        top: Number(row.top.toFixed(2)),
        bottom: Number(row.bottom.toFixed(2)),
        height: Number(row.height.toFixed(2)),
        rowBottomVsDeepestCardBottom: Number.isFinite(deepest)
          ? Number((row.bottom - deepest).toFixed(2))
          : null,
      };
    });

    let adjacentRowsNonOverlap = true;
    for (let i = 1; i < first3.length; i += 1) {
      if (first3[i].top < first3[i - 1].bottom - 1) {
        adjacentRowsNonOverlap = false;
        break;
      }
    }

    const overflowSamples: Array<{
      tag: string;
      className: string;
      rightDelta: number;
      width: number;
      path: string;
    }> = [];
    if (includeOverflow && measureParent) {
      const parentRect = measureParent.getBoundingClientRect();
      const all = Array.from(measureParent.querySelectorAll<HTMLElement>('*')).slice(0, 400);
      for (const el of all) {
        const r = el.getBoundingClientRect();
        const delta = r.right - parentRect.right;
        if (delta > 1) {
          const path = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className ? `.${String(el.className).trim().split(/\s+/).slice(0, 3).join('.')}` : ''}`;
          overflowSamples.push({
            tag: el.tagName.toLowerCase(),
            className: String(el.className).split(/\s+/).slice(0, 6).join(' '),
            rightDelta: Number(delta.toFixed(2)),
            width: Number(r.width.toFixed(2)),
            path,
          });
        }
      }
      overflowSamples.sort((a, b) => b.rightDelta - a.rightDelta);
    }

    return {
      scrollY: Number(window.scrollY.toFixed(2)),
      measureParentClientWidth: measureParent ? measureParent.clientWidth : null,
      measureParentScrollWidth: measureParent ? measureParent.scrollWidth : null,
      firstVisibleRowShellWidth: firstVisible
        ? Number(firstVisible.getBoundingClientRect().width.toFixed(2))
        : null,
      constrainingWrapperWidth: constrainingWrapper
        ? Number(constrainingWrapper.getBoundingClientRect().width.toFixed(2))
        : null,
      maxWidthWrapperWidth: maxWidthWrapper
        ? Number(maxWidthWrapper.getBoundingClientRect().width.toFixed(2))
        : null,
      virtualListAnchorAbsoluteY: anchor
        ? Number((anchor.getBoundingClientRect().top + window.scrollY).toFixed(2))
        : null,
      visibleRows: first3,
      adjacentRowsNonOverlap,
      horizontalOverflowSamples: overflowSamples.slice(0, 12),
    };
  }, { includeOverflow: includeOverflowSamples });

  return { label, ...data };
}

test('forensic: home grid width/geometry contract', async ({ page }) => {
  const snapshots: Snapshot[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'debug') return;
    if (!msg.text().includes('[HomeGridVirtualized]')) return;
    console.log(`[virt-debug] ${msg.text()}`);
  });

  await page.addInitScript(() => {
    localStorage.setItem('NUGGETS_DEV_GRID_VIRT_LOG', '1');
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const emptyHint = page.getByText(/no nuggets/i);
  if (await emptyHint.isVisible({ timeout: 6000 }).catch(() => false)) {
    test.skip(true, 'Empty feed.');
  }

  await page.locator('[data-index]').first().waitFor({ state: 'attached', timeout: 45_000 });
  await expect.poll(async () => page.locator('[data-index]').count(), { timeout: 45_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);

  const beforeToggle = await captureSnapshot(page, 'before-toggle');
  snapshots.push(beforeToggle);
  console.log(`[forensic] ${JSON.stringify(beforeToggle)}`);

  // Page 2+ append snapshot: force deep scroll so newly appended rows mount.
  await page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  });
  await page.waitForTimeout(1600);
  const afterAppendDeepScroll = await captureSnapshot(page, 'after-append-deep-scroll', false);
  snapshots.push(afterAppendDeepScroll);
  console.log(`[forensic] ${JSON.stringify(afterAppendDeepScroll)}`);

  // No-jump guard after append: once user-driven deep scroll settles, idle time
  // should not produce a large spontaneous scroll rebound.
  await page.waitForTimeout(900);
  const afterAppendIdle = await captureSnapshot(page, 'after-append-idle-stability', false);
  snapshots.push(afterAppendIdle);
  console.log(`[forensic] ${JSON.stringify(afterAppendIdle)}`);
  expect(
    Math.abs(afterAppendIdle.scrollY - afterAppendDeepScroll.scrollY),
    'Unexpected scroll rebound after append settle',
  ).toBeLessThanOrEqual(48);

  const showFilters = page.getByTitle('Show filters');
  if (await showFilters.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('button[title="Show filters"]');
      btn?.click();
    });
    await expect(page.locator('aside[aria-label="Filters"]')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(120);
    const duringExpandEarly = await captureSnapshot(page, 'during-expand-120ms', false);
    snapshots.push(duringExpandEarly);
    console.log(`[forensic] ${JSON.stringify(duringExpandEarly)}`);
    await page.waitForTimeout(260);
    const duringExpandMid = await captureSnapshot(page, 'during-expand-380ms', false);
    snapshots.push(duringExpandMid);
    console.log(`[forensic] ${JSON.stringify(duringExpandMid)}`);
    await page.waitForTimeout(900);
    const afterExpand = await captureSnapshot(page, 'after-expand');
    snapshots.push(afterExpand);
    console.log(`[forensic] ${JSON.stringify(afterExpand)}`);

    const earlyFirstIndex = duringExpandEarly.visibleRows[0]?.index ?? null;
    const finalFirstIndex = afterExpand.visibleRows[0]?.index ?? null;
    if (earlyFirstIndex !== null && finalFirstIndex !== null) {
      expect(
        Math.abs(finalFirstIndex - earlyFirstIndex),
        'Visible row index drifted unexpectedly after sidebar settle',
      ).toBeLessThanOrEqual(1);
    }
  }

  if (process.env.NUGGETS_FORENSIC_EMIT_JSON === '1') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = path.join(process.cwd(), 'output', 'forensic');
    await mkdir(outDir, { recursive: true });
    const nonOverlapPasses = snapshots.filter((s) => s.adjacentRowsNonOverlap).length;
    const overflowPasses = snapshots.filter(
      (s) =>
        s.measureParentClientWidth != null &&
        s.measureParentScrollWidth != null &&
        s.measureParentScrollWidth <= s.measureParentClientWidth,
    ).length;
    const derivedLayoutHealthScore =
      snapshots.length > 0
        ? Math.round(((nonOverlapPasses + overflowPasses) / (snapshots.length * 2)) * 100)
        : 0;
    const payload = {
      runAt: new Date().toISOString(),
      suite: 'forensic-home-grid',
      snapshots,
      // Secondary derived indicator only; raw snapshot metrics remain source of truth.
      derivedLayoutHealthScore,
    };
    const filePath = path.join(outDir, `home-grid-forensic-${stamp}.json`);
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`[forensic-artifact] ${filePath}`);
  }
});
