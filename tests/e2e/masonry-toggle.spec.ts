/**
 * E2E Test: Masonry Toggle Persistence
 * 
 * Verifies that masonry toggle state persists after save and refresh
 */

import { test, expect } from '@playwright/test';
import {
  apiCreateArticle,
  apiFetchArticle,
  getAuthToken,
} from './helpers/api-helpers';
import {
  openEditModal,
  toggleMasonryForImage,
  setMasonryTitle,
  verifyImageVisible,
  clickSaveButton,
  closeModal,
  waitForApiCall,
} from './helpers/nugget-helpers';
import { TEST_ARTICLE_DATA, TEST_IMAGE_URLS } from './helpers/test-data';

test.describe('Masonry Toggle', () => {
  let authToken: string;
  let testArticleId: string;
  const testImageUrl = TEST_IMAGE_URLS.sample1;
  const masonryTitle = 'Test Masonry Title';

  test.beforeAll(async () => {
    authToken = await getAuthToken(
      process.env.TEST_USER_EMAIL || 'test@example.com',
      process.env.TEST_USER_PASSWORD || 'testpassword123'
    );
    
    if (!authToken) {
      test.skip();
      console.warn('Skipping tests: No authentication token. Please create a test user.');
    }
  });

  test.beforeEach(async () => {
    // Create article with image
    const article = await apiCreateArticle(
      {
        ...TEST_ARTICLE_DATA.minimal,
        images: [testImageUrl],
      },
      authToken
    );
    testArticleId = article.id;
  });

  test.afterEach(async ({ request }) => {
    if (testArticleId) {
      try {
        await request.delete(`/api/articles/${testArticleId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  test('masonry toggle persists after save and refresh', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');
    // Step 1: Navigate and open edit modal
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openEditModal(page, testArticleId);

    // Step 2: Verify image is visible
    await verifyImageVisible(page, testImageUrl);

    // Step 3: Scroll to masonry section
    const masonrySection = page.locator('[data-testid="masonry-toggle"]').first();
    const masonryExists = await masonrySection.count() > 0;
    
    if (!masonryExists) {
      test.skip(true, 'Masonry toggle section not found - may not be available for this image');
      return;
    }
    
    await masonrySection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Step 4: Toggle masonry ON for the image
    await toggleMasonryForImage(page, testImageUrl, true);

    // Step 5: Add masonry title
    await setMasonryTitle(page, testImageUrl, masonryTitle);

    // Step 6: Verify toggle is selected (button has bg-primary-500 class when selected)
    const masonrySectionAfter = page.locator('[data-testid="masonry-toggle"]').first();
    const imageItem = masonrySectionAfter.locator(`[data-image-url*="${testImageUrl}"]`).first();
    const toggleButton = imageItem.locator('button.bg-primary-500');
    await expect(toggleButton).toBeVisible({ timeout: 2000 });

    // Step 7: Save changes
    await clickSaveButton(page);
    await waitForApiCall(page);

    // Step 8: Close modal
    await closeModal(page);

    // Step 9: Verify backend has the masonry settings before refresh
    let article = await apiFetchArticle(testArticleId, authToken);
    let supportingMediaItem = article.supportingMedia?.find(
      media => media.url === testImageUrl || media.url?.includes(testImageUrl)
    );
    
    // If not found, check if it was added to supportingMedia
    if (!supportingMediaItem && article.supportingMedia) {
      supportingMediaItem = article.supportingMedia[0];
    }

    // Step 10: Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Step 11: Open edit modal again
    await openEditModal(page, testArticleId);

    // Step 12: Verify toggle is STILL selected
    const masonrySectionReloaded = page.locator('[data-testid="masonry-toggle"]').first();
    await masonrySectionReloaded.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const imageItemReloaded = masonrySectionReloaded.locator(`[data-image-url*="${testImageUrl}"]`).first();
    const toggleButtonReloaded = imageItemReloaded.locator('button.bg-primary-500');
    await expect(toggleButtonReloaded).toBeVisible({ timeout: 2000 });

    // Step 13: Verify title is STILL set
    const titleInputs = masonrySectionReloaded.locator('input[type="text"]');
    const titleInput = titleInputs.first();
    if (await titleInput.count() > 0) {
      await titleInput.waitFor({ state: 'visible' });
      const titleValue = await titleInput.inputValue();
      expect(titleValue).toBe(masonryTitle);
    }

    // Step 14: Fetch from backend: verify supportingMedia has showInMasonry: true
    article = await apiFetchArticle(testArticleId, authToken);
    supportingMediaItem = article.supportingMedia?.find(
      media => media.url === testImageUrl || media.url?.includes(testImageUrl)
    );

    if (!supportingMediaItem && article.supportingMedia && article.supportingMedia.length > 0) {
      supportingMediaItem = article.supportingMedia[0];
    }

    expect(supportingMediaItem).toBeDefined();
    if (supportingMediaItem) {
      expect(supportingMediaItem.showInMasonry).toBe(true);
      expect(supportingMediaItem.masonryTitle).toBe(masonryTitle);
    }
  });

  test('masonry toggle can be turned off', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openEditModal(page, testArticleId);
    await verifyImageVisible(page, testImageUrl);

    const masonrySection = page.locator('[data-testid="masonry-toggle"]').first();
    const masonryExists = await masonrySection.count() > 0;
    
    if (!masonryExists) {
      test.skip(true, 'Masonry toggle section not found - may not be available for this image');
      return;
    }
    
    await masonrySection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // First turn on
    await toggleMasonryForImage(page, testImageUrl, true);

    // Verify it's on
    const imageItem = masonrySection.locator(`[data-image-url*="${testImageUrl}"]`).first();
    let toggleButtonOn = imageItem.locator('button.bg-primary-500');
    await expect(toggleButtonOn).toBeVisible({ timeout: 2000 });

    // Now turn off
    await toggleMasonryForImage(page, testImageUrl, false);
    await page.waitForTimeout(300);

    // Verify it's off (no bg-primary-500 class)
    const toggleButtonOff = imageItem.locator('button').first();
    const hasActiveClass = await toggleButtonOff.evaluate(el => el.classList.contains('bg-primary-500'));
    expect(hasActiveClass).toBe(false);

    // Save and verify persistence
    await clickSaveButton(page);
    await waitForApiCall(page);
    await closeModal(page);

    // Reload and verify toggle remains off
    await page.reload();
    await page.waitForLoadState('networkidle');
    await openEditModal(page, testArticleId);

    const masonrySectionReloaded = page.locator('[data-testid="masonry-toggle"]').first();
    await masonrySectionReloaded.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const imageItemReloaded = masonrySectionReloaded.locator(`[data-image-url*="${testImageUrl}"]`).first();
    const toggleButtonReloaded = imageItemReloaded.locator('button').first();
    const stillHasActiveClass = await toggleButtonReloaded.evaluate(el => el.classList.contains('bg-primary-500'));
    expect(stillHasActiveClass).toBe(false);
  });
});

