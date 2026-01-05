# Likes/Reactions Functionality Audit Report

**Generated:** 2026-01-XX  
**Scope:** Complete codebase analysis for likes/reactions functionality  
**Purpose:** Identify all files, components, and database structures related to likes/reactions for removal

---

## Quick Reference

### Files to DELETE
- **NONE** - All like functionality is embedded in shared components

### Files to MODIFY
1. `src/components/feed/ActionDock.tsx` - Remove like button, keep Share/Source
2. `src/components/feed/DetailViewBottomSheet.tsx` - Remove `onLike` prop
3. `src/components/ArticleDetail.tsx` - Remove like count display
4. `src/hooks/useNewsCard.ts` - Remove `isLiked` flag and `onLike` handler
5. `server/src/models/Article.ts` - Remove `likes` from Engagement schema
6. `src/types/index.ts` - Remove `likes` from Engagement interface
7. `BACKEND_API_CONTRACT.md` - Update documentation

### Database Collections Affected
- **`articles` collection:** `engagement.likes` field (optional, defaults to 0)
  - **Recommendation:** Keep field in database, remove from TypeScript interfaces (backward compatible)

### Runtime Risk
- **Overall Risk:** LOW
- All like functionality is non-functional (stubs/placeholders)
- No API endpoints exist
- No database collections for tracking likes

---

## Executive Summary

The likes/reactions feature is **partially implemented** but **not functional**:
- ✅ Data structures exist (Engagement interface, schema)
- ✅ UI components exist (Heart icon, like buttons)
- ❌ No backend API endpoints for liking/unliking
- ❌ No database collections for tracking user likes
- ❌ All like handlers are stubs/placeholders
- ⚠️ Engagement data is displayed but never updated

**Classification Summary:**
- **CORE FEATURE FILES:** 0 files (all like functionality embedded in shared components)
- **SHARED FILES WITH REFERENCES:** 7 files (clean references)
- **SAFE TO IGNORE:** 8 files (documentation or no like references)

---

## 1. React Components Rendering Like/Reaction UI

### 1.1 Core Like UI Components

#### ✅ **SHARED FILE WITH REFERENCES - CLEAN REFERENCES**
**File:** `src/components/feed/ActionDock.tsx`
- **Lines:** 17, 28, 39-40, 89-107
- **Usage:**
  - Imports `Heart` icon from lucide-react
  - Has `onLike` prop handler
  - Renders like button with Heart icon
  - Shows `isLiked` state (hardcoded to `false`)
  - Conditional styling for liked state
- **Note:** Component also handles Share and Source link functionality (keep those)
- **Dependencies:** Used by `DetailViewBottomSheet`
- **Action:** 
  - Remove `Heart` import
  - Remove `onLike` prop from interface
  - Remove `isLiked` state
  - Remove like button rendering (lines 89-107)
  - Keep Share and Source link functionality

#### ✅ **SHARED FILE WITH REFERENCES - CLEAN REFERENCES**
**File:** `src/components/feed/DetailViewBottomSheet.tsx`
- **Lines:** 43-44
- **Usage:**
  - Accepts `onLike?: (article: Article) => void` prop
  - Passes `onLike` to `ActionDock` component
- **Action:** Remove `onLike` prop and remove `onLike` prop from `ActionDock` call

#### ✅ **SHARED FILE WITH REFERENCES - CLEAN REFERENCES**
**File:** `src/components/ArticleDetail.tsx`
- **Lines:** 5819 (from COMPLETE_CODEBASE.txt reference)
- **Usage:**
  - Displays `article.engagement?.likes || 0` in footer
  - Uses `Heart` icon from lucide-react
  - Shows like count alongside view count
- **Note:** This is a display-only reference in the engagement footer
- **Action:** Remove engagement likes display from footer (keep views if needed)

---

## 2. Hooks and Context Files Managing Reactions

### 2.1 Like State Management

#### ✅ **CORE FEATURE FILE - DELETE**
**File:** `src/hooks/useNewsCard.ts`
- **Lines:** 42-43, 48, 431-433, 668-671
- **Usage:**
  - Defines `NewsCardFlags` interface with `isLiked: boolean`
  - Defines `NewsCardHandlers` interface with `onLike: (() => void) | undefined`
  - Sets `isLiked: false` (hardcoded, TODO comment)
  - Provides stub `onLike` handler (empty function with TODO)
  - Returns `onLike` in handlers object
- **Action:** 
  - Remove `isLiked` from `NewsCardFlags` interface
  - Remove `onLike` from `NewsCardHandlers` interface
  - Remove `isLiked: false` from flags object
  - Remove `onLike` stub handler

---

## 3. Services and API Adapters

### 3.1 API Client and Adapters

#### ✅ **SAFE TO IGNORE**
**File:** `src/services/storageService.ts`
- **Status:** No like-related methods found
- **Action:** No changes needed

#### ✅ **SAFE TO IGNORE**
**File:** `src/services/adapters/RestAdapter.ts`
- **Status:** No like-related methods found
- **Action:** No changes needed

