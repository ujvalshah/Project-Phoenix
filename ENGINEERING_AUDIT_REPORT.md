# Engineering Audit Report
**Project:** Project Nuggets  
**Date:** 2026-01-05  
**Auditor:** Engineering Audit System  
**Scope:** Full codebase analysis for risk, complexity, and refactoring opportunities

---

## Executive Summary

This audit identifies unstable, risky, and overly complex areas that are likely to contain bugs or benefit from refactoring. The codebase shows evidence of significant recent refactoring (media pipeline, tag system, normalization) but retains legacy patterns, dual data formats, and several high-risk areas requiring attention.

**Key Findings:**
- **42 React hooks** in `CreateNuggetModal.tsx` (2,227 lines) - highest complexity risk
- **Dual media format** (legacy + new) creates data consistency risks
- **Client-side data processing** in admin services causing performance issues
- **Multiple race condition protections** indicate past issues
- **Type mismatches** between frontend Article type and backend model
- **Dead code** from bookmark removal and category phase-out

---

## 1) High-Risk / Bug-Prone Areas

### 1.1 CreateNuggetModal.tsx - Excessive Complexity

**Location:** `src/components/CreateNuggetModal.tsx` (2,227 lines, 42 hooks)

**Why it's risky:**
- **42 useState/useEffect/useMemo/useCallback hooks** create complex interdependencies
- Multiple refs (`initializedFromDataRef`, `previousUrlsRef`, `pasteBatchTimeoutRef`) for lifecycle management
- Edit mode initialization guarded by `initializedFromDataRef` - fragile if ref resets
- URL change detection via `previousUrlsRef` - race conditions possible
- Image deletion flow (lines 689-843) has complex state synchronization
- Masonry media state management spans multiple effects and handlers

**Symptoms:**
- Form state not initializing correctly in edit mode
- Images not deleting properly
- URL metadata not updating when URLs change
- Masonry flags lost during edit
- Memory leaks from uncleaned timeouts/effects

**Suggested fix direction:**
- **Break into sub-components:** `CreateNuggetForm`, `EditNuggetForm`, `MediaManager`, `UrlHandler`
- **Extract custom hooks:** `useNuggetForm`, `useMediaUpload`, `useUrlMetadata`, `useMasonryMedia`
- **State machine:** Use XState or reducer pattern for complex state transitions
- **Target:** Reduce to <500 lines per component, <10 hooks per component

---

### 1.2 Image Deduplication - Edit Mode Data Loss Risk

**Location:** `src/shared/articleNormalization/imageDedup.ts` → `dedupeImagesForEdit()`

**Why it's risky:**
- **Data loss scenario:** If image moved to `supportingMedia`, then removed from masonry, image may be lost
- Logic removes images from `images[]` array if they exist in `supportingMedia`
- No recovery path if user removes masonry flag after moving image
- Case-insensitive deduplication may merge different images (URL normalization too aggressive)

**Symptoms:**
- Images disappear after toggling masonry visibility
- Duplicate images re-appear after edit
- Images lost when moving between primary/supporting media

**Suggested fix direction:**
- **Preserve all images:** Never remove from `images[]` unless explicitly deleted
- **Track image sources:** Maintain mapping of image → source (primary/supporting/legacy)
- **Recovery mechanism:** Restore images from `supportingMedia` if removed from masonry
- **Validation:** Warn user before removing images that exist in multiple places

---

### 1.3 Media Field Updates - Complex Dot Notation

**Location:** `server/src/controllers/articlesController.ts` (lines 749-780)

**Why it's risky:**
- Uses MongoDB dot notation for `media.previewMetadata` updates
- If update fails validation, entire media object may be lost
- YouTube title protection may prevent legitimate updates
- `runValidators: false` bypasses schema validation (allows invalid data)

**Symptoms:**
- Media object becomes null after partial update
- YouTube titles overwritten unintentionally
- Invalid media structures saved to database

