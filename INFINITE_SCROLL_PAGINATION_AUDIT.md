    # Infinite Scroll + Feed Pagination Audit Report

    **Date:** 2024-12-19  
    **Scope:** End-to-end audit of infinite scroll and feed pagination implementation  
    **Issue:** Older posts are not loading or visible

    ---

    ## Executive Summary

    The infinite scroll implementation has **one critical issue** and **one potential issue** that prevent older posts from loading correctly:

    1. **CRITICAL:** Client-side "Today" filter breaks pagination - `hasNextPage` is based on backend's unfiltered data, not filtered results
    2. **POTENTIAL:** No visibility filter on backend - private articles may be included in public feeds

    ---

    ## 1. Code Location Map

    ### Backend
    - **API Route:** `server/src/routes/articles.ts` (line 8)
    - **Controller:** `server/src/controllers/articlesController.ts` (lines 17-90)
    - **Model:** `server/src/models/Article.ts` (lines 115-156)
    - **Query Logic:** Offset-based pagination using `skip` and `limit`

    ### Frontend
    - **Infinite Scroll Hook:** `src/hooks/useInfiniteArticles.ts` (lines 32-103)
    - **Feed Component:** `src/components/Feed.tsx` (lines 98-207)
    - **IntersectionObserver:** `src/components/Feed.tsx` (lines 45-96)
    - **Service Layer:** `src/services/articleService.ts` (lines 8-49)
    - **API Adapter:** `src/services/adapters/RestAdapter.ts` (lines 19-28)

    ---

    ## 2. Backend Pagination Analysis

    ### 2.1 Pagination Style
    **Type:** Offset-based pagination (page + limit)

    ```typescript
    // server/src/controllers/articlesController.ts:20-22
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;
    ```

    **✅ CORRECT:** Standard offset calculation

    ### 2.2 Database Query Structure

    ```typescript
    // server/src/controllers/articlesController.ts:70-77
    const [articles, total] = await Promise.all([
    Article.find(query)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .lean(),
    Article.countDocuments(query)
    ]);
    ```

    **✅ CORRECT:** 
    - Filters applied before pagination
    - Sort applied before pagination
    - Skip/limit applied correctly
    - Total count uses same query (consistent)

    ### 2.3 Ordering Logic

    ```typescript
    // server/src/controllers/articlesController.ts:62-68
    const sortMap: Record<string, any> = {
    'latest': { publishedAt: -1 },
    'oldest': { publishedAt: 1 },
    'title': { title: 1 },
    'title-desc': { title: -1 }
    };
    const sortOrder = sortMap[sort as string] || { publishedAt: -1 }; // Default: latest first
    ```

    **✅ CORRECT:** 
    - Default sort is `publishedAt: -1` (newest first)
    - Supports multiple sort options
    - Consistent ordering

    ### 2.4 hasMore Calculation

    ```typescript
    // server/src/controllers/articlesController.ts:84
    hasMore: page * limit < total
    ```

    **✅ CORRECT:** Standard calculation
    - Page 1, limit 25, total 100 → `1 * 25 < 100` = `true` ✅
    - Page 4, limit 25, total 100 → `4 * 25 < 100` = `false` ✅
    - Page 5, limit 25, total 100 → `5 * 25 < 100` = `false` ✅

    ### 2.5 Filters Applied

    **Query Object Construction:**
    ```typescript
    // server/src/controllers/articlesController.ts:25-59
    const query: any = {};

    // Author filter
    if (authorId) {
    query.authorId = authorId;
    }

    // Search query
    if (q && typeof q === 'string' && q.trim().length > 0) {
    query.$or = [
        { title: regex },
        { excerpt: regex },
        { content: regex },
        { tags: regex }
    ];
    }

    // Category filter
    if (category && typeof category === 'string') {
    query.categories = { $in: [createExactMatchRegex(category)] };
    } else if (categories) {
    // Array handling
    query.categories = { 
        $in: categoryArray
        .filter((cat): cat is string => typeof cat === 'string')
        .map((cat: string) => createExactMatchRegex(cat))
    };
    }
    ```

    **⚠️ POTENTIAL ISSUE:** No `visibility` filter
    - Backend does NOT filter by `visibility: 'public'`
    - Private articles may be included in public feeds
    - **Impact:** Low (may be intentional for authenticated users)

    **✅ CORRECT:** No draft/archived/soft-deleted filters (these fields don't exist in schema)

    ### 2.6 Exact DB Query (Example)

    For page 2, limit 25, category "Technology", sort "latest":

    ```javascript
    Article.find({
    categories: { $in: [/^Technology$/i] }
    })
    .sort({ publishedAt: -1 })
    .skip(25)
    .limit(25)
    .lean()
    ```

    **✅ CORRECT:** Query structure is sound

    ---

    ## 3. Frontend Infinite Scroll Analysis

    ### 3.1 Infinite Query Hook

    ```typescript
    // src/hooks/useInfiniteArticles.ts:43-71
    const query = useInfiniteQuery<PaginatedArticlesResponse>({
    queryKey: ['articles', 'infinite', searchQuery.trim(), activeCategory, sortOrder, limit],
    queryFn: async ({ pageParam = 1 }) => {
        const categoryParam = activeCategory === 'All' || activeCategory === 'Today'
        ? []
        : [activeCategory];

        const filters: FilterState = {
        query: searchQuery.trim() || undefined,
        categories: categoryParam,
        tag: null,
        sort: sortOrder,
        limit,
        };

        return articleService.getArticles(filters, pageParam as number);
    },
    getNextPageParam: (lastPage) => {
        return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    });
    ```

    **✅ CORRECT:**
    - Query key includes all filter parameters (triggers reset on change)
    - `getNextPageParam` correctly uses backend's `hasMore`
    - Page accumulation handled by React Query

    ### 3.2 Page Accumulation

    ```typescript
    // src/hooks/useInfiniteArticles.ts:74-76
    const articles = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.data) || [];
    }, [query.data?.pages]);
    ```

    **✅ CORRECT:** All pages are accumulated into a single array

    ### 3.3 Client-Side "Today" Filter

    ```typescript
    // src/hooks/useInfiniteArticles.ts:78-92
    const filteredArticles = useMemo(() => {
    if (activeCategory !== 'Today') return articles;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    return articles.filter((article) => {
        const publishedDate = new Date(article.publishedAt);
        return publishedDate >= today && publishedDate <= todayEnd;
    });
    }, [articles, activeCategory]);
    ```

    **🔴 CRITICAL ISSUE:** Client-side filtering breaks pagination

    **Problem:**
    1. Backend returns ALL articles (not filtered by date)
    2. Frontend filters to only show today's articles
    3. `hasNextPage` is based on backend's `hasMore` (unfiltered data)
    4. If user scrolls and backend returns page 2 with 25 items, but all are older than today, they get filtered out
    5. User sees no new items, but `hasNextPage` is still `true`
    6. Infinite scroll keeps trying to load more pages, but all items are filtered out

    **Evidence:**
    - Line 98: `hasNextPage: query.hasNextPage ?? false` - uses backend's `hasNextPage`, not filtered results
    - Line 95: `articles: filteredArticles` - returns filtered articles, but `hasNextPage` is not recalculated

    ### 3.4 IntersectionObserver Implementation

    ```typescript
    // src/components/Feed.tsx:58-82
    useEffect(() => {
    if (!hasMore) return;
    
    const observer = new IntersectionObserver(
        (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
            callbackRef.current();
        }
        },
        {
        rootMargin: '300px', // Prefetch distance
        threshold: 0,
        }
    );

    const currentTrigger = triggerRef.current;
    if (currentTrigger) {
        observer.observe(currentTrigger);
    }

    return () => {
        observer.disconnect();
    };
    }, [hasMore]);
    ```

    **✅ CORRECT:**
    - Observer only attached when `hasMore` is true
    - Proper cleanup on unmount
    - Uses ref for callback to avoid re-subscription

    ### 3.5 Load More Handler

    ```typescript
    // src/components/Feed.tsx:141-145
    const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
        fetchNextPage();
    }
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);
    ```

    **✅ CORRECT:** Prevents duplicate requests

    ### 3.6 API Request Flow

    **Request Chain:**
    1. `Feed.tsx` → `useInfiniteArticles` → `articleService.getArticles`
    2. `articleService.getArticles` → `storageService.getArticlesPaginated`
    3. `storageService.getArticlesPaginated` → `RestAdapter.getArticlesPaginated`
    4. `RestAdapter.getArticlesPaginated` → `apiClient.get('/articles?page=X&limit=25&category=Y&sort=Z')`

    **✅ CORRECT:** Request parameters are correctly passed through the chain

    ---

    ## 4. Root Cause Analysis

    ### 🔴 ROOT CAUSE #1: Client-Side "Today" Filter Breaks Pagination

    **Location:** `src/hooks/useInfiniteArticles.ts:78-98`

    **Problem:**
    - Backend returns unfiltered articles (all dates)
    - Frontend filters to only show today's articles
    - `hasNextPage` is based on backend's `hasMore`, not filtered results
    - When user scrolls, backend returns more pages, but all items are filtered out
    - User sees no new items, but infinite scroll keeps trying to load more

    **Impact:** HIGH
    - Users on "Today" category cannot see older posts
    - Infinite scroll keeps loading pages with no visible results
    - Wastes API calls and bandwidth

    **Evidence:**
    ```typescript
    // Line 95: Returns filtered articles
    articles: filteredArticles,

    // Line 98: But hasNextPage is from unfiltered backend response
    hasNextPage: query.hasNextPage ?? false,
    ```

    **Repro Steps:**
    1. Set activeCategory to "Today"
    2. Scroll to trigger infinite scroll
    3. Backend returns page 2 with 25 items (all older than today)
    4. Frontend filters them out (0 items shown)
    5. `hasNextPage` is still `true` (based on backend's `hasMore`)
    6. Infinite scroll keeps loading more pages
    7. User never sees older posts

    ### ⚠️ ROOT CAUSE #2: No Visibility Filter on Backend

    **Location:** `server/src/controllers/articlesController.ts:25-59`

    **Problem:**
    - Backend does NOT filter by `visibility: 'public'`
    - Private articles may be included in public feeds

    **Impact:** LOW (may be intentional)
    - If intentional, this is fine
    - If not, private articles may leak into public feeds

    **Evidence:**
    ```typescript
    // Query object construction - no visibility filter
    const query: any = {};
    // Only filters: authorId, q (search), category/categories
    ```

    ---

    ## 5. Trace Scenario Analysis

    ### Scenario: User Scrolls Through "Today" Category

    **Step 1: Initial Load (Page 1)**
    - Request: `GET /api/articles?page=1&limit=25&sort=latest`
    - Backend Response: `{ data: [25 articles], total: 100, page: 1, limit: 25, hasMore: true }`
    - Frontend Filter: 5 articles match "Today" filter
    - User Sees: 5 articles
    - `hasNextPage`: `true` (based on backend's `hasMore`)

    **Step 2: Scroll Trigger (Page 2)**
    - Request: `GET /api/articles?page=2&limit=25&sort=latest`
    - Backend Response: `{ data: [25 articles], total: 100, page: 2, limit: 25, hasMore: true }`
    - Frontend Filter: 0 articles match "Today" filter (all are older)
    - User Sees: Still 5 articles (no new items)
    - `hasNextPage`: Still `true` (backend says there are more pages)

    **Step 3: Scroll Trigger (Page 3)**
    - Request: `GET /api/articles?page=3&limit=25&sort=latest`
    - Backend Response: `{ data: [25 articles], total: 100, page: 3, limit: 25, hasMore: true }`
    - Frontend Filter: 0 articles match "Today" filter
    - User Sees: Still 5 articles
    - `hasNextPage`: Still `true`

    **Result:** Infinite scroll keeps loading, but user never sees older posts because they're all filtered out client-side.

    ---

    ## 6. Fix Plan

    ### Fix #1: Recalculate hasNextPage After Client-Side Filtering

    **File:** `src/hooks/useInfiniteArticles.ts`

    **Change:**
    ```typescript
    // BEFORE (lines 94-98)
    return {
    articles: filteredArticles,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: () => query.fetchNextPage(),
    error: query.error as Error | null,
    refetch: () => query.refetch(),
    };

    // AFTER
    return {
    articles: filteredArticles,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: useMemo(() => {
        // If "Today" filter is active, check if there are more pages with today's articles
        if (activeCategory === 'Today') {
        // Check if the last page had any items after filtering
        const lastPage = query.data?.pages[query.data.pages.length - 1];
        if (lastPage) {
            const lastPageFiltered = lastPage.data.filter((article) => {
            const publishedDate = new Date(article.publishedAt);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            return publishedDate >= today && publishedDate <= todayEnd;
            });
            // If last page had items after filtering, there might be more
            // If last page had no items after filtering, stop loading
            if (lastPageFiltered.length === 0 && query.data.pages.length > 1) {
            return false; // No more today's articles
            }
        }
        }
        return query.hasNextPage ?? false;
    }, [query.hasNextPage, query.data?.pages, activeCategory]),
    fetchNextPage: () => query.fetchNextPage(),
    error: query.error as Error | null,
    refetch: () => query.refetch(),
    };
    ```

    **Better Solution:** Move "Today" filter to backend

    **File:** `server/src/controllers/articlesController.ts`

    **Change:**
    ```typescript
    // Add date filter for "Today" category
    if (category === 'Today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    query.publishedAt = {
        $gte: today.toISOString(),
        $lte: todayEnd.toISOString()
    };
    }
    ```

    **And update frontend:**
    ```typescript
    // src/hooks/useInfiniteArticles.ts:48-50
    const categoryParam = activeCategory === 'All'
    ? []
    : activeCategory === 'Today'
    ? ['Today'] // Send "Today" to backend
    : [activeCategory];
    ```

    **And remove client-side filter:**
    ```typescript
    // src/hooks/useInfiniteArticles.ts:78-92 - REMOVE THIS
    // Backend now handles "Today" filter
    ```

    ### Fix #2: Add Visibility Filter (Optional)

    **File:** `server/src/controllers/articlesController.ts`

    **Change:**
    ```typescript
    // Add visibility filter (if needed)
    // Only show public articles unless user is authenticated and requesting their own
    if (!authorId) {
    query.visibility = 'public';
    }
    ```

    **Note:** Only apply this fix if private articles should not appear in public feeds.

    ---

    ## 7. Recommended Implementation Order

    1. **IMMEDIATE:** Fix #1 - Move "Today" filter to backend (recommended) OR recalculate `hasNextPage` after filtering
    2. **OPTIONAL:** Fix #2 - Add visibility filter if needed

    ---

    ## 8. Testing Checklist

    After implementing fixes:

    - [ ] Test "Today" category with infinite scroll
    - [ ] Verify older posts load when scrolling past today's posts
    - [ ] Test "All" category with infinite scroll
    - [ ] Test specific category with infinite scroll
    - [ ] Test search query with infinite scroll
    - [ ] Verify `hasNextPage` is `false` when no more pages
    - [ ] Verify IntersectionObserver stops when `hasMore` is `false`
    - [ ] Test rapid scrolling (race condition protection)
    - [ ] Test filter changes reset pagination correctly

    ---

    ## 9. Additional Findings

    ### ✅ Working Correctly
    - Backend pagination logic (skip/limit)
    - `hasMore` calculation
    - Sort ordering
    - IntersectionObserver implementation
    - Page accumulation
    - Query key management (resets on filter change)

    ### ⚠️ Potential Improvements
    - Consider cursor-based pagination for better performance with large datasets
    - Add request deduplication for rapid scroll events
    - Consider virtual scrolling for very long lists

    ---

    ## 10. Conclusion

    The primary issue is the **client-side "Today" filter breaking pagination**. The backend correctly returns all articles, but the frontend filters them client-side without recalculating `hasNextPage`. This causes infinite scroll to keep loading pages even when all items are filtered out.

    **Recommended Fix:** Move the "Today" filter to the backend so pagination works correctly with filtered data.

    ---

    **Audit Completed By:** AI Code Auditor  
    **Date:** 2024-12-19



