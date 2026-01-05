# Feed Layout Feature - Dependency Map & Removal Plan

**Created:** 2025-01-02  
**Branch:** `remove-feed-layout-safe`  
**Status:** ANALYSIS PHASE - No code changes yet

---

## Executive Summary

The "feed layout" feature refers to a specific workspace-style layout pattern implemented via:
- **FeedLayoutPage** - A page component using ResponsiveLayoutShell
- **ResponsiveLayoutShell** - A CSS Grid-based 2/3-column layout component
- **Routes:** `/feed` and `/feed/:articleId` that render FeedLayoutPage

This is DISTINCT from:
- The `Feed` component (used by HomePage)
- The "feed" viewMode on HomePage (which is just a different rendering style)
- Feed-related utilities and contexts

---

## 1. Core Feed Layout Components

### 1.1 FeedLayoutPage
- **File:** `src/pages/FeedLayoutPage.tsx`
- **Status:** ✅ ACTIVE in routing
- **Purpose:** Wraps Feed component in ResponsiveLayoutShell with nested routing
- **Routes:** `/feed` and `/feed/:articleId` (via nested routes)
- **Dependencies:**
  - ✅ `ResponsiveLayoutShell` (line 14) - ONLY used here
  - ✅ `Feed` component (line 15) - Shared with HomePage
  - ✅ `ArticleDetailPage` (via `<Outlet />` nested route)

### 1.2 ResponsiveLayoutShell
- **File:** `src/components/layouts/ResponsiveLayoutShell.tsx`
- **Status:** ✅ EXISTS
- **Purpose:** CSS Grid-based 2/3-column workspace layout
- **Used By:** FeedLayoutPage ONLY (see grep results)
- **Documentation:** Referenced in `src/LAYOUT_ARCHITECTURE.md`

---

## 2. Routing Configuration

### 2.1 Current Routes (App.tsx)
```tsx
// Lines 154-162 in src/App.tsx
<Route path="/feed" element={
  <ErrorBoundary>
    <FeedLayoutPage />
  </ErrorBoundary>
}>
  <Route path=":articleId" element={<ArticleDetailPage />} />
</Route>
```

**Status:** ✅ ACTIVE - These routes are currently in use

---

## 3. Shared Components (MUST NOT DELETE)

### 3.1 Feed Component
- **File:** `src/components/Feed.tsx`
- **Used By:**
  - ✅ FeedLayoutPage (line 15, line 51)
  - ✅ HomePage (line 35 import, line 462 usage when viewMode="feed")
- **Status:** SHARED - DO NOT DELETE
- **Note:** This is a reusable feed display component, used by both FeedLayoutPage and HomePage feed viewMode

### 3.2 FeedVariant
- **File:** `src/components/card/variants/FeedVariant.tsx`
- **Used By:** Card rendering system (likely used by NewsCard)
- **Status:** SHARED - DO NOT DELETE
- **Note:** This is a card variant style, not layout-specific

### 3.3 FeedContainer
- **File:** `src/components/feed/FeedContainer.tsx`
- **Used By:** FeedPage (archived experimental component)
- **Status:** CHECK USAGE - May be unused
- **Action:** Verify if this is used anywhere else

### 3.4 FeedScrollStateContext
- **File:** `src/context/FeedScrollStateContext.tsx`
- **Used By:** FeedContainer (and possibly others)
- **Status:** SHARED UTILITY - DO NOT DELETE
- **Note:** Scroll state management, not layout-specific

### 3.5 ArticleDetailPage
- **File:** `src/pages/ArticleDetail.tsx`
- **Used By:** Nested route in FeedLayoutPage
- **Status:** CAN BE STANDALONE - Verify other usages
- **Note:** Can exist independently of FeedLayoutPage

---

## 4. Dependencies Map

### FeedLayoutPage → Dependencies
```
FeedLayoutPage
├── ResponsiveLayoutShell (ONLY used by FeedLayoutPage)
├── Feed (SHARED - used by HomePage)
├── useAuth hook (SHARED)
├── React Router (Outlet, useNavigate, useLocation)
└── ArticleDetailPage (via nested route)
```

### What Imports FeedLayoutPage
```
App.tsx (line 37, 158)
└── Lazy import and route registration
```

### What Depends on FeedLayoutPage
```
Routes in App.tsx:
├── /feed → FeedLayoutPage
└── /feed/:articleId → FeedLayoutPage + ArticleDetailPage (nested)
```

---

## 5. Documentation References

### Files Mentioning FeedLayoutPage
- ✅ `src/LAYOUT_ARCHITECTURE.md` - Architecture documentation
- ✅ `DEEP_DIAGNOSTIC_AUDIT_REPORT.md` - Audit report
- ✅ `DIAGNOSTIC_AUDIT_REPORT.md` - Diagnostic report
- ✅ `RESPONSIVE_LAYOUT_SHELL_FIX_SUMMARY.md` - Implementation notes