**Suggested fix direction:**
- **Atomic updates:** Use `$set` with explicit field paths, not nested objects
- **Validation layer:** Validate media structure before MongoDB update
- **Merge strategy:** Deep merge existing media with updates, don't replace
- **Guard clauses:** Check media structure before allowing updates

---

### 1.4 Partial Update Semantics - undefined vs null

**Location:** `src/components/CreateNuggetModal.tsx` (lines 1346-1391)

**Why it's risky:**
- **Subtle semantics:** `undefined` = don't update, `null` = clear field
- If field omitted from payload, it's not updated (may be unexpected)
- Media field: `undefined` preserves existing, `null` clears
- No type safety - TypeScript allows both `undefined` and `null`

**Symptoms:**
- Fields not updating when expected
- Fields cleared unintentionally
- Inconsistent behavior between create and edit modes

**Suggested fix direction:**
- **Explicit update object:** Only include fields that should be updated
- **Type-safe payload:** Use discriminated union for create vs edit payloads
- **Clear documentation:** Document `undefined` vs `null` semantics
- **Validation:** Reject payloads with both `undefined` and `null` for same field

---

### 1.5 Auth Restoration Race Condition

**Location:** `src/context/AuthContext.tsx`

**Why it's risky:**
- **Triple guard pattern** indicates past race condition issues
- `logoutCalledRef` + persistent localStorage flag needed to prevent restoration
- Component remount can reset ref, requiring localStorage backup
- Multiple async boundaries where auth can be restored

**Symptoms:**
- User logged back in after logout (if component remounts)
- Auth state inconsistent between tabs
- Logout not persisting across page refreshes

**Suggested fix direction:**
- **Single source of truth:** Use localStorage flag as primary, ref as optimization
- **Event-based logout:** Emit `auth:logout` event before any async operations
- **Debounce restoration:** Add delay before auth restoration to catch rapid logout/login
- **Test coverage:** Add tests for remount scenarios

---

### 1.6 CollectionDetailPage - N+1 User Queries

**Location:** `src/pages/CollectionDetailPage.tsx` (lines 60-67)

**Why it's risky:**
- Fetches users individually for each `addedByUserId` in collection entries
- **N+1 problem:** If collection has 50 entries, makes 50 parallel user queries
- No batching or caching mechanism
- Race condition: Component unmounts during parallel fetches

**Symptoms:**
- Slow page load for collections with many contributors
- High database load
- Contributor names missing if query fails

**Suggested fix direction:**
- **Batch endpoint:** `GET /api/users/batch?ids=id1,id2,id3`
- **Backend join:** Include contributor data in collection response
- **Caching:** Cache user lookups for session
- **Pagination:** Limit contributors shown, lazy-load rest

---

### 1.7 Tag Normalization - Case Sensitivity Edge Cases

**Location:** `src/shared/articleNormalization/normalizeTags.ts`

**Why it's risky:**
- Case-insensitive deduplication may merge different tags (e.g., "React" vs "react")
- Whitespace trimming may merge "tag name" and "tagname"
- Preserves original casing of first occurrence (may not match user intent)
- No validation that normalization didn't change meaning

**Symptoms:**
- Tags merged unintentionally
- Tag counts incorrect after normalization
- Search fails to find tags with different casing

**Suggested fix direction:**
- **Strict normalization:** Only normalize whitespace, preserve casing
- **User confirmation:** Warn if normalization would merge tags
- **Canonical tags:** Use tag IDs instead of string matching
- **Validation:** Reject tags that differ only by case

---

## 2) Large / Overgrown Code Units

### 2.1 CreateNuggetModal.tsx - 2,227 Lines

**Location:** `src/components/CreateNuggetModal.tsx`

**Why it should be refactored:**
- **2,227 lines** - exceeds reasonable component size (target: <500 lines)
- **42 React hooks** - too many stateful dependencies
- **Multiple responsibilities:** Form state, media upload, URL handling, validation, API calls
- **Violates SRP:** Should be split into focused components