---

## 4. Backend Models, Controllers, Routes, and Services

### 4.1 Database Models

#### ✅ **SHARED FILE WITH REFERENCES - CLEAN REFERENCES**
**File:** `server/src/models/Article.ts`
- **Lines:** 40-45, 78-79, 120-125, 162
- **Usage:**
  - Defines `IEngagement` interface with `likes: number`
  - Defines `EngagementSchema` with `likes: { type: Number, default: 0 }`
  - Article schema includes optional `engagement?: IEngagement`
- **Action:** 
  - Remove `likes` field from `IEngagement` interface
  - Remove `likes` field from `EngagementSchema`
  - Keep `bookmarks`, `shares`, `views` (used by other features)

#### ✅ **SHARED FILE WITH REFERENCES - CLEAN REFERENCES**
**File:** `src/types/index.ts`
- **Lines:** 50-55, 193
- **Usage:**
  - Defines `Engagement` interface with `likes: number`
  - `Article` interface includes optional `engagement?: Engagement`
- **Action:**
  - Remove `likes` field from `Engagement` interface
  - Keep other engagement fields

### 4.2 Controllers

#### ✅ **SAFE TO IGNORE**
**File:** `server/src/controllers/articlesController.ts`
- **Status:** No like/unlike endpoints found
- **Action:** No changes needed

#### ✅ **SAFE TO IGNORE**
**File:** `server/src/controllers/adminController.ts`
- **Status:** No engagement/likes analytics found
- **Action:** No changes needed

### 4.3 Routes

#### ✅ **SAFE TO IGNORE**
**File:** `server/src/routes/articles.ts`
- **Status:** No like/unlike routes found
- **Action:** No changes needed

---

## 5. Database Collections and Migration Scripts

### 5.1 Collections

#### ✅ **NO DEDICATED COLLECTION**
**Status:** No separate `likes` or `reactions` collection exists
- Likes were intended to be stored in `Article.engagement.likes` (counter only)
- No user-to-article like mapping collection exists
- **Action:** No collection deletion needed

### 5.2 Migration Scripts

#### ✅ **SAFE TO IGNORE**
**File:** `server/src/utils/seed.ts`
- **Status:** No engagement data seeded
- **Action:** No changes needed

#### ✅ **SAFE TO IGNORE**
**File:** `server/src/utils/forceSeed.ts`
- **Status:** No engagement data seeded
- **Action:** No changes needed

---

## 6. Admin Analytics and Metrics

### 6.1 Admin Dashboard

#### ✅ **SAFE TO IGNORE**
**File:** `server/src/controllers/adminController.ts`
- **Status:** No engagement/likes metrics in admin stats
- **Action:** No changes needed

---

## 7. Additional Files with Like References

### 7.1 Documentation and Archive Files

#### ✅ **SAFE TO IGNORE**
**File:** `COMPLETE_CODEBASE.txt`
- **Status:** Documentation/snapshot file
- **Lines:** 5819-5820, 12549, 12577, 12593, 12609, 12625, 12641, 16886, 16935
- **Action:** No changes needed (snapshot file)

#### ✅ **SAFE TO IGNORE**
**File:** `BACKEND_API_CONTRACT.md`
- **Status:** Documentation file
- **Lines:** 136-140 (engagement schema in API contract)
- **Action:** Update documentation to remove `likes` from engagement schema

---

## 8. Files Classification Summary

### 8.1 Files to DELETE (CORE FEATURE FILES)

**NONE** - All like functionality is embedded in shared components that serve other purposes

### 8.2 Files to MODIFY (SHARED FILES WITH REFERENCES)

1. **`src/components/feed/ActionDock.tsx`**
   - **Action:** 
     - Remove `Heart` import from lucide-react
     - Remove `onLike` prop from `ActionDockProps` interface
     - Remove `isLiked` state variable
     - Remove like button rendering (lines 89-107)
     - Keep Share button and Source link functionality
   - **Risk:** LOW - Like functionality is conditional, component will still function

2. **`src/components/feed/DetailViewBottomSheet.tsx`**
   - **Action:** Remove `onLike` prop and remove `onLike` prop from `ActionDock` call
   - **Risk:** LOW - Prop is optional, component will still function

2. **`src/components/ArticleDetail.tsx`**
   - **Action:** Remove engagement likes display from footer (line showing `article.engagement?.likes || 0`)
   - **Risk:** LOW - Display-only, no functionality impact

3. **`src/hooks/useNewsCard.ts`**
   - **Action:** 
     - Remove `isLiked` from `NewsCardFlags` interface
     - Remove `onLike` from `NewsCardHandlers` interface
     - Remove `isLiked: false` from flags object
     - Remove `onLike` stub handler
   - **Risk:** LOW - All are stubs/placeholders

4. **`server/src/models/Article.ts`**
   - **Action:**
     - Remove `likes` from `IEngagement` interface
     - Remove `likes` from `EngagementSchema`
   - **Risk:** MEDIUM - Database schema change, requires migration consideration