**Action:** Update documentation after removal

---

## 6. Test Files

### Test Coverage
- ❌ No tests found in `src/__tests__/` for FeedLayoutPage
- ✅ `src/__tests__/components/Feed.test.tsx` exists (tests Feed component, not FeedLayoutPage)

---

## 7. Removal Plan

### Phase 1: Analysis ✅ (CURRENT)
- [x] Create git branch
- [x] Scan codebase
- [x] Generate dependency map
- [x] Identify safe-to-delete vs shared components

### Phase 2: Prepare Safe Fallbacks (NEXT)
1. **Route Replacement:**
   - Replace `/feed` route with redirect to `/` (home page)
   - Replace `/feed/:articleId` route with redirect to `/article/:articleId` or similar
   - OR: Remove routes entirely and handle 404 gracefully

2. **Component Isolation:**
   - FeedLayoutPage can be safely deleted (only used in routes)
   - ResponsiveLayoutShell can be safely deleted (only used by FeedLayoutPage)
   - ArticleDetailPage needs review - may need standalone route

### Phase 3: Soft Removal
1. Replace route implementations with fallbacks
2. Remove FeedLayoutPage import from App.tsx
3. Remove FeedLayoutPage file
4. Remove ResponsiveLayoutShell file

### Phase 4: Cleanup
1. Update documentation files
2. Remove any dead imports
3. Verify no broken references

### Phase 5: Validation
1. TypeScript compilation
2. Build check
3. Route scan (verify no broken routes)
4. Lint check
5. Manual testing of affected routes

---

## 8. Risk Assessment

### Low Risk (Safe to Remove)
- ✅ FeedLayoutPage - Only used in routing
- ✅ ResponsiveLayoutShell - Only used by FeedLayoutPage

### Medium Risk (Requires Verification)
- ⚠️ ArticleDetailPage - Used as nested route, verify if needed standalone
- ⚠️ `/feed` route usage - Check if users/bookmarks rely on this route

### High Risk (DO NOT TOUCH)
- ❌ Feed component - Used by HomePage
- ❌ FeedVariant - Shared card variant
- ❌ FeedScrollStateContext - Shared utility
- ❌ Authentication/routing core
- ❌ Other layouts or pages

---

## 9. Files Safe to Delete

### Primary Targets
1. `src/pages/FeedLayoutPage.tsx` - Feed layout page component
2. `src/components/layouts/ResponsiveLayoutShell.tsx` - Layout shell (ONLY used by FeedLayoutPage)

### Secondary Targets (After Verification)
3. Documentation references (update, don't delete files)
4. Dead imports in App.tsx

### NOT Safe to Delete (Shared Components)
- ❌ `src/components/Feed.tsx` - Used by HomePage feed viewMode
- ❌ `src/components/card/variants/FeedVariant.tsx` - Shared card variant
- ❌ `src/context/FeedScrollStateContext.tsx` - Shared utility
- ❌ `src/components/feed/FeedContainer.tsx` - May be used elsewhere (verify)

---

## 10. Files to Modify

### Required Changes
1. **src/App.tsx**
   - Remove FeedLayoutPage lazy import (line 37)
   - Remove `/feed` routes (lines 154-162)
   - Decide on fallback: redirect to `/` or 404?

2. **src/pages/ArticleDetail.tsx**
   - Update `handleClose` navigation (line 37) - currently navigates to `/feed`
   - Decide on new default route

3. **Documentation Files** (Update references)
   - `src/LAYOUT_ARCHITECTURE.md`
   - Various markdown files in root

---

## 11. Verification Checklist

After removal:
- [ ] TypeScript compiles without errors
- [ ] Build succeeds (`npm run build`)
- [ ] No broken routes (all routes return valid pages)
- [ ] Linter passes (`npm run lint`)
- [ ] HomePage "feed" viewMode still works
- [ ] No console errors on page load
- [ ] Navigation from Header still works
- [ ] ArticleDetailPage can be accessed via other routes (if needed)

---

## 12. Open Questions

1. **Route Fallback:** Should `/feed` redirect to `/` or show 404?
2. **ArticleDetailPage:** Does this need a standalone route, or is it only used via modals?
3. **FeedContainer:** Is this component used anywhere, or can it be deleted too?
4. **User Impact:** Are there bookmarks/links to `/feed` that need redirects?

---

## Next Steps

1. ✅ Dependency map complete
2. ⏭️ Propose removal plan (waiting for approval)
3. ⏭️ Apply changes in phases
4. ⏭️ Run validation checks
5. ⏭️ Generate final summary

---

*This document is for planning purposes only. No code changes have been made yet.*

