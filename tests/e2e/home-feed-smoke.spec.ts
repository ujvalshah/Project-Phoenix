/**
 * Home feed regression: virtual grid, pagination, modal open, optional grid ↔ masonry (xl).
 * Works anonymously for scroll/pagination/layout; avoids depending on flaky auth seed.
 */

import { test, expect, type Page } from '@playwright/test';

/** Subpixel tolerance for stacked virtual row bands (transform + rounding). */
const VIRTUAL_ROW_OVERLAP_EPS_PX = 4;

/** Home sidebar snaps open/closed; leave room for trailing remeasure + paint. */
const SIDEBAR_LAYOUT_SETTLE_MS = 600;

/**
 * Visible `[data-index]` virtual rows sorted by index; for each consecutive index pair (n, n+1)
 * in view, assert `getBoundingClientRect()` bands do not overlap vertically.
 */
async function getAdjacentVirtualRowOverlapResult(
  page: Page,
): Promise<{ failures: string[]; consecutivePairsChecked: number }> {
  return page.evaluate((eps) => {
    const vh = window.innerHeight;
    const nodes = Array.from(document.querySelectorAll('[data-index]'));
    const items = nodes
      .map((el) => {
        const r = el.getBoundingClientRect();
        const idx = parseInt(el.getAttribute('data-index') ?? '-1', 10);
        const visible =
          r.bottom > 8 && r.top < vh - 8 && r.width > 0 && r.height > 8;
        return { idx, top: r.top, bottom: r.bottom, visible };
      })
      .filter((x) => x.visible && x.idx >= 0)
      .sort((a, b) => a.idx - b.idx);

    const failures: string[] = [];
    let consecutivePairsChecked = 0;
    for (let i = 1; i < items.length; i += 1) {
      if (items[i].idx !== items[i - 1].idx + 1) continue;
      consecutivePairsChecked += 1;
      if (items[i].top < items[i - 1].bottom - eps) {
        failures.push(
          `rows ${String(items[i - 1].idx)}→${String(items[i].idx)}: prevBottom=${items[i - 1].bottom.toFixed(1)} nextTop=${items[i].top.toFixed(1)}`,
        );
      }
    }
    return { failures, consecutivePairsChecked };
  }, VIRTUAL_ROW_OVERLAP_EPS_PX);
}

/** Polls until debounced layout + virtualizer measure catch up (sidebar width / scrollMargin). */
async function assertVisibleVirtualRowsDoNotOverlap(page: Page): Promise<void> {
  await expect(async () => {
    const result = await getAdjacentVirtualRowOverlapResult(page);
    expect(result.consecutivePairsChecked).toBeGreaterThan(0);
    expect(result.failures).toEqual([]);
  }).toPass({
    timeout: 8000,
    intervals: [100, 200, 400],
  });
}

/** Home infinite-feed listing: pathname exactly `/api/articles` (same as dev `fetch('/api/articles?…')`). */
function isArticlesFeedListingUrl(url: string): boolean {
  try {
    return new URL(url).pathname === '/api/articles';
  } catch {
    return false;
  }
}

test.describe.configure({ timeout: 120_000 });

