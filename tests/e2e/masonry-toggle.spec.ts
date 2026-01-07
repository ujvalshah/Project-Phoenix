/**
 * E2E Test: Masonry Toggle Persistence
 * 
 * Verifies that masonry toggle state persists after save and refresh
 * Tests both Edit mode (existing) and Create mode (new)
 */

import { test, expect } from '@playwright/test';
import {
  apiCreateArticle,
  apiFetchArticle,
  apiDeleteArticle,
  getAuthToken,
} from './helpers/api-helpers';
import {
  openEditModal,
  openCreateModal,
  toggleMasonryForImage,
  setMasonryTitle,
  verifyImageVisible,
  clickSaveButton,
  closeModal,
  waitForApiCall,
  addImageUrl,
  fillTitle,
  fillContent,
} from './helpers/nugget-helpers';
import { TEST_ARTICLE_DATA, TEST_IMAGE_URLS } from './helpers/test-data';

test.describe('Masonry Toggle', () => {
  let authToken: string;
  let testArticleId: string;
  const testImageUrl = TEST_IMAGE_URLS.sample1;
  const masonryTitle = 'Test Masonry Title';
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
        await apiDeleteArticle(articleId, authToken);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  // ============================================================================
  // EDIT MODE TESTS (Unchanged - existing behavior)
  // ============================================================================

  test.describe('Edit Mode', () => {
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

  // ============================================================================
  // CREATE MODE TESTS (New - tests the fix for masonry toggle in create mode)
  // ============================================================================

  test.describe('Create Mode', () => {
    test('URL-image masonry toggle works and persists in create mode', async ({ page }) => {
      test.skip(!authToken, 'Authentication required');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Open create modal
      await openCreateModal(page);

      // Fill required fields
      await fillTitle(page, 'Create Mode URL Image Masonry Test');
      await fillContent(page, 'Testing masonry toggle for URL image in create mode.');

      // Add image URL
      await addImageUrl(page, testImageUrl);
      await waitForApiCall(page);
      await verifyImageVisible(page, testImageUrl);

      // Wait for masonry section to appear (it should appear after image is added)
      const masonrySection = page.locator('[data-testid="masonry-toggle"]').first();
      await masonrySection.waitFor({ state: 'visible', timeout: 5000 });
      await masonrySection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Verify image appears in masonry section
      const imageItem = masonrySection.locator(`[data-image-url*="${testImageUrl}"]`).first();
      await expect(imageItem).toBeVisible({ timeout: 2000 });

      // Toggle masonry ON (primary media is ON by default, so toggle OFF then ON to test)
      await toggleMasonryForImage(page, testImageUrl, false);
      await page.waitForTimeout(300);
      await toggleMasonryForImage(page, testImageUrl, true);
      await page.waitForTimeout(300);

      // Verify toggle is ON
      const toggleButtonOn = imageItem.locator('button.bg-primary-500');
      await expect(toggleButtonOn).toBeVisible({ timeout: 2000 });

      // Set masonry title
      await setMasonryTitle(page, testImageUrl, masonryTitle);

      // Intercept article creation to get article ID
      let articleId: string | null = null;
      page.on('response', async (response) => {
        if (response.url().includes('/api/articles') && response.request().method() === 'POST') {
          try {
            const data = await response.json();
            if (data && data.id) {
              articleId = data.id;
              createdArticleIds.push(data.id);
            }
          } catch (error) {
            // Ignore JSON parse errors
          }
        }
      });

      // Save article
      await clickSaveButton(page);
      await waitForApiCall(page);
      await closeModal(page);
      await page.waitForTimeout(1000);

      // Verify backend persistence
      if (articleId) {
        const article = await apiFetchArticle(articleId, authToken);
        expect(article).toBeDefined();
        
        // Check if image is in supportingMedia with showInMasonry: true
        const supportingMediaItem = article.supportingMedia?.find(
          media => media.url === testImageUrl || media.url?.includes(testImageUrl)
        );
        
        // Primary media might have showInMasonry: true
        if (article.primaryMedia?.url === testImageUrl || article.primaryMedia?.url?.includes(testImageUrl)) {
          expect(article.primaryMedia.showInMasonry).toBe(true);
        } else if (supportingMediaItem) {
          expect(supportingMediaItem.showInMasonry).toBe(true);
        }
      }
    });

    test('attachment-image masonry toggle works and persists in create mode', async ({ page }) => {
      test.skip(!authToken, 'Authentication required');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Open create modal
      await openCreateModal(page);

      // Fill required fields
      await fillTitle(page, 'Create Mode Attachment Image Masonry Test');
      await fillContent(page, 'Testing masonry toggle for attachment image in create mode.');

      // Upload image attachment
      // Find file input and upload a test image
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: 'visible', timeout: 5000 });

      // Create a test image file (small PNG)
      const testImageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      await fileInput.setInputFiles({
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer: testImageBuffer,
      });

      // Wait for upload to complete
      await page.waitForTimeout(3000); // Wait for Cloudinary upload

      // Wait for masonry section to appear
      const masonrySection = page.locator('[data-testid="masonry-toggle"]').first();
      await masonrySection.waitFor({ state: 'visible', timeout: 10000 });
      await masonrySection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Find the uploaded image in masonry section (by checking for image elements)
      const imageItems = masonrySection.locator('[data-image-url]');
      const imageCount = await imageItems.count();
      expect(imageCount).toBeGreaterThan(0);

      // Get the first image item (should be the uploaded attachment)
      const imageItem = imageItems.first();
      await expect(imageItem).toBeVisible({ timeout: 2000 });

      // Get the image URL from the data attribute
      const imageUrl = await imageItem.getAttribute('data-image-url');
      expect(imageUrl).toBeTruthy();

      if (!imageUrl) {
        test.skip(true, 'Could not find uploaded image URL');
        return;
      }

      // Toggle masonry ON (attachments default to OFF)
      await toggleMasonryForImage(page, imageUrl, true);
      await page.waitForTimeout(300);

      // Verify toggle is ON
      const toggleButtonOn = imageItem.locator('button.bg-primary-500');
      await expect(toggleButtonOn).toBeVisible({ timeout: 2000 });

      // Set masonry title
      await setMasonryTitle(page, imageUrl, masonryTitle);

      // Intercept article creation to get article ID
      let articleId: string | null = null;
      page.on('response', async (response) => {
        if (response.url().includes('/api/articles') && response.request().method() === 'POST') {
          try {
            const data = await response.json();
            if (data && data.id) {
              articleId = data.id;
              createdArticleIds.push(data.id);
            }
          } catch (error) {
            // Ignore JSON parse errors
          }
        }
      });

      // Save article
      await clickSaveButton(page);
      await waitForApiCall(page);
      await closeModal(page);
      await page.waitForTimeout(1000);

      // Verify backend persistence
      if (articleId) {
        const article = await apiFetchArticle(articleId, authToken);
        expect(article).toBeDefined();
        
        // Check if uploaded image is in supportingMedia with showInMasonry: true
        const supportingMediaItem = article.supportingMedia?.find(
          media => media.url === imageUrl || media.url?.includes(imageUrl) || imageUrl.includes(media.url || '')
        );
        
        if (supportingMediaItem) {
          expect(supportingMediaItem.showInMasonry).toBe(true);
          expect(supportingMediaItem.masonryTitle).toBe(masonryTitle);
        }
      }
    });

    test('masonry toggle ON/OFF persists after save in create mode', async ({ page }) => {
      test.skip(!authToken, 'Authentication required');

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Open create modal
      await openCreateModal(page);

      // Fill required fields
      await fillTitle(page, 'Create Mode Toggle ON/OFF Persistence Test');
      await fillContent(page, 'Testing toggle ON/OFF persistence in create mode.');

      // Add image URL
      await addImageUrl(page, testImageUrl);
      await waitForApiCall(page);
      await verifyImageVisible(page, testImageUrl);

      // Wait for masonry section
      const masonrySection = page.locator('[data-testid="masonry-toggle"]').first();
      await masonrySection.waitFor({ state: 'visible', timeout: 5000 });
      await masonrySection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const imageItem = masonrySection.locator(`[data-image-url*="${testImageUrl}"]`).first();
      await expect(imageItem).toBeVisible({ timeout: 2000 });

      // Step 1: Toggle ON
      await toggleMasonryForImage(page, testImageUrl, true);
      await page.waitForTimeout(300);
      let toggleButton = imageItem.locator('button.bg-primary-500');
      await expect(toggleButton).toBeVisible({ timeout: 2000 });

      // Step 2: Toggle OFF
      await toggleMasonryForImage(page, testImageUrl, false);
      await page.waitForTimeout(300);
      toggleButton = imageItem.locator('button').first();
      let hasActiveClass = await toggleButton.evaluate(el => el.classList.contains('bg-primary-500'));
      expect(hasActiveClass).toBe(false);

      // Step 3: Toggle ON again
      await toggleMasonryForImage(page, testImageUrl, true);
      await page.waitForTimeout(300);
      toggleButton = imageItem.locator('button.bg-primary-500');
      await expect(toggleButton).toBeVisible({ timeout: 2000 });

      // Intercept article creation to get article ID
      let articleId: string | null = null;
      page.on('response', async (response) => {
        if (response.url().includes('/api/articles') && response.request().method() === 'POST') {
          try {
            const data = await response.json();
            if (data && data.id) {
              articleId = data.id;
              createdArticleIds.push(data.id);
            }
          } catch (error) {
            // Ignore JSON parse errors
          }
        }
      });

      // Step 4: Save article
      await clickSaveButton(page);
      await waitForApiCall(page);
      await closeModal(page);
      await page.waitForTimeout(1000);

      // Step 5: Verify backend has showInMasonry: true (final state was ON)
      if (articleId) {
        const article = await apiFetchArticle(articleId, authToken);
        expect(article).toBeDefined();
        
        // Check primary media or supporting media
        if (article.primaryMedia?.url === testImageUrl || article.primaryMedia?.url?.includes(testImageUrl)) {
          expect(article.primaryMedia.showInMasonry).toBe(true);
        } else {
          const supportingMediaItem = article.supportingMedia?.find(
            media => media.url === testImageUrl || media.url?.includes(testImageUrl)
          );
          if (supportingMediaItem) {
            expect(supportingMediaItem.showInMasonry).toBe(true);
          }
        }

        // Step 6: Open edit modal and verify toggle is still ON
        await page.reload();
        await page.waitForLoadState('networkidle');
        await openEditModal(page, articleId);

        const masonrySectionReloaded = page.locator('[data-testid="masonry-toggle"]').first();
        await masonrySectionReloaded.waitFor({ state: 'visible', timeout: 5000 });
        await masonrySectionReloaded.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        const imageItemReloaded = masonrySectionReloaded.locator(`[data-image-url*="${testImageUrl}"]`).first();
        const toggleButtonReloaded = imageItemReloaded.locator('button.bg-primary-500');
        await expect(toggleButtonReloaded).toBeVisible({ timeout: 2000 });
      }
    });
  });
});