**Proposed decomposition strategy:**

1. **CreateNuggetModal.tsx** (orchestrator, ~200 lines)
   - Modal wrapper
   - Mode switching (create vs edit)
   - Submit handler coordination

2. **NuggetForm.tsx** (~300 lines)
   - Title, content, tags, visibility inputs
   - Form validation
   - Submit button

3. **MediaManager.tsx** (~400 lines)
   - Image upload/delete
   - URL input/metadata fetching
   - Attachment handling
   - Masonry media toggle

4. **EditModeHydration.tsx** (~200 lines)
   - Initial data loading
   - State initialization
   - Existing media display

5. **Custom hooks:**
   - `useNuggetForm()` - form state management
   - `useMediaUpload()` - media upload logic (already exists, enhance)
   - `useUrlMetadata()` - URL unfurling
   - `useMasonryMedia()` - masonry state

**Natural sub-modules:**
- `CreateNuggetModal/FormFields/`
- `CreateNuggetModal/Media/`
- `CreateNuggetModal/EditMode/`
- `CreateNuggetModal/hooks/`

---

### 2.2 articlesController.ts - 1,118 Lines

**Location:** `server/src/controllers/articlesController.ts`

**Why it should be refactored:**
- **1,118 lines** - large controller handling multiple concerns
- **Multiple responsibilities:** CRUD, search, filtering, privacy, media handling
- **Complex query building:** Privacy filters, search, tag filtering combined
- **Extensive diagnostic logging** suggests past issues

**Proposed decomposition strategy:**

1. **articlesController.ts** (orchestrator, ~200 lines)
   - Route handlers
   - Request/response formatting
   - Error handling

2. **articleService.ts** (~400 lines)
   - Business logic
   - Query building
   - Data transformation

3. **articleQueryBuilder.ts** (~200 lines)
   - MongoDB query construction
   - Privacy filter logic
   - Search/tag filtering

4. **articleValidator.ts** (~150 lines)
   - Validation logic
   - Tag normalization
   - Media validation

5. **articleMediaHandler.ts** (~200 lines)
   - Media processing
   - Image deduplication
   - Media updates

**Natural sub-modules:**
- `server/src/services/articles/`
- `server/src/utils/articleQueries/`
- `server/src/utils/articleValidation/`

---

### 2.3 MySpacePage.tsx - 824 Lines

**Location:** `src/pages/MySpacePage.tsx`

**Why it should be refactored:**
- **824 lines** - large page component
- **Multiple tabs:** Nuggets, Collections, Profile
- **Complex state management:** Profile, articles, collections, modals
- **Infinite scroll logic** embedded in component

**Proposed decomposition strategy:**

1. **MySpacePage.tsx** (orchestrator, ~150 lines)
   - Tab routing
   - Layout structure
   - Modal coordination

2. **MySpaceNuggetsTab.tsx** (~250 lines)
   - Nuggets list
   - Infinite scroll
   - Filtering

3. **MySpaceCollectionsTab.tsx** (~200 lines)
   - Collections grid
   - Collection actions

4. **MySpaceProfileTab.tsx** (~150 lines)
   - Profile display
   - Profile editing

5. **Custom hooks:**
   - `useMySpaceData()` - data fetching
   - `useInfiniteNuggets()` - infinite scroll (already exists)

---

### 2.4 normalizeArticleInput.ts - 846 Lines

**Location:** `src/shared/articleNormalization/normalizeArticleInput.ts`

**Why it should be refactored:**
- **846 lines** - large normalization module
- **Dual mode logic:** Create vs edit handled in same file
- **Multiple concerns:** Tag normalization, image dedup, media building, excerpt generation

**Proposed decomposition strategy:**

1. **normalizeArticleInput.ts** (orchestrator, ~150 lines)
   - Mode routing
   - Input validation
   - Output assembly

2. **normalizeCreate.ts** (~200 lines)
   - Create-specific logic
   - Default values
   - Initial media selection

