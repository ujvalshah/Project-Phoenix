/**
 * Smoke-level regression checks for auth, protected entry, and create modal open paths
 * (performance-related code-splitting must not break core flows).
 *
 * CI readiness (**TASK-029**): `playwright.config` waits on `/api/health`; global-setup polls Mongo-ready
 * health before Node login; helpers tolerate lazy modal chunk + transient `goto` blips.
 *
 * Explicit scope: **TASK-031** MySpace library virtualization is not covered here — profile manually.
 */
import { test, expect } from '@playwright/test';
import { establishBrowserAuthSession } from './helpers/browser-auth';
import { openCreateModal, closeModal } from './helpers/nugget-helpers';

test.describe('Perf guards — nugget modal & auth', () => {
  test('protected route triggers sign-in flow (auth modal or redirect)', async ({ page }) => {
    await page.goto('/bookmarks');
    await page.waitForLoadState('domcontentloaded');
    // Unauthenticated users are redirected home and the app opens the login auth modal.
    await expect(page.getByText(/sign in to continue/i)).toBeVisible({ timeout: 15000 });
  });

  test.describe('authenticated smoke', () => {
    /**
     * Slightly wider than default Desktop Chrome (often 1280px): at the xl breakpoint the
     * desktop search column and tools cluster are tight; extra width reduces incidental overlap
     * of hit targets during Playwright actionability checks.
     */
    test.use({ viewport: { width: 1440, height: 900 } });

    test('authenticated: create modal reopens without duplicate CreateNuggetModal fetch', async ({
      page,
    }) => {
      /** Two modal cycles + 45s dialog guard + auth need headroom above default 60s test timeout. */
      test.setTimeout(120_000);

      /** Tracks code-split modal chunk requests (script only; lazy tree can continue after dialog paint). */
      const chunkUrls: string[] = [];
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('CreateNuggetModal') && req.resourceType() === 'script') {
          chunkUrls.push(url);
        }
      });

      const sessionOk = await establishBrowserAuthSession(page);
      expect(
        sessionOk,
        'establishBrowserAuthSession failed — check API (Vite :3000 proxies /api), TEST_USER_* credentials, and E2E_AUTH_RELAXED_LIMITS for local dev:all (see env.example) to avoid login 429',
      ).toBeTruthy();

      await openCreateModal(page);
      await expect(page.getByRole('dialog', { name: /^Create Nugget$/ })).toBeVisible();
      /** Let deferred imports finish before baseline; otherwise length grows after snapshot and mimics a "second fetch". */
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      const countAfterFirstOpen = chunkUrls.length;

      await closeModal(page);

      await openCreateModal(page);
      await expect(page.getByRole('dialog', { name: /^Create Nugget$/ })).toBeVisible();
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

      expect(chunkUrls.length).toBe(countAfterFirstOpen);
    });
  });
});
