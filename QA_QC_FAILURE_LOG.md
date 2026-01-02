# QA/QC Failure Log
**Generated:** Post-Execution Audit  
**Scope:** Phase 1 Debt Closure - Main App Feed Pagination Alignment  
**Date:** Current Session

---

## Issue #001
**ID:** FAIL-001  
**Description:** Unsafe type casting in articleService.getArticles() - runtime failure risk if adapter is not RestAdapter  
**Location:** `src/services/articleService.ts` → `getArticles()` method (line 24)  
**Severity:** P1 (High)  
**Root Cause:** Implementation bug  
**Details:**
```typescript
const adapter = storageService as unknown as RestAdapter;
if (adapter && typeof (adapter as any).getArticlesPaginated === 'function') {
```
This double-casting bypasses TypeScript safety. If `storageService` returns `LocalAdapter` or any other adapter type, the runtime check will fail silently and fall back to incorrect behavior.

**Recommended Action:** 
- Add proper type guard or interface check
- Use adapter factory pattern with type-safe method detection
- Consider adding `getArticlesPaginated` to `IAdapter` interface

**Requires rollback?** No (can be fixed in-place)

---

## Issue #002
**ID:** FAIL-002  
**Description:** Fallback path in articleService constructs fake pagination metadata  
**Location:** `src/services/articleService.ts` → `getArticles()` method (lines 35-47)  
**Severity:** P1 (High)  
**Root Cause:** Implementation bug  
**Details:**
The fallback constructs `{ total: articles.length, hasMore: articles.length === limit }` which is incorrect. If 25 articles are returned, it claims `total: 25` and `hasMore: true`, misleading consumers about actual dataset size.

**Recommended Action:**
- Remove fallback entirely (fail fast if RestAdapter unavailable)
- Or return proper error/undefined if paginated method unavailable
- Document that RestAdapter is required for production

**Requires rollback?** No (can be fixed in-place)

---

## Issue #003
**ID:** FAIL-003  
**Description:** useArticles hook does not support incremental loading (infinite scroll)  
**Location:** `src/hooks/useArticles.ts` → `useArticles()` hook (entire implementation)  
**Severity:** P2 (Medium)  
**Root Cause:** Missing contract / Architectural debt  
**Details:**
Hook accepts `page` parameter but always replaces data instead of appending. Query key includes `page`, so changing page invalidates cache and fetches fresh data. No mechanism to accumulate results across pages for infinite scroll.

**Recommended Action:**
- Implement `useInfiniteQuery` from TanStack Query
- Add `fetchNextPage` function to hook return
- Accumulate results: `allArticles = pages.flatMap(p => p.data)`
- Update HomePage to use infinite scroll pattern

**Requires rollback?** No (enhancement, not breaking)

---

## Issue #004
**ID:** FAIL-004  
**Description:** Categories and tag filters silently ignored - user confusion  
**Location:** `src/services/articleService.ts` → `getArticles()` method (lines 17-19)  
**Severity:** P2 (Medium)  
**Root Cause:** Architectural debt / Missing contract  
**Details:**
Filters are passed to service but backend doesn't support them. No user feedback that filters are ignored. HomePage UI shows category/tag filters but they have no effect.

**Recommended Action:**
- Document limitation clearly in code comments (done)
- Add console warning in development mode
- Consider UI indicator showing "Search only" when categories/tags selected
- Future: Add backend support for category/tag filtering

**Requires rollback?** No (documentation/UX improvement)

---

## Issue #005
**ID:** FAIL-005  
**Description:** Sort order "oldest" does not work - backend limitation not handled  
**Location:** `src/services/articleService.ts` → `getArticles()` method (line 19)  
**Severity:** P2 (Medium)  
**Root Cause:** Architectural debt  
**Details:**
Backend always sorts by `publishedAt: -1` (latest first). Frontend accepts `sort: 'oldest'` but ignores it. No client-side reversal implemented.

**Recommended Action:**
- Document limitation (done)
- Add client-side sort reversal for "oldest" if needed
- Or disable "oldest" option in UI when using backend pagination
- Future: Add backend support for sort order parameter

**Requires rollback?** No (can add client-side reversal if needed)

---