3. **normalizeEdit.ts** (~250 lines)
   - Edit-specific logic
   - Existing data preservation
   - Partial update handling

4. **mediaBuilder.ts** (~150 lines)
   - Media object construction
   - Primary/supporting media classification
   - Masonry flag handling

5. **contentProcessor.ts** (~100 lines)
   - Excerpt generation
   - Read time calculation
   - Source type detection

---

## 3) Dead / Legacy / Redundant Code

### 3.1 Category System - Fully Deprecated

**Location:** Multiple files

**Evidence it's unused:**
- Backend logs warnings when category fields received (lines 57-66 in `articlesController.ts`)
- Frontend doesn't send `categories` or `categoryIds` (confirmed in `RestAdapter.ts`)
- Backend validation accepts but ignores category fields
- Type definitions still include category fields for backward compatibility

**Files affected:**
- `server/src/utils/normalizeCategories.ts` - marked as "TODO: DEAD CODE"
- `server/src/models/Article.ts` - category fields removed from schema
- `src/types/index.ts` - category fields still in Article interface
- `server/src/controllers/articlesController.ts` - category query param converted to tags

**Decision recommendation:**
- **Phase 1:** Remove from TypeScript types (breaking change, do in major version)
- **Phase 2:** Remove backend validation acceptance (after migration period)
- **Phase 3:** Remove `normalizeCategories.ts` utility
- **Timeline:** After confirming no legacy clients use categories

---

### 3.2 Bookmark System - Removed but References Remain

**Location:** Multiple files

**Evidence it's unused:**
- `src/components/bookmarks/AddToFoldersPopover.tsx` - empty file (1 blank line)
- Admin pages show bookmark metrics (always 0)
- `adminUsersService` returns hardcoded 0 for bookmarks
- Card components have `onSave` handlers that don't exist
- `useNewsCard.ts` has TODO comments for bookmark functionality

**Files affected:**
- `src/components/bookmarks/AddToFoldersPopover.tsx` - delete
- `src/admin/pages/AdminUsersPage.tsx` - remove bookmark icon/metric
- `src/admin/pages/AdminDashboardPage.tsx` - remove bookmark metric
- `src/components/card/variants/*.tsx` - remove `onSave` props
- `src/hooks/useNewsCard.ts` - remove bookmark TODOs

**Decision recommendation:**
- **Delete:** `AddToFoldersPopover.tsx` immediately
- **Remove:** Bookmark references from admin UI
- **Clean:** Card component props (remove `onSave`, `isSaved`)
- **Document:** If bookmarks planned for future, create feature flag

---

### 3.3 FeedCardCompact - Duplicate Implementation

**Location:** `src/components/feed/FeedCardCompact.tsx`

**Evidence:**
- Separate implementation from refactored card system (`NewsCard` variants)
- Used in `FeedContainer.tsx` but overlaps with `FeedVariant`
- Different media handling logic than `CardMedia` atom

**Decision recommendation:**
- **Audit usage:** Determine if `FeedCardCompact` serves different purpose than `FeedVariant`
- **If duplicate:** Migrate to `FeedVariant`, delete `FeedCardCompact`
- **If unique:** Document why separate implementation needed
- **Action:** Consolidate if possible, or clearly document separation

---

### 3.4 Disabled Features - CardBadge and Favicon Selector

**Location:** `src/components/CreateNuggetModal.tsx`

**Evidence:**
- Lines 1129-1139: Favicon selector wrapped in `{false && (...)}`
- Lines 2129-2138: Source badge preview disabled with `{false && ...}`
- Comments say "TEMPORARILY DISABLED"

**Decision recommendation:**
- **Option A:** Remove disabled code if feature abandoned
- **Option B:** Re-enable if feature planned
- **Option C:** Document decision and timeline
- **Action:** Make decision within 1 sprint, remove or enable

---

### 3.5 Legacy Media Fields - Dual Format Support

**Location:** Article data model

