# Phase 9: Legacy Code Removal Plan

**Date:** 2026-01-06  
**Status:** Ready for Implementation  
**Prerequisites:** E2E tests passing, manual testing complete, 1 week staging validation

---

## Overview

Remove all legacy code paths related to the `USE_IMAGE_MANAGER` feature flag. After removal, the component will always use the `useImageManager` hook, simplifying the codebase significantly.

**Expected Impact:**
- Component size: ~2,365 lines → ~500 lines (removing ~1,865 lines)
- Code simplification: Single code path instead of dual paths
- Reduced complexity: No feature flag conditionals

---

## Code Removal Checklist

### 1. Remove Feature Flag References
- [x] Remove `useNewImageManager` constant (line 75)
- [x] Remove `isFeatureEnabled('USE_IMAGE_MANAGER')` import usage
- [x] Remove feature flag import from `@/constants/featureFlags`

### 2. Remove Legacy State Variables
- [x] Remove `_legacyExistingImages` state (line 111)
- [x] Remove `_legacyMasonryMediaItems` state (line 115)
- [x] Remove `_legacyExplicitlyDeletedImages` state (line 153)

### 3. Remove Conditional Logic
- [x] Remove conditional assignments for `existingImages` (line 118)
- [x] Remove conditional assignments for `setExistingImages` (line 119)
- [x] Remove conditional assignments for `masonryMediaItems` (line 120)
- [x] Remove conditional assignments for `setMasonryMediaItems` (line 121)
- [x] Remove conditional assignments for `explicitlyDeletedImages` (line 156)
- [x] Remove conditional assignments for `setExplicitlyDeletedImages` (lines 157-159)

### 4. Simplify Initialization Code
- [x] Remove `if (useNewImageManager)` check in initialization (line 233)
- [x] Remove entire `else` block with legacy initialization (lines 237-256)
- [x] Always use `imageManager.syncFromArticle(initialData)`

### 5. Simplify useEffect Dependencies
- [x] Remove `useNewImageManager` from useEffect dependency array (line 272)
- [x] Simplify sync useEffect to always sync (no conditional)

### 6. Remove Legacy deleteImage() Code Path
- [x] Remove `if (useNewImageManager)` check (line 748)
- [x] Remove entire legacy deletion code block (lines 780-930)
- [x] Keep only imageManager deletion path (lines 748-777)

### 7. Remove Legacy Masonry Handlers
- [x] Remove `if (useNewImageManager)` check in `handleMasonryMediaToggle` (line 1092)
- [x] Remove legacy toggle code (lines 1101-1108)
- [x] Remove `if (useNewImageManager)` check in `handleMasonryTitleChange` (line 1182)
- [x] Remove legacy title change code (lines 1194-1203)

### 8. Update Direct References
- [x] Replace all `existingImages` references to use `imageManager.existingImages` directly
- [x] Replace all `masonryMediaItems` references to use `imageManager.masonryItems` directly
- [x] Replace all `explicitlyDeletedImages` references to use `imageManager.explicitlyDeletedUrls` directly
- [x] Remove all `setExistingImages`, `setMasonryMediaItems`, `setExplicitlyDeletedImages` calls (no-ops)

### 9. Clean Up Comments
- [x] Remove "Legacy state" comments
- [x] Remove "LEGACY CODE PATH" comments
- [x] Remove "When using new imageManager" comments
- [x] Update comments to reflect single code path

### 10. Update Feature Flag File
- [x] Remove `USE_IMAGE_MANAGER` from `src/constants/featureFlags.ts`
- [x] Update feature flag documentation

---

## Files to Modify

### Primary File
- `src/components/CreateNuggetModal.tsx` - Main component file

### Configuration Files
- `src/constants/featureFlags.ts` - Remove feature flag definition

### Documentation Files
- `CREATENUGGETMODAL_REFACTOR_CHECKPOINT_PHASE1.md` - Mark Phase 9 complete
- Remove feature flag references from docs

---

## Implementation Steps

1. **Backup Current State** ✅ (Git handles this)
2. **Remove Feature Flag Constant** - Line 75
3. **Remove Legacy State Variables** - Lines 111, 115, 153
4. **Simplify Derived Values** - Lines 118-121, 156-159
5. **Simplify Initialization** - Lines 232-256
6. **Simplify useEffect** - Line 272
7. **Simplify deleteImage** - Lines 748-930
8. **Simplify Masonry Handlers** - Lines 1092-1203
9. **Remove Feature Flag Import** - Line 38
10. **Update Feature Flag File** - Remove USE_IMAGE_MANAGER
11. **Test Changes** - Verify component still works
12. **Update Documentation** - Mark Phase 9 complete

---

## Risk Assessment

### Low Risk
- All code paths have been tested
- Feature flag has been enabled and validated
- Integration tests cover the new code path

### Mitigation
- Changes are straightforward removals
- No new logic introduced
- Can revert via Git if issues found

---

## Success Criteria

- [ ] Component compiles without errors
- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] All tests still pass
- [ ] Component size reduced significantly
- [ ] No feature flag references remain
- [ ] Documentation updated

---

## Notes

- This is a pure removal operation - no new code added
- All removed code has been validated in production
- The new code path is the only path that will remain
- Component will be significantly simpler after removal


