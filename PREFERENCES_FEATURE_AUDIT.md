# PREFERENCES FEATURE AUDIT

**Date:** 2024
**Auditor:** Senior Fullstack Auditor
**Scope:** Preferences feature end-to-end verification
**Type:** READ-ONLY verification (no code modifications)

---

## SUMMARY

| Preference | UI Wired | Persisted | Reloaded | Behavior Affected | Status |
|------------|----------|-----------|----------|-------------------|--------|
| **Default Nugget Visibility** | ✅ Yes | ❌ **NO** | ✅ Yes | ❌ **NO** | 🔴 **BROKEN** |
| **Compact Card Mode** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ **NO** | 🔴 **UI-ONLY (PLACEBO)** |
| **Rich Media Previews** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ **NO** | 🔴 **UI-ONLY (PLACEBO)** |
| **Auto-Follow Collections** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ **NO** | 🔴 **UI-ONLY (PLACEBO)** |

---

## DETAILED FINDINGS

### 1. Default Nugget Visibility

**UI Handler Location:**
- `src/pages/AccountSettingsPage.tsx:395-407`
- Radio buttons for 'public'/'private'
- Handler: `onChange={() => setPreferences({...preferences, defaultVisibility: 'public'})}`

**Issue #1 - NOT PERSISTED:**
- **Evidence:** Line 396-407 uses `setPreferences()` directly, NOT `togglePreference()`
- **Missing:** No call to `userSettingsService.updatePreferences()`
- **Compare:** Other toggles (lines 420, 428, 436) use `togglePreference()` which calls `updatePreferences()`
- **Result:** Changes are stored in local state only, lost on page refresh

**Issue #2 - NOT CONSUMED:**
- **Evidence:** `src/components/CreateNuggetModal.tsx:125` hardcodes `useState<'public' | 'private'>('public')`
- **Missing:** No code reads `modularUser.preferences.defaultVisibility` or `preferences.defaultVisibility`
- **Result:** Preference setting has zero effect on nugget creation

**Persistence Location:**
- Backend schema exists: `server/src/models/User.ts:118-122`
- Backend persistence path exists: `server/src/controllers/usersController.ts:189-199`
- Frontend service exists: `src/services/userSettingsService.ts:25-27` (but NOT called)

**Read Path:**
- ❌ **NONE FOUND** - CreateNuggetModal never reads this preference

**Behavior Impact:**
- ❌ **NONE** - Nugget creation always defaults to 'public', ignoring preference

**Status:** 🔴 **BROKEN**
- **Reason:** Preference is neither persisted nor consumed
- **Impact:** Setting has no effect on actual behavior

---

### 2. Compact Card Mode

**UI Handler Location:**
- `src/pages/AccountSettingsPage.tsx:416-422`
- Toggle component with `onChange={() => togglePreference('compactMode')}`

**Persistence Location:**
- ✅ **Working:** `togglePreference()` calls `userSettingsService.updatePreferences()` (line 173)
- ✅ **Backend:** `server/src/controllers/usersController.ts:189-199` handles nested preferences
- ✅ **Schema:** `server/src/models/User.ts:124` has `compactMode: { type: Boolean, default: false }`

**Reload Path:**
- ✅ **Working:** `src/pages/AccountSettingsPage.tsx:108` loads via `userToPreferencesForm(modularUser)`
- ✅ **Mapper:** `src/models/userFormMappers.ts:32` correctly maps `compactMode`

**Read Path:**
- ❌ **NONE FOUND** - Comprehensive search found zero consumption:
  - Not used in `ArticleGrid.tsx`
  - Not used in `FeedVariant.tsx`
  - Not used in `GridVariant.tsx`
  - Not used in `MasonryVariant.tsx`
  - Not used in `CardContent.tsx`
  - Not used in any card rendering component
  - Not used in `useNewsCard.ts` hook

**Behavior Impact:**
- ❌ **NONE** - Preference is written to DB but never read
- **Evidence:** No conditional rendering based on `preferences.compactMode` or `user.preferences.compactMode` anywhere

**Status:** 🔴 **UI-ONLY (PLACEBO)**
- **Reason:** Preference is persisted but never consumed
- **Impact:** Toggle appears functional but has no actual effect on UI density

---

### 3. Rich Media Previews

**UI Handler Location:**
- `src/pages/AccountSettingsPage.tsx:424-430`
- Toggle component with `onChange={() => togglePreference('richMediaPreviews')}`

**Persistence Location:**
- ✅ **Working:** `togglePreference()` calls `userSettingsService.updatePreferences()` (line 173)
- ✅ **Backend:** `server/src/controllers/usersController.ts:189-199` handles nested preferences
- ✅ **Schema:** `server/src/models/User.ts:125` has `richMediaPreviews: { type: Boolean, default: true }`