**Evidence:**
- New format: `primaryMedia` / `supportingMedia`
- Legacy format: `media` / `images` / `video`
- Both formats populated for backward compatibility
- Card rendering checks both formats (in `useNewsCard.ts`)

**Decision recommendation:**
- **Phase 1:** Continue supporting both (current state) ✅
- **Phase 2:** Migrate all articles to new format (migration script)
- **Phase 3:** Remove legacy fields from types (major version)
- **Timeline:** After migration complete, remove in v2.0

---

## 4) Data-Flow & Contract Inconsistencies

### 4.1 Frontend Article Type vs Backend Model

**Location:** `src/types/index.ts` vs `server/src/models/Article.ts`

**Mismatches:**

1. **Author field:**
   - Frontend: `author: { id: string, name: string, avatarUrl?: string }`
   - Backend: `authorId: string, authorName: string`
   - **Status:** ✅ Handled by `normalizeDoc()` transformation

2. **Categories field:**
   - Frontend: `categories?: string[]` (deprecated, not sent)
   - Backend: Removed from schema
   - **Status:** ⚠️ Frontend type still includes, backend ignores

3. **Media fields:**
   - Frontend: `primaryMedia?`, `supportingMedia?`, `media?`, `images?`
   - Backend: All fields optional, accepts both formats
   - **Status:** ✅ Compatible but complex

4. **Published date:**
   - Frontend: `publishedAt: string` (ISO)
   - Backend: `publishedAt: string` (ISO)
   - **Status:** ✅ Aligned

**What breaks:**
- TypeScript types don't match runtime data (categories field)
- Media field dual format creates confusion
- Author transformation happens at runtime (not type-safe)

**Suggested normalization strategy:**
- **Shared types:** Create `@shared/types` package for Article interface
- **Type guards:** Add runtime validation for Article shape
- **Migration:** Remove `categories` from frontend type after migration
- **Documentation:** Document media field migration path

---

### 4.2 Validation Schema vs Runtime Shape

**Location:** `server/src/utils/validation.ts` vs `server/src/models/Article.ts`

**Mismatches:**

1. **Password in signup:**
   - Schema: `password: z.string().min(8).optional()` ⚠️
   - Frontend: Required field
   - **Issue:** Schema allows optional password, frontend requires it

2. **Media validation:**
   - Schema: `media: mediaSchema.optional().nullable()`
   - Runtime: Media can be object, null, or undefined
   - **Status:** ✅ Handled but complex

3. **Tags validation:**
   - Schema: `tags: z.array(z.string()).default([])`
   - Runtime: Tags normalized, may become empty (rejected)
   - **Issue:** Schema allows empty array, business logic rejects it

**What breaks:**
- Signup may accept empty password if frontend validation bypassed
- Empty tags array passes validation but fails business logic
- Media null vs undefined semantics unclear

**Suggested normalization strategy:**
- **Fix password schema:** Remove `.optional()`, make required
- **Tags validation:** Add `.min(1)` to schema, or handle in business logic
- **Media types:** Use discriminated union for media types
- **Runtime checks:** Add validation layer between schema and business logic

---

### 4.3 API Request vs Storage Schema

**Location:** `src/services/adapters/RestAdapter.ts` vs `server/src/models/Article.ts`

**Mismatches:**

1. **Payload transformation:**
   - `RestAdapter.createArticle()` maps `Article` type to backend schema
   - Excludes `categories`, `categoryIds` (not sent)
   - Includes both `media` and `primaryMedia`/`supportingMedia`

2. **Partial updates:**
   - Edit mode sends only changed fields
   - `undefined` vs `null` semantics not enforced by types
   - Backend accepts partial updates but validation may reject

**What breaks:**
- TypeScript allows sending fields that backend ignores
- Partial updates may omit required fields unintentionally
- Media field updates may clear entire object if structure invalid

