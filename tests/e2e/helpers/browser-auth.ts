/**
 * Establish an authenticated browsing session for E2E.
 *
 * `getAuthToken()` alone is insufficient: the SPA relies on cookies set by `/api/auth/login`
 * SameSite on the Playwright origin (Vite `:3000` proxy), so we must login from the page.
 *
 * In-browser `fetch` is intentional (not `apiClient`): establishes cookies on the Playwright origin.
 */
/* eslint-disable no-unsafe-direct-mutation-fetch */

import type { Page } from '@playwright/test';

/** Must match defaults in tests/e2e/global-setup.ts */
export const DEFAULT_TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';

export const DEFAULT_TEST_PASSWORD =
  process.env.TEST_USER_PASSWORD || 'TestPassword123!';

async function gotoHomeWithRetry(page: Page): Promise<void> {
  const attempts = 6;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 35_000 });
      return;
    } catch {
      if (i === attempts - 1) {
        throw new Error(`page.goto('/') failed after ${attempts} attempts`);
      }
      await new Promise((r) => setTimeout(r, 900));
    }
  }
}

export async function establishBrowserAuthSession(
  page: Page,
  email = DEFAULT_TEST_EMAIL,
  password = DEFAULT_TEST_PASSWORD,
): Promise<boolean> {
  await gotoHomeWithRetry(page);
  await page.waitForLoadState('domcontentloaded');

  /** Same locator as `openCreateModal` — stable on xl+ desktop header (after login). */
  const createBtn = page.locator('header').getByTestId('create-nugget-button');

  const maxAttempts = 6;
  let loginOk = false;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await page.evaluate(
      async ({
        mail,
        pass,
      }: {
        mail: string;
        pass: string;
      }) => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: mail, password: pass }),
        });
        return { ok: res.ok, status: res.status };
      },
      { mail: email, pass: password },
    );

    if (result.ok) {
      loginOk = true;
      break;
    }
    const retryable = result.status === 429 || result.status === 503;
    if (retryable && attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 3000 + attempt * 2000));
      continue;
    }
    return false;
  }

  if (!loginOk) {
    return false;
  }

  let reloaded = false;
  for (let i = 0; i < 5; i++) {
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 35_000 });
      reloaded = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 900));
    }
  }
  if (!reloaded) {
    return false;
  }
  await page.waitForLoadState('domcontentloaded');
  /** Cookie session must hydrate before Header exposes Create — avoids modal opens against logged-out shell */
  await createBtn.waitFor({ state: 'visible', timeout: 45_000 });
  return true;
}