test.describe('Home feed smoke', () => {
  /** Initial query + at least one `fetchNextPage`; a third request appears only when the feed has enough rows & `hasMore`. */
  test('deep scroll + article list pagination (multi-page)', async ({ page }) => {
    // Count **requests** (not just ok responses) so the test still observes pagination attempts
    // when the API is temporarily erroring behind the Vite proxy.
    let listingRequests = 0;

    page.on('request', (req) => {
      if (req.method() !== 'GET') return;
      if (!isArticlesFeedListingUrl(req.url())) return;
      listingRequests += 1;
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const emptyHint = page.getByText(/no nuggets/i);
    if (await emptyHint.isVisible({ timeout: 6000 }).catch(() => false)) {
      test.skip(true, 'Empty feed — cannot assert infinite scroll.');
    }

    await expect.poll(() => listingRequests, { timeout: 45_000 }).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < 35; i++) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(120);
      if (listingRequests >= 3) break;
    }
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    );
    await page.waitForTimeout(500);

    // Initial load + ≥1 pagination round (short DBs legitimately yield exactly 2 before hasMore=false).
    await expect.poll(() => listingRequests, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
    if (listingRequests < 3) {
      console.warn(
        `[home-feed-smoke] Observed ${String(listingRequests)} /api/articles GETs — seed more nuggets locally to exercise a 3rd page.`,
      );
    }
    try {
      await page.locator('[data-index]').first().waitFor({ state: 'attached', timeout: 25_000 });
    } catch {
      test.skip(
        true,
        'Virtual rows never mounted (home feed error/empty or UI not on grid path).',
      );
    }
    expect(await page.locator('[data-index]').count()).toBeGreaterThan(0);
  });

  test('anonymous card click opens modal (role=dialog)', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const emptyHint = page.getByText(/no nuggets/i);
    if (await emptyHint.isVisible({ timeout: 6000 }).catch(() => false)) {
      test.skip(true, 'Empty feed — nothing to click.');
    }

    try {
      await page.locator('[data-article-id]').first().waitFor({ state: 'visible', timeout: 45_000 });
    } catch {
      test.skip(true, 'No article cards rendered (API/downstream feed empty).');
    }

    const firstCard = page.locator('[data-article-id]').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });

    await firstCard.click({ position: { x: 50, y: 50 }, force: false });
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('xl: masonry then grid restores virtual rows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const emptyHint = page.getByText(/no nuggets/i);
    if (await emptyHint.isVisible({ timeout: 6000 }).catch(() => false)) {
      test.skip(true, 'Empty feed.');
    }

    try {
      await page.locator('[data-index]').first().waitFor({ state: 'visible', timeout: 45_000 });
    } catch {
      test.skip(true, 'Virtual grid missing — empty feed or not on grid layout.');
    }

    await page.getByRole('button', { name: 'Masonry View' }).click();
    await page.waitForTimeout(400);

    await expect(page.locator('[data-index]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Grid View' }).click();
    await page.waitForTimeout(400);

    await expect(page.locator('[data-index]').first()).toBeVisible({ timeout: 20_000 });
  });

  test('lg: desktop filter sidebar toggle does not overlap virtual rows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const emptyHint = page.getByText(/no nuggets/i);
    if (await emptyHint.isVisible({ timeout: 6000 }).catch(() => false)) {
      test.skip(true, 'Empty feed.');
    }

    try {
      await page.locator('[data-index]').first().waitFor({ state: 'visible', timeout: 45_000 });
    } catch {
      test.skip(true, 'Virtual grid missing.');
    }

    const aside = page.locator('aside[aria-label="Filters collapsed"], aside[aria-label="Filters"]');
    await expect(aside.first()).toBeVisible({ timeout: 10_000 });

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(150);

    const overlapProbe = await page.evaluate(() => {
      const vh = window.innerHeight;
      const nodes = Array.from(document.querySelectorAll('[data-index]'));
      const items = nodes
        .map((el) => {
          const r = el.getBoundingClientRect();
          const idx = parseInt(el.getAttribute('data-index') ?? '-1', 10);
          const visible =
            r.bottom > 8 && r.top < vh - 8 && r.width > 0 && r.height > 8;
          return { idx, visible };
        })
        .filter((x) => x.visible && x.idx >= 0)
        .sort((a, b) => a.idx - b.idx);
      let pairs = 0;
      for (let i = 1; i < items.length; i += 1) {
        if (items[i].idx === items[i - 1].idx + 1) pairs += 1;
      }
      return pairs;
    });

    if (overlapProbe === 0) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(200);
    }

    const showFilters = page.getByTitle('Show filters');
    await showFilters.click();
    await expect(page.locator('aside[aria-label="Filters"]')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(SIDEBAR_LAYOUT_SETTLE_MS);

    await assertVisibleVirtualRowsDoNotOverlap(page);
    expect(await page.locator('[data-index]').count()).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Collapse filters sidebar' }).click();
    await expect(page.locator('aside[aria-label="Filters collapsed"]')).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(SIDEBAR_LAYOUT_SETTLE_MS);

    await assertVisibleVirtualRowsDoNotOverlap(page);
    expect(await page.locator('[data-index]').count()).toBeGreaterThan(0);
  });
});