**Suggested normalization strategy:**
- **Type-safe payloads:** Create `CreateArticlePayload` and `UpdateArticlePayload` types
- **Validation layer:** Validate payloads before sending
- **Explicit fields:** Only include fields that should be updated
- **Documentation:** Document `undefined` vs `null` semantics clearly

---

## 5) Performance / Query / Storage Risk Areas

### 5.1 Admin Services - Client-Side Data Processing

**Location:** `src/admin/services/adminUsersService.ts`, `adminNuggetsService.ts`

**Why it matters:**
- **Fetches ALL users/articles**, then filters client-side
- No pagination support
- With 10,000 users: Downloads 10MB+ JSON, filters in browser
- Dashboard makes 6 parallel calls, each fetching full datasets

**Performance impact:**
- **Initial load:** 5-15 seconds for large datasets
- **Memory:** High browser memory usage
- **Network:** Unnecessary data transfer
- **Mobile:** Poor experience on slow connections

**Practical optimization approach:**
- **Backend filtering:** `GET /api/users?q=search&page=1&limit=50`
- **Pagination:** Implement backend pagination for all admin endpoints
- **Aggregated stats:** Single `/api/admin/stats` endpoint (already implemented per `ADMIN_STATS_ENDPOINT_IMPLEMENTATION.md`)
- **Caching:** Cache stats for 1-5 minutes
- **Lazy loading:** Load data on-demand, not all at once

---

### 5.2 CollectionDetailPage - N+1 User Queries

**Location:** `src/pages/CollectionDetailPage.tsx` (lines 60-67)

**Why it matters:**
- Fetches users individually for each contributor
- If collection has 50 entries → 50 parallel user queries
- No batching mechanism
- High database load

**Performance impact:**
- **Page load:** Slow for collections with many contributors
- **Database:** 50+ queries per page load
- **Network:** 50+ HTTP requests

**Practical optimization approach:**
- **Batch endpoint:** `GET /api/users/batch?ids=id1,id2,id3`
- **Backend join:** Include contributor data in collection response
- **Caching:** Cache user lookups for session
- **Limit:** Show top N contributors, lazy-load rest

---

### 5.3 Admin Nuggets Service - Duplicate API Calls

**Location:** `src/admin/services/adminNuggetsService.ts`

**Why it matters:**
- `listNuggets()`, `getNuggetDetails()`, `getStats()` all fetch reports
- Same data fetched multiple times
- No caching mechanism
- Reports fetched even when not needed

**Performance impact:**
- **Redundant requests:** Same data fetched 3+ times
- **Network waste:** Unnecessary API calls
- **Slow UI:** Multiple loading states

**Practical optimization approach:**
- **React Query caching:** Use `useQuery` with 30-60 second cache
- **Backend optimization:** Include report counts in article response
- **Lazy loading:** Only fetch reports when needed
- **Request deduplication:** React Query handles this automatically

---

### 5.4 CreateNuggetModal - Expensive Re-renders

**Location:** `src/components/CreateNuggetModal.tsx`

**Why it matters:**
- **42 hooks** create many re-render triggers
- Large component tree re-renders on every state change
- Image preview rendering on every URL change
- No memoization of expensive computations

**Performance impact:**
- **Slow typing:** Lag when typing in content editor
- **Image preview:** Re-renders entire modal on URL change
- **Memory:** Large component tree in memory

**Practical optimization approach:**
- **Memoization:** `useMemo` for expensive computations
- **Component splitting:** Smaller components = fewer re-renders
- **Debouncing:** Debounce URL metadata fetching
- **Virtualization:** If image list grows large, use virtual scrolling
- **Code splitting:** Lazy load modal content

---

### 5.5 Database Queries - Missing Indexes

**Location:** `server/src/models/Article.ts`

**Why it matters:**
- Queries on `tags`, `authorId`, `publishedAt`, `visibility`
- No explicit index definitions visible in schema
- May cause full collection scans on large datasets

**Performance impact:**
- **Slow queries:** Full collection scans for tag/category filters
- **High CPU:** Database CPU usage spikes
- **Timeout risk:** Queries may timeout on large datasets