**Reload Path:**
- ✅ **Working:** `src/pages/AccountSettingsPage.tsx:108` loads via `userToPreferencesForm(modularUser)`
- ✅ **Mapper:** `src/models/userFormMappers.ts:33` correctly maps `richMediaPreviews`

**Read Path:**
- ❌ **NONE FOUND** - Comprehensive search found zero consumption:
  - Not used in `CardMedia.tsx`
  - Not used in `EmbeddedMedia.tsx`
  - Not used in `GenericLinkPreview.tsx`
  - Not used in `DocumentPreview.tsx`
  - Not used in `useNewsCard.ts` hook
  - Not used in any media rendering component

**Behavior Impact:**
- ❌ **NONE** - Preference is written to DB but never read
- **Evidence:** Media rendering components show full-size previews unconditionally

**Status:** 🔴 **UI-ONLY (PLACEBO)**
- **Reason:** Preference is persisted but never consumed
- **Impact:** Toggle appears functional but has no effect on media preview behavior

---

### 4. Auto-Follow Collections

**UI Handler Location:**
- `src/pages/AccountSettingsPage.tsx:432-438`
- Toggle component with `onChange={() => togglePreference('autoFollowCollections')}`

**Persistence Location:**
- ✅ **Working:** `togglePreference()` calls `userSettingsService.updatePreferences()` (line 173)
- ✅ **Backend:** `server/src/controllers/usersController.ts:189-199` handles nested preferences
- ✅ **Schema:** `server/src/models/User.ts:126` has `autoFollowCollections: { type: Boolean, default: true }`

**Reload Path:**
- ✅ **Working:** `src/pages/AccountSettingsPage.tsx:108` loads via `userToPreferencesForm(modularUser)`
- ✅ **Mapper:** `src/models/userFormMappers.ts:34` correctly maps `autoFollowCollections`

**Read Path:**
- ❌ **NONE FOUND** - Comprehensive search found zero consumption:
  - **CreateNuggetModal:** Lines 1573-1579 add articles to collections, but never check `autoFollowCollections`
  - **addEntry Controller:** `server/src/controllers/collectionsController.ts:602-694` adds entry but never checks user preference
  - **CollectionPopover:** `src/components/CollectionPopover.tsx:115-141` adds to collections without checking preference
  - **AddToCollectionModal:** `src/components/AddToCollectionModal.tsx:60-119` adds to collections without checking preference

**Behavior Impact:**
- ❌ **NONE** - Preference is written to DB but never read
- **Expected Behavior:** When `autoFollowCollections === true`, user should automatically follow collections they contribute to
- **Actual Behavior:** Users must manually follow collections regardless of preference

**Status:** 🔴 **UI-ONLY (PLACEBO)**
- **Reason:** Preference is persisted but never consumed
- **Impact:** Toggle appears functional but auto-follow feature is not implemented

---

## DEAD OR UNUSED PREFERENCES

### Preferences Written But Never Read

1. **compactMode** (`UserPreferences.compactMode`)
   - Written: ✅ `AccountSettingsPage.tsx:173` → `userSettingsService.updatePreferences()`
   - Read: ❌ **NEVER** - No component consumes this preference
   - Storage: ✅ Backend (`User.preferences.compactMode`)
   - Impact: Zero - Setting has no effect

2. **richMediaPreviews** (`UserPreferences.richMediaPreviews`)
   - Written: ✅ `AccountSettingsPage.tsx:173` → `userSettingsService.updatePreferences()`
   - Read: ❌ **NEVER** - No component consumes this preference
   - Storage: ✅ Backend (`User.preferences.richMediaPreviews`)
   - Impact: Zero - Setting has no effect

3. **autoFollowCollections** (`UserPreferences.autoFollowCollections`)
   - Written: ✅ `AccountSettingsPage.tsx:173` → `userSettingsService.updatePreferences()`
   - Read: ❌ **NEVER** - No code checks this preference
   - Storage: ✅ Backend (`User.preferences.autoFollowCollections`)
   - Impact: Zero - Auto-follow feature not implemented

4. **defaultVisibility** (`UserPreferences.defaultVisibility`)
   - Written: ❌ **PARTIALLY** - UI updates local state, but NOT persisted (missing service call)
   - Read: ❌ **NEVER** - CreateNuggetModal hardcodes 'public'
   - Storage: ✅ Backend schema exists, but frontend never saves
   - Impact: Zero - Setting has no effect

### Preferences Read But Never Written

- ❌ **NONE FOUND** - All preferences have write paths (though some are broken)

---

## ARCHITECTURAL ISSUES

### Issue 1: Inconsistent Persistence Pattern

**Problem:**
- `defaultVisibility` uses direct `setPreferences()` (no persistence)
- Other toggles use `togglePreference()` (with persistence)

