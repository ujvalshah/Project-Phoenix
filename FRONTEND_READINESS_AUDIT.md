# Frontend Readiness Audit

**Date:** 2025-01-XX  
**Purpose:** Identify static data, mismatches, and missing state/hooks  
**Status:** ✅ Complete

---

## STEP 2 — Frontend Readiness Audit

### 1. Static/Dummy Data Detection

#### ✅ ACCEPTABLE (Not Blocking):
- `src/data/articles.ts` - Only used by LocalAdapter (fallback, not active)
- `src/services/adapters/LocalAdapter.ts` - Fallback only, not in production flow

#### ❌ BLOCKERS (Admin Panel):
- `src/admin/services/mockData.ts` - All admin services use this
- 7 admin services read from in-memory mock arrays

### 2. Backend Response Shape Mismatches

#### ✅ GOOD (Already Handled):
- **Articles:** Backend `normalizeDoc()` transforms `authorId` + `authorName` → `author: { id, name }` ✅
- **Users:** Backend returns modular structure (`auth`, `profile`, `preferences`, `appState`) ✅
- **Collections:** Structure matches ✅
- **Tags:** Structure matches ✅

#### ⚠️ NEEDS VERIFICATION:
- **Article categories:** Backend may return single `category` or array `categories` - frontend expects array
- **User updates:** Frontend sends flat fields, backend expects nested structure (handled in RestAdapter)
- **Tags endpoint:** Returns `string[]` if `?format=simple`, `Tag[]` otherwise - frontend must handle both

### 3. Missing State/Hooks

#### ✅ GOOD (Already Implemented):
- `useArticles` - React Query hook ✅
- `useAuth` - Auth context hook ✅
- `useBookmarks` - Bookmark management ✅
- Loading/error states in main pages ✅

#### ⚠️ NEEDS ADDITION:
- Admin pages have state management but use mock services
- Some components may need null checks for optional fields

### 4. Required Changes Summary

#### Priority 1: Admin Services (CRITICAL)
- Replace mock data with API calls to existing endpoints
- Map backend responses to admin types
- Handle query parameters for filtering

#### Priority 2: Field Mapping Fixes
- Ensure `articleService.getCategories()` handles both `string[]` and `Tag[]` responses
- Verify article category array handling
- Test user update payload transformation

#### Priority 3: Null Safety
- Add optional chaining in admin components
- Handle anonymous feedback (no user)
- Guard against null user in profile components

---

## Integration Strategy

**Phase 1: Main App (Already Working)**
- ✅ Auth - Already integrated
- ✅ Articles - Already integrated via RestAdapter
- ✅ Collections - Already integrated via RestAdapter
- ✅ Tags - Already integrated via RestAdapter

**Phase 2: Admin Panel (Needs Work)**
- Wire admin services to existing backend endpoints
- Map responses to admin types
- Compute stats client-side (or add backend endpoints later)

**Phase 3: Polish**
- Add null checks
- Improve error handling
- Test edge cases

---

*End of Frontend Readiness Audit*











