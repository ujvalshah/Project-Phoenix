# Quick Start: Running Infinite Scroll Tests

## Prerequisites

Install required dependencies:

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

## Run Tests

```bash
# Run all infinite scroll tests
npm test -- src/__tests__/hooks/useInfiniteArticles.test.tsx src/__tests__/components/Feed.test.tsx

# Run in watch mode
npm run test:watch -- src/__tests__

# Run with coverage
npm run test:coverage -- src/__tests__/hooks src/__tests__/components
```

## Test Structure

- **Hook Tests:** `src/__tests__/hooks/useInfiniteArticles.test.tsx`
- **Component Tests:** `src/__tests__/components/Feed.test.tsx`
- **Utilities:** `src/__tests__/utils/`

## Key Tests to Run After Changes

After modifying pagination logic, run these critical tests:

```bash
# Test page accumulation (prevents "only 25 items" bug)
npm test -- -t "should append items when fetchNextPage is called"

# Test placeholderData regression
npm test -- -t "should accumulate pages correctly without placeholderData"

# Test re-render safety
npm test -- -t "should maintain accumulated items after component re-render"
```

## Troubleshooting

**Error: "jsdom is not installed"**
```bash
npm install --save-dev jsdom
```

**Error: "@testing-library/react not found"**
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

**Tests are slow**
- Check for real API calls (should all be mocked)
- Verify timers are properly mocked

## Expected Output

All tests should pass with output like:

```
✓ useInfiniteArticles Hook > Test 1: Initial Load Renders First 25 Items
✓ useInfiniteArticles Hook > Test 2: Scrolling Loads Next Page & Appends Items
✓ useInfiniteArticles Hook > Test 3: hasNextPage Stops Infinite Scroll
✓ useInfiniteArticles Hook > Test 4: Re-render Does NOT Reset List to 25
✓ Feed Component > Test 1: Initial Load Renders First 25 Items
✓ Feed Component > Test 2: Scrolling Loads Next Page & Appends Items
...

Test Files  2 passed (2)
     Tests  15 passed (15)
```