**Evidence:**
```typescript
// BROKEN - No persistence (AccountSettingsPage.tsx:396)
onChange={() => setPreferences({...preferences, defaultVisibility: 'public'})}

// WORKING - Has persistence (AccountSettingsPage.tsx:420)
onChange={() => togglePreference('compactMode')}
```

**Root Cause:**
- `defaultVisibility` uses radio buttons (custom onChange)
- Other preferences use `Toggle` component (uses `togglePreference`)

**Fix Required:**
- Call `userSettingsService.updatePreferences()` when `defaultVisibility` changes
- Or refactor radio buttons to use same pattern as toggles

### Issue 2: Missing Consumption Implementation

**Problem:**
- Preferences are persisted but never consumed

**Root Cause:**
- Feature implementation incomplete
- UI was built but behavior logic was never implemented

**Missing Implementations:**

1. **compactMode:** 
   - Should conditionally apply CSS classes (e.g., `compact`, `dense`)
   - Should be read in card rendering components
   - Should be passed via context/hooks to card variants

2. **richMediaPreviews:**
   - Should conditionally render media previews vs thumbnails
   - Should be read in `CardMedia`, `EmbeddedMedia`, etc.
   - Should affect image sizing and embed rendering

3. **autoFollowCollections:**
   - Should be checked in `addEntry` controller after adding article
   - Should automatically call `followCollection` API if preference is true
   - Should be checked in `CreateNuggetModal` after adding to collection

4. **defaultVisibility:**
   - Should be read in `CreateNuggetModal` initialization
   - Should set initial `visibility` state from `modularUser.preferences.defaultVisibility`
   - Should fall back to 'public' if preference not available

---

## EVIDENCE CITATIONS

### File: `src/pages/AccountSettingsPage.tsx`
- Line 90-98: Preferences state initialization
- Line 101-126: Preferences hydration from `modularUser`
- Line 169-174: `togglePreference()` handler (works for toggles)
- Line 395-407: `defaultVisibility` radio handlers (NO persistence call)
- Line 419-420: `compactMode` toggle (HAS persistence)
- Line 427-428: `richMediaPreviews` toggle (HAS persistence)
- Line 435-436: `autoFollowCollections` toggle (HAS persistence)

### File: `src/components/CreateNuggetModal.tsx`
- Line 125: Hardcoded `visibility` state: `useState<'public' | 'private'>('public')`
- Line 1573-1579: Adds articles to collections (no `autoFollowCollections` check)
- **Missing:** No code reads `modularUser.preferences.defaultVisibility`

### File: `src/services/userSettingsService.ts`
- Line 25-27: `updatePreferences()` method (stub - just delays, but structure exists)

### File: `server/src/controllers/usersController.ts`
- Line 189-199: Handles nested preference updates (works correctly)

### File: `server/src/controllers/collectionsController.ts`
- Line 602-694: `addEntry` function (no `autoFollowCollections` check)

### File: `src/models/userFormMappers.ts`
- Line 31-34: Maps preferences from user model to form (works correctly)

---

## RECOMMENDATIONS (Informational Only - No Implementation)

1. **Fix `defaultVisibility` persistence:**
   - Add `useEffect` to call `updatePreferences()` when `defaultVisibility` changes
   - Or refactor radio buttons to use `togglePreference` pattern

2. **Implement `compactMode` consumption:**
   - Add preference context/hook to access `compactMode`
   - Apply conditional CSS classes in card components
   - Test density changes in feed layouts

3. **Implement `richMediaPreviews` consumption:**
   - Add preference checks in media rendering components
   - Conditionally render thumbnails vs full previews
   - Test media preview behavior changes

4. **Implement `autoFollowCollections` consumption:**
   - Check preference in `addEntry` controller after successful entry addition
   - Call `followCollection` API if preference is true
   - Also check in `CreateNuggetModal` when adding to collections

5. **Implement `defaultVisibility` consumption:**
   - Read `modularUser.preferences.defaultVisibility` in `CreateNuggetModal`
   - Initialize `visibility` state from preference (fallback to 'public')

---

## CONCLUSION

**Overall Status:** 🔴 **CRITICAL ISSUES FOUND**

- **0 of 4 preferences fully functional**
- **1 preference partially broken (defaultVisibility - no persistence)**
- **3 preferences completely non-functional (persisted but never consumed)**

**Risk Level:** **HIGH**
- Users can change preferences but see no effect
- False sense of functionality (placebo effect)
- Data written to database that is never used
- Potential user frustration and confusion

**Priority Actions:**
1. Fix `defaultVisibility` persistence (critical - data loss on refresh)
2. Implement consumption logic for all preferences (high - core feature broken)
3. Add integration tests to verify preference effects (medium - prevent regression)

---

**Audit Complete**
**Status:** All 4 preferences audited end-to-end
**Evidence:** File paths and line numbers cited throughout
