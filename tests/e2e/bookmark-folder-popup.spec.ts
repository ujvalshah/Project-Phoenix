/**
 * Bookmark folder picker visibility
 *
 * Requires:
 * - Vite dev server (Playwright webServer) on :3000
 * - API on :3000/api → :5000 (Vite proxy) with a valid user
 * - TEST_USER_EMAIL / TEST_USER_PASSWORD
 */

import { test, expect } from '@playwright/test';

test.describe('Bookmark folder popup', () => {
  test('folder picker is visible in viewport after scrolling to bottom', async ({
    page,
    context
  }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    test.skip(!email || !password, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD');

    const loginRes = await context.request.post('http://localhost:3000/api/auth/login', {
      data: { email, password },
      failOnStatusCode: false
    });
    test.skip(
      !loginRes.ok(),
      'Login failed — ensure the API is running on :5000 and credentials are valid'
    );

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });

    const buttons = page.locator('[data-testid="bookmark-button"]');
    test.skip((await buttons.count()) === 0, 'No bookmark buttons rendered on home feed');

    const last = buttons.last();
    await last.click();
    await last.click();
    await page.getByRole('menuitem', { name: /change folder/i }).click();

    const panel = page.getByTestId('bookmark-folder-dialog');
    await expect(panel).toBeVisible({ timeout: 15000 });

    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    const v = page.viewportSize();
    expect(v).not.toBeNull();
    if (box && v) {
      expect(box.y + box.height).toBeLessThanOrEqual(v.height + 4);
      expect(box.y).toBeGreaterThanOrEqual(-4);
    }
  });
});
