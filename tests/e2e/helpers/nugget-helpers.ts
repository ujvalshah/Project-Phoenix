/**
 * Nugget Helpers for E2E Tests
 *
 * UI interaction helpers for CreateNuggetModal
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for the CreateNuggetModal to be visible
 */
export async function waitForModal(page: Page): Promise<void> {
  await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  // Wait for modal content to load
  await page.waitForTimeout(500);
}

/**
 * Open the edit modal for an article
 * Assumes the article list is already loaded
 */
export async function openEditModal(page: Page, articleId: string): Promise<void> {
  // Find the article card by data-article-id attribute
  const articleCard = page.locator(`[data-article-id="${articleId}"]`).first();
  await articleCard.waitFor({ state: 'visible' });
  await articleCard.hover();

  // Find and click edit button - look for common edit button patterns
  const editButton = articleCard.locator(
    'button[aria-label*="Edit"], button[aria-label*="edit"], button:has-text("Edit")'
  ).first();
  await editButton.waitFor({ state: 'visible' });
  await editButton.click();

  await waitForModal(page);
}

/**
 * Click the delete button for a specific image in the modal
 */
export async function deleteImageInUI(page: Page, imageUrl: string): Promise<void> {
  // Set up dialog handler before triggering deletion
  page.once('dialog', async dialog => {
    if (dialog.type() === 'confirm') {
      await dialog.accept();
    }
  });

  // Find the image container using data-image-url attribute (added for E2E testing)
  const imageContainer = page.locator(`[data-image-url*="${imageUrl}"]`).first();
  await imageContainer.waitFor({ state: 'visible' });

  // Hover to ensure delete button is visible
  await imageContainer.hover();

  // Find and click delete button within the container
  const deleteButton = imageContainer.locator('button[aria-label="Delete image"]').first();
  await deleteButton.waitFor({ state: 'visible' });
  await deleteButton.click();

  // Wait for deletion to process
  await page.waitForTimeout(500);
}

/**
 * Verify an image is gone from the UI
 */
export async function verifyImageGone(page: Page, imageUrl: string): Promise<void> {
  // Check both img src and data-image-url attributes
  const imageByDataAttr = page.locator(`[data-image-url*="${imageUrl}"]`);
  await expect(imageByDataAttr).toHaveCount(0);
}

/**
 * Verify an image is visible in the UI
 */
export async function verifyImageVisible(page: Page, imageUrl: string): Promise<void> {
  // Use data-image-url attribute for reliable selection
  const imageContainer = page.locator(`[data-image-url*="${imageUrl}"]`).first();
  await expect(imageContainer).toBeVisible();
}

/**
 * Count how many times an image appears in the UI (for duplication testing)
 */
export async function countImageOccurrences(page: Page, imageUrl: string): Promise<number> {
  // Count occurrences using data-image-url attribute within existing-images section
  const existingImagesSection = page.locator('[data-testid="existing-images"]');
  const imagesInSection = existingImagesSection.locator(`[data-image-url*="${imageUrl}"]`);
  return await imagesInSection.count();
}

/**
 * Toggle masonry visibility for an image
 */
export async function toggleMasonryForImage(
  page: Page,
  imageUrl: string,
  showInMasonry: boolean
): Promise<void> {
  // Find the masonry toggle section by data-testid
  const masonrySection = page.locator('[data-testid="masonry-toggle"]').first();
  await masonrySection.scrollIntoViewIfNeeded();

  // Find the media item by data-image-url
  const imageItem = masonrySection.locator(`[data-image-url*="${imageUrl}"]`).first();
  await imageItem.waitFor({ state: 'visible' });

  // The toggle is a button (not checkbox) - find the toggle button
  const toggleButton = imageItem.locator('button').first();
  const isCurrentlySelected = await imageItem.locator('.bg-primary-500').count() > 0;

  if (isCurrentlySelected !== showInMasonry) {
    await toggleButton.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Set masonry title for an image
 */
export async function setMasonryTitle(
  page: Page,
  imageUrl: string,
  title: string
): Promise<void> {
  const masonrySection = page.locator('[data-testid="masonry-toggle"]').first();
  await masonrySection.scrollIntoViewIfNeeded();

  // Find the title input - it's in a separate section below the toggle grid
  // The title inputs are in the "Masonry Tile Titles" section
  const titleInputs = masonrySection.locator('input[type="text"]');
  const firstInput = titleInputs.first();
  await firstInput.waitFor({ state: 'visible' });
  await firstInput.fill(title);
  await page.waitForTimeout(300);
}

/**
 * Click the save button in the modal
 */
export async function clickSaveButton(page: Page): Promise<void> {
  const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
  await saveButton.waitFor({ state: 'visible' });
  await saveButton.click();

  // Wait for save to complete
  await page.waitForTimeout(1000);
}

/**
 * Close the modal
 */
export async function closeModal(page: Page): Promise<void> {
  const closeButton = page.locator('button[aria-label="Close modal"]').first();
  await closeButton.click();

  // Wait for modal to close
  await page.waitForSelector('[role="dialog"]', { state: 'hidden' }).catch(() => {
    // Modal might already be closed
  });
}

/**
 * Wait for API call to complete (by waiting for network idle)
 */
export async function waitForApiCall(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

/**
 * Open the create modal
 */
export async function openCreateModal(page: Page): Promise<void> {
  // Find and click the create/add button
  const createButton = page.locator(
    'button[aria-label*="Create"], button[aria-label*="Add"], button:has-text("Create"), button:has-text("New")'
  ).first();
  await createButton.waitFor({ state: 'visible' });
  await createButton.click();

  await waitForModal(page);
}

/**
 * Add an image URL in create mode
 */
export async function addImageUrl(page: Page, imageUrl: string): Promise<void> {
  // Find the URL input field
  const urlInput = page.locator('input[placeholder*="URL"], input[type="url"]').first();
  await urlInput.waitFor({ state: 'visible' });
  await urlInput.fill(imageUrl);

  // Press Enter or click Add button
  await urlInput.press('Enter');
  await page.waitForTimeout(500);
}

/**
 * Fill in the article title
 */
export async function fillTitle(page: Page, title: string): Promise<void> {
  const titleInput = page.locator('input[placeholder*="Title"], input[name="title"]').first();
  await titleInput.waitFor({ state: 'visible' });
  await titleInput.fill(title);
}

/**
 * Fill in the article content
 */
export async function fillContent(page: Page, content: string): Promise<void> {
  const contentInput = page.locator('textarea, [contenteditable="true"]').first();
  await contentInput.waitFor({ state: 'visible' });
  await contentInput.fill(content);
}

/**
 * Verify error message is displayed
 */
export async function verifyErrorMessage(page: Page): Promise<void> {
  const errorMessage = page.locator('[role="alert"], .error, [class*="error"], text=/error|failed/i').first();
  await expect(errorMessage).toBeVisible();
}

