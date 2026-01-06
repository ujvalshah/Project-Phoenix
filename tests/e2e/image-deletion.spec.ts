/**
 * E2E Test: Image Deletion Persistence
 * 
 * CRITICAL TEST: Verifies that deleted images stay deleted after page refresh
 * This test validates the fix for the image deletion race condition bug.
 */

import { test, expect } from '@playwright/test';
import {
  apiCreateArticle,
  apiFetchArticle,
  apiDeleteImage,
  verifyImageInArticle,
  getAllImageUrlsFromArticle,
  getAuthToken,
} from './helpers/api-helpers';
import {
  openEditModal,
  deleteImageInUI,
  verifyImageGone,
  verifyImageVisible,
  clickSaveButton,
  closeModal,
  waitForApiCall,
} from './helpers/nugget-helpers';
import { TEST_ARTICLE_DATA, TEST_USER_CREDENTIALS } from './helpers/test-data';

test.describe('Image Deletion', () => {
  let authToken: string;
  let testArticleId: string;
  const testImageUrl = 'https://picsum.photos/400/300?random=deletion-test';

  test.beforeAll(async ({ request }) => {
    // Get auth token for API calls
    authToken = await getAuthToken(
      TEST_USER_CREDENTIALS.email,
      TEST_USER_CREDENTIALS.password
    );
    
    if (!authToken) {
      test.skip();
      console.warn('Skipping tests: No authentication token. Please create a test user or set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables.');
    }
  });

  test.beforeEach(async ({ request }) => {
    // Create a test article with an image before each test
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
    // Cleanup: Delete test article
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

  test('deleted image stays deleted after page refresh', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');
    // Step 1: Navigate to the page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 2: Open edit modal
    await openEditModal(page, testArticleId);
    
    // Step 3: Verify image is visible
    await verifyImageVisible(page, testImageUrl);

    // Step 4: Delete the image
    await deleteImageInUI(page, testImageUrl);

    // Step 5: Wait for API call to complete
    await waitForApiCall(page);

    // Step 6: Verify image disappears from UI
    await verifyImageGone(page, testImageUrl);

    // Step 7: Click save button
    await clickSaveButton(page);

    // Step 8: Close modal
    await closeModal(page);

    // Step 9: Refresh the browser page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Step 10: Open edit modal again
    await openEditModal(page, testArticleId);

    // Step 11: CRITICAL: Verify image is still gone (not re-appeared)
    await verifyImageGone(page, testImageUrl);

    // Step 12: Fetch article from backend and verify image removed from all locations
    const article = await apiFetchArticle(testArticleId, authToken);
    
    // Verify image is NOT in images array
    expect(article.images || []).not.toContain(testImageUrl);
    
    // Verify image is NOT in primaryMedia
    expect(article.primaryMedia?.url).not.toBe(testImageUrl);
    
    // Verify image is NOT in supportingMedia
    const inSupportingMedia = article.supportingMedia?.some(
      media => media.url === testImageUrl
    );
    expect(inSupportingMedia).toBeFalsy();
    
    // Verify using helper function
    const imageExists = verifyImageInArticle(article, testImageUrl);
    expect(imageExists).toBe(false);
    
    // Verify getAllImageUrls doesn't include it
    const allImages = getAllImageUrlsFromArticle(article);
    expect(allImages).not.toContain(testImageUrl);
    
    // Additional verification: Check that no supportingMedia item references this image
    const supportingMediaWithImage = article.supportingMedia?.some(
      media => media.url?.toLowerCase().includes(testImageUrl.toLowerCase())
    );
    expect(supportingMediaWithImage).toBeFalsy();
  });

  test('image deletion handles API errors gracefully', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openEditModal(page, testArticleId);
    await verifyImageVisible(page, testImageUrl);

    // Intercept and fail the delete API call
    let routeIntercepted = false;
    await page.route('**/api/articles/*/images', route => {
      routeIntercepted = true;
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Server error' }),
      });
    });

    await deleteImageInUI(page, testImageUrl);
    await waitForApiCall(page);

    // Verify the route was intercepted (API call was made)
    expect(routeIntercepted).toBe(true);

    // Image should still be visible (rollback on error)
    await verifyImageVisible(page, testImageUrl);

    // Verify error message is shown (toast notification or error text)
    const errorMessage = page.locator('[role="alert"], .toast, text=/error|failed/i').first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify backend still has the image (deletion failed)
    const article = await apiFetchArticle(testArticleId, authToken);
    const imageExists = verifyImageInArticle(article, testImageUrl);
    expect(imageExists).toBe(true);
  });

  test('image deletion works after network recovery', async ({ page }) => {
    test.skip(!authToken, 'Authentication required');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openEditModal(page, testArticleId);
    await verifyImageVisible(page, testImageUrl);

    // First attempt: Block the API call
    let blockRequest = true;
    await page.route('**/api/articles/*/images', route => {
      if (blockRequest) {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Service unavailable' }),
        });
      } else {
        route.continue();
      }
    });

    // First attempt fails
    await deleteImageInUI(page, testImageUrl);
    await waitForApiCall(page);
    await verifyImageVisible(page, testImageUrl);

    // Enable requests again
    blockRequest = false;

    // Second attempt should succeed
    await deleteImageInUI(page, testImageUrl);
    await waitForApiCall(page);
    await verifyImageGone(page, testImageUrl);
  });

  test('multiple images can be deleted sequentially', async ({ page, request }) => {
    test.skip(!authToken, 'Authentication required');

    // Create article with multiple images
    const multiImageUrl1 = 'https://picsum.photos/400/300?random=multi-1';
    const multiImageUrl2 = 'https://picsum.photos/400/300?random=multi-2';

    const multiImageArticle = await apiCreateArticle(
      {
        ...TEST_ARTICLE_DATA.minimal,
        title: 'Multi-image test article',
        images: [multiImageUrl1, multiImageUrl2],
      },
      authToken
    );

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await openEditModal(page, multiImageArticle.id);

      // Verify both images visible
      await verifyImageVisible(page, multiImageUrl1);
      await verifyImageVisible(page, multiImageUrl2);

      // Delete first image
      await deleteImageInUI(page, multiImageUrl1);
      await waitForApiCall(page);
      await verifyImageGone(page, multiImageUrl1);
      await verifyImageVisible(page, multiImageUrl2);

      // Save after first deletion
      await clickSaveButton(page);
      await waitForApiCall(page);

      // Verify first deletion persisted
      const articleAfterFirst = await apiFetchArticle(multiImageArticle.id, authToken);
      expect(verifyImageInArticle(articleAfterFirst, multiImageUrl1)).toBe(false);
      expect(verifyImageInArticle(articleAfterFirst, multiImageUrl2)).toBe(true);

      // Delete second image
      await deleteImageInUI(page, multiImageUrl2);
      await waitForApiCall(page);
      await verifyImageGone(page, multiImageUrl2);

      // Save after second deletion
      await clickSaveButton(page);
      await waitForApiCall(page);

      // Verify both deletions persisted
      const articleAfterBoth = await apiFetchArticle(multiImageArticle.id, authToken);
      expect(verifyImageInArticle(articleAfterBoth, multiImageUrl1)).toBe(false);
      expect(verifyImageInArticle(articleAfterBoth, multiImageUrl2)).toBe(false);
    } finally {
      // Cleanup
      await request.delete(`/api/articles/${multiImageArticle.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {
        // Ignore cleanup errors
      });
    }
  });
});

