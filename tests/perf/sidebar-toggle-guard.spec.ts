import { test, expect } from '@playwright/test';

test.describe('desktop sidebar toggle guard', () => {
  test('home filter sidebar opens and closes on desktop', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Perf guard is Chromium-only in perf config.');

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.locator('[data-article-id]').first().waitFor({ state: 'visible', timeout: 60_000 });

    const filterToggle = page.locator('button[aria-label="Filter"]:visible').first();
    const panel = page.locator('#desktop-filter-panel');

    await expect(filterToggle).toBeVisible();
    await expect(panel).toHaveAttribute('aria-hidden', 'true');

    await filterToggle.click();
    await expect(panel).toHaveAttribute('aria-hidden', 'false');

    await filterToggle.click();
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
  });
});