5. **`src/types/index.ts`**
   - **Action:** Remove `likes` from `Engagement` interface
   - **Risk:** LOW - Type definition only

6. **`BACKEND_API_CONTRACT.md`**
   - **Action:** Update documentation to remove `likes` from engagement schema
   - **Risk:** NONE - Documentation only

### 8.3 Files SAFE TO IGNORE

1. **`src/services/storageService.ts`** - No like methods
2. **`src/services/adapters/RestAdapter.ts`** - No like methods
3. **`server/src/controllers/articlesController.ts`** - No like endpoints
4. **`server/src/controllers/adminController.ts`** - No like analytics
5. **`server/src/routes/articles.ts`** - No like routes
6. **`server/src/utils/seed.ts`** - No engagement seeding
7. **`server/src/utils/forceSeed.ts`** - No engagement seeding
8. **`COMPLETE_CODEBASE.txt`** - Snapshot/documentation file

---

## 9. Database Collections Affected

### 9.1 Collections Requiring Updates

#### **`articles` Collection**
- **Field:** `engagement.likes`
- **Current State:** Optional field, defaults to 0
- **Action Required:** 
  - **Option 1 (Recommended):** Leave field in database, remove from schema/types (backward compatible)
  - **Option 2:** Remove field via migration (requires data migration script)
- **Risk:** 
  - Option 1: LOW - Field remains but unused
  - Option 2: MEDIUM - Requires migration script and testing

### 9.2 No Dedicated Collections

- ✅ No `likes` collection
- ✅ No `reactions` collection
- ✅ No user-to-article mapping collection

---

## 10. Runtime Risk Warnings

### 10.1 High Risk Areas

**NONE** - All like functionality is non-functional (stubs/placeholders)

### 10.2 Medium Risk Areas

1. **Database Schema Change (`server/src/models/Article.ts`)**
   - **Risk:** If removing `likes` from schema, existing documents with `engagement.likes` will have orphaned data
   - **Mitigation:** 
     - Option 1: Keep field in schema but remove from TypeScript interfaces (backward compatible)
     - Option 2: Create migration script to remove `engagement.likes` from all documents
   - **Recommendation:** Use Option 1 for safety

2. **Component Dependencies (`ActionDock.tsx` refactoring)**
   - **Risk:** `DetailViewBottomSheet` imports and uses `ActionDock`
   - **Mitigation:** Refactor `ActionDock` to remove like functionality, keep share and source link
   - **Recommendation:** Remove like button and related props, keep other functionality intact

### 10.3 Low Risk Areas

1. **Type Definitions** - Removing `likes` from interfaces is safe (no runtime impact)
2. **Stub Handlers** - Removing empty handlers is safe
3. **Display-Only References** - Removing like count display is safe

---

## 11. Recommended Removal Strategy

### Phase 1: Frontend Cleanup (Low Risk)
1. ✅ Remove `isLiked` and `onLike` from `useNewsCard.ts`
2. ✅ Remove like display from `ArticleDetail.tsx` footer
3. ✅ Refactor `ActionDock.tsx` to remove like button (remove Heart import, onLike prop, isLiked state, and like button rendering)
4. ✅ Remove `onLike` prop from `DetailViewBottomSheet.tsx`

### Phase 2: Type Definitions (Low Risk)
1. ✅ Remove `likes` from `Engagement` interface in `src/types/index.ts`
2. ✅ Remove `likes` from `IEngagement` interface in `server/src/models/Article.ts`

### Phase 3: Database Schema (Medium Risk - Optional)
1. ⚠️ **Option 1 (Recommended):** Keep `likes` in `EngagementSchema` but remove from TypeScript interfaces
2. ⚠️ **Option 2:** Remove `likes` from schema and create migration script

### Phase 4: Documentation (No Risk)
1. ✅ Update `BACKEND_API_CONTRACT.md` to remove `likes` from engagement schema

---

## 12. Testing Checklist

After removal, verify:
- [ ] No TypeScript compilation errors
- [ ] No runtime errors when viewing articles
- [ ] `DetailViewBottomSheet` renders correctly without like button
- [ ] `ArticleDetail` footer displays correctly without like count
- [ ] No broken imports or missing components
- [ ] Database queries don't fail (if keeping field in schema)

---

## 13. Summary Statistics

- **Total Files Analyzed:** 20+
- **Core Feature Files (Delete):** 0
- **Shared Files (Modify):** 7
- **Safe to Ignore:** 8
- **Database Collections Affected:** 1 (`articles.engagement.likes`)
- **API Endpoints:** 0 (none exist)
- **Runtime Risk:** LOW (all functionality is stubs)

---

## 14. Conclusion

The likes/reactions feature is **non-functional** and safe to remove:
- All like handlers are stubs/placeholders
- No backend API endpoints exist
- No database collections for tracking likes
- Only display references and UI components exist

**Recommended Action:** Proceed with removal using Phase 1-4 strategy above. The feature can be safely removed with minimal risk.

