import { test, expect } from '@playwright/test';

test.describe('Live search regression: iconiq', () => {
  test('Enter and search-button submit both render committed results', async ({ page, request }) => {
    const apiRes = await request.get(
      '/api/articles?q=iconiq&searchMode=relevance&page=1&limit=25&contentStream=standard',
    );
    expect(apiRes.status()).toBe(200);
    const apiPayload = await apiRes.json();
    test.skip(!Array.isArray(apiPayload?.data) || apiPayload.data.length === 0, 'No iconiq fixture data in this environment');
    const expectedTitle: string | undefined = apiPayload.data[0]?.title;
    test.skip(!expectedTitle, 'Iconiq API payload missing title fixture');

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?stream=standard');
    await page.waitForLoadState('networkidle');

    const input = page.locator('#desktop-search-combobox');
    await input.fill('iconiq');
    await input.press('Enter');

    await expect(page.getByText('Failed to load')).toHaveCount(0);
    await expect(page.getByText('No nuggets found')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: expectedTitle as string }).first()).toBeVisible({
      timeout: 15000,
    });

    await input.fill('iconiq');
    await page.getByRole('button', { name: 'Submit search' }).click();

    await expect(page.getByText('Failed to load')).toHaveCount(0);
    await expect(page.getByText('No nuggets found')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: expectedTitle as string }).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