**Practical optimization approach:**
- **Add indexes:** `tags: 1`, `authorId: 1`, `publishedAt: -1`, `visibility: 1`
- **Compound indexes:** `{ authorId: 1, visibility: 1 }` for user's articles
- **Query analysis:** Use MongoDB explain() to identify slow queries
- **Monitoring:** Add query performance logging (already exists in `db.ts`)

---

## 6) Regression Traps (Recent Edits / Cleanup Areas)

### 6.1 Media Pipeline - Dual Format Support

**Risk:** Recent refactoring introduced `primaryMedia`/`supportingMedia` but legacy `media`/`images` still used

**Areas to watch:**
- `src/components/CreateNuggetModal.tsx` - populates both formats
- `src/hooks/useNewsCard.ts` - checks both formats (lines 291-328)
- `server/src/controllers/articlesController.ts` - accepts both formats
- Card rendering - must handle both formats

**Regression symptoms:**
- Cards not showing media (if only one format populated)
- Images lost during edit (if format conversion fails)
- Masonry not showing items (if `showInMasonry` flag lost)

**Prevention:**
- **Migration script:** Ensure all articles have both formats
- **Validation:** Reject articles missing both formats
- **Logging:** Log when legacy format used (for migration tracking)
- **Tests:** Add tests for format conversion

---

### 6.2 Tag System - Case Sensitivity

**Risk:** Recent case-insensitive tag normalization may merge different tags

**Areas to watch:**
- `src/shared/articleNormalization/normalizeTags.ts` - case-insensitive dedup
- `server/src/utils/normalizeTags.ts` - same logic
- Tag autocomplete - may not find tags with different casing
- Tag search - case-insensitive matching

**Regression symptoms:**
- Tags merged unintentionally ("React" + "react" → one tag)
- Tag counts incorrect
- Search fails to find tags

**Prevention:**
- **Strict normalization:** Only normalize whitespace, preserve casing
- **User confirmation:** Warn before merging tags
- **Canonical tags:** Use tag IDs instead of string matching
- **Tests:** Add tests for case sensitivity edge cases

---

### 6.3 Image Deduplication - Edit Mode

**Risk:** Recent refactoring moved image dedup to shared module, edit mode logic complex

**Areas to watch:**
- `src/shared/articleNormalization/imageDedup.ts` - `dedupeImagesForEdit()`
- `src/components/CreateNuggetModal.tsx` - image deletion flow
- `server/src/controllers/articlesController.ts` - backend deduplication

**Regression symptoms:**
- Images disappear after edit
- Duplicate images re-appear
- Images lost when moving to supporting media

**Prevention:**
- **Preserve existing:** Never remove images unless explicitly deleted
- **Recovery mechanism:** Restore images from supportingMedia if removed
- **Validation:** Warn before removing images in multiple places
- **Tests:** Add tests for image deduplication edge cases

---

### 6.4 Category Phase-Out - Backend Warnings

**Risk:** Backend still accepts category fields but logs warnings, may confuse monitoring

**Areas to watch:**
- `server/src/controllers/articlesController.ts` - category query param conversion
- `server/src/utils/validation.ts` - category fields accepted but ignored
- Frontend - should not send category fields

**Regression symptoms:**
- Log noise from category warnings
- Confusion if legacy client sends categories
- Monitoring alerts from warnings

**Prevention:**
- **Remove warnings:** After migration period, remove warning logs
- **Strict validation:** Reject category fields after migration
- **Documentation:** Document migration timeline
- **Monitoring:** Track category field usage, alert if detected

---

### 6.5 Auth System - Logout Persistence

**Risk:** Recent fix added localStorage flag to prevent auth restoration, may have edge cases

**Areas to watch:**
- `src/context/AuthContext.tsx` - logout flag management
- `src/services/authService.ts` - logout implementation
- Component remount scenarios

