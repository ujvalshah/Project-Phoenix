/**
 * Smoke-level regression checks for auth, protected entry, and create modal open paths
 * (performance-related code-splitting must not break core flows).
 */
import { test, expect } from '@playwright/test';
import { getAuthToken } from './helpers/api-helpers';
import { openCreateModal, closeModal } from './helpers/nugget-helpers';

test.describe('Perf guards — nugget modal & auth', () => {
  test('protected route triggers sign-in flow (auth modal or redirect)', async ({ page }) => {
    await page.goto('/bookmarks');
    await page.waitForLoadState('domcontentloaded');
    // Unauthenticated users are redirected home and the app opens the login auth modal.
    await expect(page.getByText(/sign in to continue/i)).toBeVisible({ timeout: 15000 });
  });

  test('create modal opens and reopens when authenticated', async ({ page }) => {
    const token = await getAuthToken(
      process.env.TEST_USER_EMAIL || 'test@example.com',
      process.env.TEST_USER_PASSWORD || 'testpassword123',
    );
    test.skip(!token, 'No API auth token — set TEST_USER_EMAIL / TEST_USER_PASSWORD');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openCreateModal(page);
    await expect(page.getByRole('dialog')).toBeVisible();

    await closeModal(page);

    await openCreateModal(page);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('second modal open is warm: no extra CreateNuggetModal network fetch', async ({ page }) => {
    const token = await getAuthToken(
      process.env.TEST_USER_EMAIL || 'test@example.com',
      process.env.TEST_USER_PASSWORD || 'testpassword123',
    );
    test.skip(!token, 'No API auth token — set TEST_USER_EMAIL / TEST_USER_PASSWORD');

    const chunkRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('CreateNuggetModal')) {
        chunkRequests.push(req.url());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openCreateModal(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    const countAfterFirstOpen = chunkRequests.length;

    await closeModal(page);

    await openCreateModal(page);
    await expect(page.getByRole('dialog')).toBeVisible();

    // Cold open may have issued 0+ fetches (e.g. preloaded). Warm second open must not
    // add another fetch for the same code-split entry.
    expect(chunkRequests.length).toBe(countAfterFirstOpen);
  });
});