## Issue #006
**ID:** FAIL-006  
**Description:** MySpacePage still uses getAllArticles() without pagination  
**Location:** `src/pages/MySpacePage.tsx` → `loadData()` function (line 98)  
**Severity:** P2 (Medium)  
**Root Cause:** AI scope creep / Missing contract  
**Details:**
MySpacePage calls `storageService.getAllArticles()` without pagination params. If user has many articles, this fetches entire dataset. Not addressed in Phase 1 scope but represents same architectural debt.

**Recommended Action:**
- Add pagination to MySpacePage article fetching
- Use same paginated pattern as main feed
- Consider separate phase for user profile pages

**Requires rollback?** No (separate issue, not blocking)

---

## Issue #007
**ID:** FAIL-007  
**Description:** RestAdapter.getArticlesPaginated() not part of IAdapter interface  
**Location:** `src/services/adapters/IAdapter.ts` → interface definition  
**Severity:** P3 (Low)  
**Root Cause:** Architectural debt  
**Details:**
New method `getArticlesPaginated()` added to RestAdapter but not declared in IAdapter interface. LocalAdapter doesn't implement it. Type system doesn't enforce contract.

**Recommended Action:**
- Add method to IAdapter interface
- Implement stub in LocalAdapter (throw error or return empty)
- Ensures type safety across adapters

**Requires rollback?** No (can be added without breaking changes)

---

## Issue #008
**ID:** FAIL-008  
**Description:** useArticles hook return shape may break existing consumers  
**Location:** `src/hooks/useArticles.ts` → return statement (lines 42-45)  
**Severity:** P1 (High)  
**Root Cause:** Implementation bug  
**Details:**
Hook spreads `...query` but overrides `data` property. This may break code expecting full TanStack Query return shape (e.g., `query.data` containing full pagination metadata). HomePage expects `data: Article[]` which works, but other consumers might expect `query.data` to be PaginatedArticlesResponse.

**Recommended Action:**
- Verify all consumers of useArticles hook
- Consider returning both `articles` and `pagination` properties
- Or maintain full query shape and add `articles` as alias
- Document breaking change if any

**Requires rollback?** Maybe (depends on consumer compatibility)

---

## Issue #009
**ID:** FAIL-009  
**Description:** No error handling for backend pagination failures  
**Location:** `src/services/articleService.ts` → `getArticles()` method  
**Severity:** P2 (Medium)  
**Root Cause:** Missing contract  
**Details:**
If `getArticlesPaginated()` throws error, fallback path executes. Fallback may mask real errors. No distinction between "method unavailable" vs "API failure".

**Recommended Action:**
- Add try/catch around getArticlesPaginated call
- Distinguish adapter method missing vs API failure
- Propagate API errors to caller (useArticles hook)
- Remove silent fallback

**Requires rollback?** No (can be fixed in-place)

---

## Issue #010
**ID:** FAIL-010  
**Description:** Query key includes filters that backend ignores  
**Location:** `src/hooks/useArticles.ts` → queryKey array (line 24)  
**Severity:** P3 (Low)  
**Root Cause:** Implementation bug  
**Details:**
Query key includes `selectedCategories`, `selectedTag`, `sortOrder` but backend ignores these. Cache invalidation occurs when these change even though backend response is unchanged. Wastes cache and causes unnecessary refetches.

**Recommended Action:**
- Remove ignored filters from query key
- Keep only: `searchQuery`, `limit`, `page`
- Or document that cache invalidation is intentional for UI consistency

**Requires rollback?** No (optimization, not breaking)

---

## Summary Statistics

**Total Issues:** 10  
**P0 (Blocking):** 0  
**P1 (High):** 3  
**P2 (Medium):** 5  
**P3 (Low):** 2  

**Requires Rollback:** 1 (Issue #008 - conditional)  
**Can Fix In-Place:** 9  

**Root Cause Breakdown:**
- Implementation bugs: 5
- Architectural debt: 3
- Missing contract: 2
- AI scope creep: 1

---

## Critical Path Recommendations

1. **Immediate (P1):** Fix type casting safety (FAIL-001)
2. **Immediate (P1):** Verify useArticles consumers for breaking changes (FAIL-008)
3. **Short-term (P2):** Implement infinite scroll support (FAIL-003)
4. **Short-term (P2):** Add error handling for pagination failures (FAIL-009)
5. **Medium-term (P2):** Address MySpacePage pagination (FAIL-006)

---

**End of Failure Log**











