# Pagination Debug Guide

## Current Issue: Only 25 Items Visible

Diagnostic logging has been added to help identify the root cause.

## How to Debug

1. **Open Browser Console** (F12 → Console tab)

2. **Load the Feed** and scroll down

3. **Look for these log messages:**

### Expected Logs:

```
[useInfiniteArticles] Page accumulation: {
  pagesCount: 1,
  totalItems: 25,
  pageNumbers: [1],
  hasNextPage: true,
  pageSizes: [25]
}
```

After scrolling:
```
[InfiniteScrollTrigger] Intersection: { isIntersecting: true, ... }
[Feed] handleLoadMore called: { isFetchingNextPage: false, hasNextPage: true, currentItemsCount: 25 }
[useInfiniteArticles] Page accumulation: {
  pagesCount: 2,
  totalItems: 50,  // ← Should be 50, not 25!
  pageNumbers: [1, 2],
  hasNextPage: true,
  pageSizes: [25, 25]
}
```

## What to Check

### If pagesCount stays at 1:
- React Query is not accumulating pages
- Check if `fetchNextPage` is being called
- Check if API is returning correct `hasMore` value

### If totalItems stays at 25:
- Pages are not being accumulated
- Check `query.data.pages` in React DevTools
- Verify `flatMap` is working correctly

### If IntersectionObserver never fires:
- Check if trigger element is rendered
- Check if `hasMore` is true
- Verify scroll position reaches trigger

### If handleLoadMore never called:
- IntersectionObserver callback not firing
- Check browser console for errors
- Verify trigger element is in viewport

## Quick Fixes to Try

### Fix 1: Force React Query to Accumulate

If pages aren't accumulating, try this in `useInfiniteArticles.ts`:

```typescript
const articles = useMemo(() => {
  if (!query.data?.pages) return [];
  
  // Force accumulation - log each page
  const allArticles: Article[] = [];
  query.data.pages.forEach((page, index) => {
    console.log(`[DEBUG] Page ${index + 1}:`, page.data.length, 'items');
    allArticles.push(...page.data);
  });
  
  return allArticles;
}, [query.data]);
```

### Fix 2: Verify React Query Version

Check `package.json`:
```json
"@tanstack/react-query": "^5.90.12"
```

If version is < 5.0, infinite queries might not work correctly.

### Fix 3: Check Network Tab

1. Open DevTools → Network tab
2. Filter by "articles"
3. Scroll down
4. Verify requests: `page=1`, `page=2`, `page=3`
5. Check responses: Each should have `hasMore: true` (except last)

## Common Issues

### Issue 1: React Query Not Accumulating
**Symptom:** `pagesCount` stays at 1
**Fix:** Check if `getNextPageParam` returns correct value

### Issue 2: IntersectionObserver Not Firing
**Symptom:** No intersection logs
**Fix:** Check if trigger element is rendered and visible

### Issue 3: fetchNextPage Not Called
**Symptom:** No "handleLoadMore called" logs
**Fix:** Check `hasNextPage` value and `isFetchingNextPage` state

## Next Steps

1. Run the app with diagnostic logging
2. Check browser console for logs
3. Share the console output
4. We'll identify the exact issue and fix it



