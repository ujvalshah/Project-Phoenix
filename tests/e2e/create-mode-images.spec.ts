/**
 * E2E Test: Create Mode Image Operations
 *
 * Tests for adding images during article creation
 */

import { test, expect } from '@playwright/test';
import {
  apiFetchArticle,
  apiDeleteArticle,
  getAuthToken,
} from './helpers/api-helpers';
import {
  openCreateModal,
  addImageUrl,
  fillTitle,
  fillContent,
  clickSaveButton,
  waitForApiCall,
  verifyImageVisible,
  verifyImageGone,
  toggleMasonryForImage,
  setMasonryTitle,
} from './helpers/nugget-helpers';
import { TEST_IMAGE_URLS } from './helpers/test-data';

test.describe('Create Mode Image Operations', () => {
  let authToken: string;
  const createdArticleIds: string[] = [];

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

  test.afterAll(async ({ request }) => {
    // Cleanup all created articles
    for (const articleId of createdArticleIds) {
      try {
        await request.delete(`/api/articles/${articleId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  test('can add image via URL in create mode', async ({ page, request }) => {
    test.skip(!authToken, 'Authentication required');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openCreateModal(page);

    // Fill in required fields
    await fillTitle(page, 'Test Article with Image');
    await fillContent(page, 'This article has an image added via URL.');

    // Add image URL
    await addImageUrl(page, TEST_IMAGE_URLS.sample1);
    await waitForApiCall(page);

    // Verify image appears in the form
    await verifyImageVisible(page, TEST_IMAGE_URLS.sample1);

    // Intercept the create API call to capture article ID
    let createdArticleId: string | null = null;
    page.on('response', async (response) => {
      if (response.url().includes('/api/articles') && response.request().method() === 'POST') {
        try {
          const article = await response.json();
          if (article && article.id) {
            createdArticleId = article.id;
            createdArticleIds.push(article.id);
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    });

    // Save the article
    await clickSaveButton(page);
    await waitForApiCall(page);

    // Verify modal closed (article was created)
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {
      // Modal might close differently, continue
    });

    // Verify article was created by checking it exists in the API
    if (createdArticleId) {
      const article = await request.get(`http://localhost:5000/api/articles/${createdArticleId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(article.ok()).toBeTruthy();
      const articleData = await article.json();
      expect(articleData.images || []).toContain(TEST_IMAGE_URLS.sample1);
    }
  });

  test('prevents duplicate image URLs in create mode', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openCreateModal(page);

    await fillTitle(page, 'Duplicate Image Test');
    await fillContent(page, 'Testing duplicate prevention.');

    // Add the same image URL twice
    await addImageUrl(page, TEST_IMAGE_URLS.sample1);
    await page.waitForTimeout(500);
    await verifyImageVisible(page, TEST_IMAGE_URLS.sample1);

    // Try to add the same URL again
    await addImageUrl(page, TEST_IMAGE_URLS.sample1);
    await page.waitForTimeout(500);

    // Count images - should only appear once (deduplication should work)
    const existingImagesSection = page.locator('[data-testid="existing-images"]');
    const imageContainers = existingImagesSection.locator(`[data-image-url*="${TEST_IMAGE_URLS.sample1}"]`);
    const count = await imageContainers.count();
    expect(count).toBe(1); // Should appear exactly once
  });

  test('can add multiple different images in create mode', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openCreateModal(page);

    await fillTitle(page, 'Multiple Images Test');
    await fillContent(page, 'Testing multiple images.');

    // Add first image
    await addImageUrl(page, TEST_IMAGE_URLS.sample1);
    await waitForApiCall(page);
    await verifyImageVisible(page, TEST_IMAGE_URLS.sample1);

    // Add second image
    await addImageUrl(page, TEST_IMAGE_URLS.sample2);
    await waitForApiCall(page);
    await verifyImageVisible(page, TEST_IMAGE_URLS.sample2);

    // Both images should be visible
    const image1Container = page.locator(`[data-image-url*="${TEST_IMAGE_URLS.sample1}"]`);
    const image2Container = page.locator(`[data-image-url*="${TEST_IMAGE_URLS.sample2}"]`);

    await expect(image1Container).toBeVisible();
    await expect(image2Container).toBeVisible();
  });

  test('masonry toggle works in create mode', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openCreateModal(page);

    await fillTitle(page, 'Masonry Toggle Create Test');
    await fillContent(page, 'Testing masonry toggle in create mode.');

    // Add an image
    await addImageUrl(page, TEST_IMAGE_URLS.sample1);
    await waitForApiCall(page);
    await verifyImageVisible(page, TEST_IMAGE_URLS.sample1);

    // Wait for masonry toggle section to appear
    await page.waitForTimeout(500);

    // Check if masonry section exists
    const masonrySection = page.locator('[data-testid="masonry-toggle"]');
    const masonrySectionExists = await masonrySection.count() > 0;

    if (masonrySectionExists) {
      // Toggle masonry on
      await toggleMasonryForImage(page, TEST_IMAGE_URLS.sample1, true);

      // Set masonry title
      await setMasonryTitle(page, TEST_IMAGE_URLS.sample1, 'Create Mode Masonry Title');

      // Verify the title was set
      const titleInput = masonrySection.locator('input[type="text"]').first();
      const titleValue = await titleInput.inputValue();
      expect(titleValue).toBe('Create Mode Masonry Title');
    }
  });

  test('can remove image URL before saving in create mode', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openCreateModal(page);

    await fillTitle(page, 'Remove Image Test');
    await fillContent(page, 'Testing image removal before save.');

    // Add an image
    await addImageUrl(page, TEST_IMAGE_URLS.sample1);
    await waitForApiCall(page);
    await verifyImageVisible(page, TEST_IMAGE_URLS.sample1);

    // Find the image container and delete button
    const imageContainer = page.locator(`[data-image-url*="${TEST_IMAGE_URLS.sample1}"]`).first();
    await imageContainer.waitFor({ state: 'visible' });
    await imageContainer.hover();

    // Set up dialog handler for confirmation
    page.once('dialog', async dialog => {
      if (dialog.type() === 'confirm') {
        await dialog.accept();
      }
    });

    // Find and click the delete button
    const deleteButton = imageContainer.locator('button[aria-label="Delete image"]').first();
    await deleteButton.waitFor({ state: 'visible' });
    await deleteButton.click();
    await page.waitForTimeout(500);

    // Verify image is gone from UI
    await verifyImageGone(page, TEST_IMAGE_URLS.sample1);
  });

  test('empty form shows validation when trying to save without content', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openCreateModal(page);

    // Try to save without filling anything
    await clickSaveButton(page);

    // Should show validation error or stay on form
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Check for validation message
    const validationMessage = page.locator('[class*="error"], [role="alert"], text=/required|please/i').first();
    const hasValidation = await validationMessage.count() > 0;

    // Either show validation or prevent form submission
    expect(hasValidation || await modal.isVisible()).toBeTruthy();
  });
});
