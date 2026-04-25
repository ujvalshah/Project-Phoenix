import { test, expect, Page } from '@playwright/test';

function buildArticle(id: string, title: string) {
  return {
    id,
    title,
    excerpt: 'Matched by Iconiq query',
    content: 'ICONIQ appears in full results payload',
    author: { id: 'author-1', name: 'Nuggets Bot' },
    publishedAt: '2026-03-27T00:00:00.000Z',
    tags: ['Markets'],
    readTime: 3,
    visibility: 'public',
    source_type: 'link',
    contentStream: 'standard',
  };
}

async function mockSearchApis(page: Page) {
  const suggestionRequests: URL[] = [];
  const articlesRequests: URL[] = [];

  await page.route('**/api/search/suggest**', async (route) => {
    const url = new URL(route.request().url());
    suggestionRequests.push(url);
    const q = url.searchParams.get('q') ?? '';
    const stream = url.searchParams.get('contentStream');
    const formats = url.searchParams.getAll('formats');

    if (q.toLowerCase() === 'iconiq') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: q,
          count: 1,
          suggestions: [
            {
              id: 'suggestion-1',
              title: 'Untitled',
              excerpt: '*The State of Go-to-Market 2026 | Mar 2026 | ICONIQ*',
              publishedAt: '2026-03-27T00:00:00.000Z',
              sourceType: 'link',
              contentStream: stream ?? 'standard',
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ query: q, count: 0, suggestions: [] }),
    });
  });

  await page.route('**/api/articles**', async (route) => {
    const url = new URL(route.request().url());
    articlesRequests.push(url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const stream = url.searchParams.get('contentStream');
    const formats = url.searchParams.getAll('formats');

    if (q === 'iconiq' && stream === 'standard' && formats.includes('link')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [buildArticle('article-iconiq', 'State of AI: Bi-Annual Snapshot | Jan 2026 | ICONIQ')],
          total: 1,
          page: 1,
          limit: 25,
          hasMore: false,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        total: 0,
        page: 1,
        limit: 25,
        hasMore: false,
      }),
    });
  });

  return { suggestionRequests, articlesRequests };
}

test.describe('Search parity regression', () => {
  test('Enter commit keeps query/filter parity from suggestions to final results', async ({ page }) => {
    const { suggestionRequests, articlesRequests } = await mockSearchApis(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?stream=standard&fmt=link');
    await page.waitForLoadState('networkidle');

    const input = page.locator('#desktop-search-combobox');
    await input.fill('Iconiq');
    await expect(page.getByRole('option').first()).toBeVisible();

    await input.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'State of AI: Bi-Annual Snapshot | Jan 2026 | ICONIQ' }).first(),
    ).toBeVisible();
    await expect(page.getByText('No nuggets found')).toHaveCount(0);

    const suggestionWithFilters = suggestionRequests.find(
      (request) =>
        (request.searchParams.get('q') ?? '').toLowerCase() === 'iconiq' &&
        request.searchParams.get('contentStream') === 'standard' &&
        request.searchParams.getAll('formats').includes('link'),
    );
    expect(suggestionWithFilters).toBeTruthy();

    const finalResultsWithFilters = articlesRequests.find(
      (request) =>
        (request.searchParams.get('q') ?? '').toLowerCase() === 'iconiq' &&
        request.searchParams.get('contentStream') === 'standard' &&
        request.searchParams.getAll('formats').includes('link'),
    );
    expect(finalResultsWithFilters).toBeTruthy();
  });

  test('Search button click matches Enter commit behavior', async ({ page }) => {
    await mockSearchApis(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?stream=standard&fmt=link');
    await page.waitForLoadState('networkidle');

    const input = page.locator('#desktop-search-combobox');
    await input.fill('Iconiq');
    await expect(page.getByRole('option').first()).toBeVisible();

    await page.getByRole('button', { name: 'Submit search' }).click();
    await expect(
      page.getByRole('heading', { name: 'State of AI: Bi-Annual Snapshot | Jan 2026 | ICONIQ' }).first(),
    ).toBeVisible();
    await expect(page.getByText('No nuggets found')).toHaveCount(0);
  });
});
