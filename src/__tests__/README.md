# Infinite Scroll Feed Test Suite

Complete automated test suite for validating pagination, page accumulation, and infinite scroll behavior.

## Overview

This test suite ensures the **"only 25 items visible" bug never reoccurs** by comprehensively testing:

1. ✅ Page accumulation (items append, not replace)
2. ✅ fetchNextPage with correct page parameters
3. ✅ hasNextPage stops infinite scroll correctly
4. ✅ placeholderData regression safety
5. ✅ Sorting determinism
6. ✅ Filter reset behavior

## Test Structure

```
src/__tests__/
├── components/
│   └── Feed.test.tsx          # Feed component integration tests
├── hooks/
│   └── useInfiniteArticles.test.tsx  # Hook unit tests
├── utils/
│   ├── mockArticles.ts        # Mock article generators
│   ├── apiMocks.ts            # API client mocks
│   └── testSetup.ts           # Test utilities (IntersectionObserver, etc.)
├── setup.ts                   # Vitest global setup
└── README.md                  # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

## Test Files

### 1. `useInfiniteArticles.test.tsx`

Tests the infinite scroll hook in isolation:

- **Test 1:** Initial load renders first 25 items
- **Test 2:** Scrolling loads next page & appends items
- **Test 3:** hasNextPage stops infinite scroll at correct time
- **Test 4:** Re-render does NOT reset list to 25
- **Test 5:** Filter change resets pagination correctly
- **Test 6:** Deterministic sort ordering
- **Regression:** placeholderData safety

### 2. `Feed.test.tsx`

Tests the Feed component with IntersectionObserver:

- **Test 1:** Initial load renders first 25 items
- **Test 2:** Scrolling loads next page & appends items
- **Test 3:** Third page loads & stops when hasMore=false
- **Test 4:** Re-render does NOT reset list to 25
- **Test 5:** Filter change resets pagination
- **Test 6:** IntersectionObserver behavior
- **Edge Cases:** Empty results, errors, tag filtering

## Test Utilities

### `mockArticles.ts`

Helper functions for generating mock articles:

```typescript
// Generate single article
createMockArticle(id, publishedAt?, category?)

// Generate array of articles
createMockArticles(count, startId?, category?)

// Generate paginated API response
createMockPageResponse(page, limit?, total?, category?)

// Generate multiple page responses
createMockPageResponses(pages, limit?, total?)

// Verify article order
verifyArticleOrder(articles)

// Verify no duplicates
verifyNoDuplicates(articles)
```

### `apiMocks.ts`

Mock API client and service:

```typescript
// Mock API client
createMockApiClient(responses)

// Mock article service
createMockArticleService(responses)
```

### `testSetup.ts`

Browser API mocks:

```typescript
// Mock IntersectionObserver
const { triggerIntersection } = setupIntersectionObserver();

// Setup React Query
const { queryClient } = setupReactQuery();
```

## Key Test Scenarios

### Scenario 1: Page Accumulation

```typescript
// Load page 1 → 25 items
// Load page 2 → 50 items (appended)
// Load page 3 → 75 items (appended)
// Verify: items[0] is still article-1 (not replaced)
```

### Scenario 2: hasNextPage Behavior

```typescript
// When hasMore=false, fetchNextPage should not be called
// IntersectionObserver should not trigger new requests
```

### Scenario 3: Filter Reset

```typescript
// Change category → query key changes → pagination resets
// Should request page 1 only, not continue from previous page
```

### Scenario 4: Re-render Safety

```typescript
// After loading 3 pages (75 items)
// Component re-renders
// Should still show 75 items, not reset to 25
```

## Critical Assertions

These assertions **must pass** to prevent regression:

1. ✅ `articles.length === 25` after page 1
2. ✅ `articles.length === 50` after page 2 (NOT 25)
3. ✅ `articles[0].id === 'article-1'` after page 2 (NOT replaced)
4. ✅ `hasNextPage === false` when no more pages
5. ✅ `fetchNextPage` called with incrementing page numbers (1, 2, 3)
6. ✅ No duplicate article IDs in accumulated list
7. ✅ Articles maintain descending order across pages

## Regression Prevention

The test suite specifically prevents these bugs:

### Bug #1: placeholderData Interference
- **Test:** `Regression: placeholderData Safety`
- **Ensures:** Pages accumulate correctly without placeholderData

### Bug #2: Items Reset to 25
- **Test:** `Test 4: Re-render Does NOT Reset List to 25`
- **Ensures:** Component re-render doesn't reset accumulated items

### Bug #3: Items Replace Instead of Append
- **Test:** `Test 2: Scrolling Loads Next Page & Appends Items`
- **Ensures:** New items are appended, first item remains

### Bug #4: Infinite Scroll Never Stops
- **Test:** `Test 3: hasNextPage Stops Infinite Scroll`
- **Ensures:** Scroll stops when hasMore=false

## Adding New Tests

When adding new pagination features, add tests for:

1. **Page accumulation** - Verify items append correctly
2. **hasNextPage logic** - Verify stops at correct time
3. **Filter reset** - Verify pagination resets on filter change
4. **Edge cases** - Empty results, errors, network failures

## Dependencies

Required packages (add to `package.json` if missing):

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "vitest": "^1.0.0"
  }
}
```

## Troubleshooting

### Tests fail with "IntersectionObserver is not defined"
- Ensure `setupIntersectionObserver()` is called in test
- Check `testSetup.ts` is properly configured

### Tests fail with "QueryClient not found"
- Wrap component in `QueryClientProvider`
- Use `setupReactQuery()` helper

### Mock articles not generating correctly
- Check `createMockArticle()` parameters
- Verify `publishedAt` timestamps are sequential

### Tests are flaky
- Add `waitFor()` for async operations
- Use `vi.advanceTimersByTime()` for timer-based code
- Ensure proper cleanup in `afterEach`

## Coverage Goals

Target coverage for pagination logic:

- **useInfiniteArticles hook:** 100%
- **Feed component pagination:** 90%+
- **Page accumulation logic:** 100%
- **hasNextPage logic:** 100%

## Continuous Integration

These tests should run in CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage
```

## Maintenance

- **Update mocks** when Article type changes
- **Add tests** when new pagination features are added
- **Review tests** when fixing pagination bugs
- **Keep tests fast** (< 5 seconds total)

---

**Last Updated:** 2024-12-19  
**Test Suite Version:** 1.0.0