**Regression symptoms:**
- User logged back in after logout
- Auth state inconsistent between tabs
- Logout not persisting

**Prevention:**
- **Test coverage:** Add tests for remount scenarios
- **Event-based:** Emit logout event before async operations
- **Debounce:** Add delay before auth restoration
- **Monitoring:** Log when logout flag blocks restoration

---

## Top 5 Highest-Impact Refactor Targets

### 1. CreateNuggetModal.tsx (2,227 lines → ~200 lines per component)
**Impact:** High - Reduces complexity, improves maintainability, prevents bugs  
**Effort:** High - Requires careful state management extraction  
**ROI:** Very High - Prevents future bugs, improves developer experience

### 2. Admin Services - Backend Filtering & Pagination
**Impact:** Very High - Dramatically improves performance, user experience  
**Effort:** Medium - Backend endpoints already support pagination  
**ROI:** Very High - Immediate performance gains, scales to large datasets

### 3. articlesController.ts (1,118 lines → ~200 lines per module)
**Impact:** High - Improves testability, reduces coupling  
**Effort:** Medium - Requires service layer extraction  
**ROI:** High - Easier to test, maintain, and extend

### 4. normalizeArticleInput.ts (846 lines → ~200 lines per module)
**Impact:** Medium - Improves readability, reduces complexity  
**Effort:** Low - Logic already separated by mode  
**ROI:** Medium - Easier to understand and modify

### 5. MySpacePage.tsx (824 lines → ~200 lines per tab)
**Impact:** Medium - Improves code organization, reduces re-renders  
**Effort:** Low - Natural tab boundaries exist  
**ROI:** Medium - Better code organization, easier to maintain

---

## Top 5 Immediate Bug-Investigation Hotspots

### 1. Image Deduplication - Edit Mode Data Loss
**Location:** `src/shared/articleNormalization/imageDedup.ts` → `dedupeImagesForEdit()`  
**Priority:** High - Data loss risk  
**Investigation:** Test scenarios where images moved to supportingMedia then removed from masonry  
**Fix:** Preserve all images unless explicitly deleted, add recovery mechanism

### 2. Media Field Updates - Dot Notation Complexity
**Location:** `server/src/controllers/articlesController.ts` (lines 749-780)  
**Priority:** High - May lose media data  
**Investigation:** Test partial updates that modify `media.previewMetadata`  
**Fix:** Use atomic updates, validate before MongoDB write, add merge strategy

### 3. Auth Restoration - Component Remount
**Location:** `src/context/AuthContext.tsx`  
**Priority:** Medium - Security risk  
**Investigation:** Test logout → component remount → auth restoration  
**Fix:** Ensure localStorage flag persists, add event-based logout, test remount scenarios

### 4. CollectionDetailPage - N+1 Queries
**Location:** `src/pages/CollectionDetailPage.tsx` (lines 60-67)  
**Priority:** Medium - Performance issue  
**Investigation:** Profile page load for collections with 50+ contributors  
**Fix:** Implement batch user endpoint or include in collection response

### 5. Tag Normalization - Case Sensitivity
**Location:** `src/shared/articleNormalization/normalizeTags.ts`  
**Priority:** Medium - May merge different tags  
**Investigation:** Test tags that differ only by case ("React" vs "react")  
**Fix:** Preserve casing, use canonical tag IDs, warn before merging

---

## Appendix: File Size Analysis

### Largest Frontend Files
- `src/components/CreateNuggetModal.tsx` - 2,227 lines
- `src/pages/MySpacePage.tsx` - 824 lines
- `src/shared/articleNormalization/normalizeArticleInput.ts` - 846 lines

### Largest Backend Files
- `server/src/controllers/articlesController.ts` - 1,118 lines
- `server/src/controllers/adminController.ts` - ~800 lines (estimated)

### Files with Most Hooks
- `src/components/CreateNuggetModal.tsx` - 42 hooks (useState/useEffect/useMemo/useCallback)

---

**End of Audit Report**

