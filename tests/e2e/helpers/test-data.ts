/**
 * Test Data Fixtures
 * 
 * Sample data for E2E tests
 */

export const TEST_IMAGE_URLS = {
  // Use placeholder image service for testing
  sample1: 'https://picsum.photos/400/300?random=1',
  sample2: 'https://picsum.photos/400/300?random=2',
  sample3: 'https://picsum.photos/400/300?random=3',
  // Duplicate URL (same image, different query params should be normalized)
  duplicate: 'https://picsum.photos/400/300?random=1&v=2',
};

export const TEST_ARTICLE_DATA = {
  minimal: {
    title: 'Test Article',
    content: 'This is a test article for E2E testing.',
    tags: ['test'],
    visibility: 'public' as const,
  },
  
  withImage: {
    title: 'Article with Image',
    content: 'This article has an image.',
    tags: ['test', 'image'],
    visibility: 'public' as const,
    images: [TEST_IMAGE_URLS.sample1],
  },
  
  withDuplicateImages: {
    title: 'Article with Duplicate Images',
    content: 'This article has the same image in multiple locations.',
    tags: ['test', 'duplicate'],
    visibility: 'public' as const,
    images: [TEST_IMAGE_URLS.sample1],
    primaryMedia: {
      type: 'image' as const,
      url: TEST_IMAGE_URLS.sample1,
    },
    supportingMedia: [
      {
        type: 'image' as const,
        url: TEST_IMAGE_URLS.sample1,
        showInMasonry: false,
      },
    ],
  },
  
  withMultipleImages: {
    title: 'Article with Multiple Images',
    content: 'This article has multiple images.',
    tags: ['test', 'multiple'],
    visibility: 'public' as const,
    images: [TEST_IMAGE_URLS.sample1, TEST_IMAGE_URLS.sample2, TEST_IMAGE_URLS.sample3],
  },
};

export const TEST_USER_CREDENTIALS = {
  // These should be set via environment variables or created in test setup
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
};

