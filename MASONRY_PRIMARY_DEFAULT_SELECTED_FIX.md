# Primary Media Default Selected in Create Mode - Fix Report

## Problem Summary

Previous implementation made primary media opt-in (defaulted to `showInMasonry: false`), but the requirement is that primary media should be **selected by default** in Create mode (while still allowing users to unselect it).

## Solution Implemented

### Changes Made

1. **Create Mode Initialization**
   - Primary media now defaults to `showInMasonry: true` (selected by default)
   - Primary media remains `isLocked: false` (can be unselected)
   - Supporting media remain opt-in (`showInMasonry: false`)
   - If user unselects primary media, nugget won't appear in Masonry (no fallback)

2. **Edit Mode Behavior**
   - Respects whatever values are stored in the DB
   - Does not override existing `showInMasonry` values
   - Uses `collectMasonryMediaItems` which preserves existing values

3. **Masonry Rendering Rule**
   - `getMasonryVisibleMedia()` only returns media where `showInMasonry === true`
   - If no items are true → returns empty array
   - No fallback to auto-including primary media

4. **UI Behavior**
   - Toggle for primary media remains interactive (not locked)
   - Supporting media remain opt-in
   - Added helper text: "Primary media is selected by default. You may unselect it if you don't want this nugget to appear in the Masonry layout."
   - Helper text only shows when primary is selected

## Code Changes

### File: `src/components/CreateNuggetModal.tsx`

1. **Updated Create Mode Media Population** (lines ~1099-1115):
   ```typescript
   // 1. Primary media (SELECTED by default in Create mode, but NOT locked)
   showInMasonry: true, // Selected by default in Create mode
   isLocked: false, // NOT locked - user can unselect if they don't want nugget in Masonry
   ```

2. **Updated Create Mode Submission** (lines ~1758-1766):
   ```typescript
   // CREATE MODE: Primary media defaults to showInMasonry: true (selected by default)
   // Use value from masonryMediaItems state (user may have unselected it)
   showInMasonry: primaryItem.showInMasonry !== undefined ? primaryItem.showInMasonry : true,
   ```

3. **Updated Documentation Comments**:
   - Added explanation of Create mode default behavior
   - Documented Edit mode behavior (respects DB values)

### File: `src/components/CreateNuggetModal/MasonryMediaToggle.tsx`

1. **Updated Helper Text** (lines ~70-73):
   ```typescript
   {isPrimarySelected && primaryItem && (
     <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">
       Primary media is selected by default. You may unselect it if you don't want this nugget to appear in the Masonry layout.
     </p>
   )}
   ```

2. **Updated Documentation**:
   - Added explanation of Create mode default behavior
   - Documented Edit mode behavior (respects DB values)

### File: `src/utils/masonryMediaHelper.ts`

**No changes needed** - Edit mode already respects DB values:
- `collectMasonryMediaItems` preserves existing `showInMasonry` values if set
- Only defaults to `false` if value is undefined (for backward compatibility)
- `getMasonryVisibleMedia` already has no fallback (returns empty array if no items selected)

## Behavior Changes

### Create Mode
**Before:**
- Primary media: `showInMasonry: false` (opt-in)
- User had to explicitly select primary media

**After:**
- Primary media: `showInMasonry: true (selected by default), `isLocked: false` (can be unselected)
- User can unselect primary media if they don't want nugget in Masonry
- Supporting media remain opt-in

### Edit Mode
**No changes** - Already respects DB values:
- Preserves existing `showInMasonry` values
- Does not override user selections

### Rendering
**No changes** - Already correct:
- Only returns media where `showInMasonry === true`
- Returns empty array if no items selected (no fallback)

## Test Scenarios

### ✅ Create nugget + upload one image → primary selected by default → user can unselect → nugget does not appear in Masonry
**Expected**: Primary media is selected by default, user can unselect it, nugget won't appear in Masonry

### ✅ Create nugget + multiple images → only primary selected by default → others optional
**Expected**: Only primary media is selected by default, supporting media are opt-in

### ✅ Edit nugget where masonry selections already exist → values persist
**Expected**: Existing `showInMasonry` values are preserved, not overridden

### ✅ Create nugget → unselect primary → select supporting media → post
**Expected**: Only supporting media appears in Masonry (primary unselected)

### ✅ Create nugget → keep primary selected → post
**Expected**: Primary media appears in Masonry (default behavior)

## Files Modified

- `src/components/CreateNuggetModal.tsx`
- `src/components/CreateNuggetModal/MasonryMediaToggle.tsx`

## Files Unchanged (Already Correct)

- `src/utils/masonryMediaHelper.ts` - Edit mode already respects DB values, rendering already has no fallback

## Guard Rails Maintained

✅ **No Breaking Changes**: Existing nuggets continue to work  
✅ **Edit Mode Preserved**: DB values are respected, not overridden  
✅ **No Side Effects**: Grid/feed layouts unaffected  
✅ **State Sync**: `masonryMediaItems` ↔ `media` ↔ backend payload  
✅ **Rendering Logic**: Masonry rendering logic unchanged (only selection behavior)  
✅ **Carousel/Drawer**: Click behavior unchanged  

## Inline Comments Added

All changes include inline comments explaining:
- Create mode default behavior (primary selected by default)
- That primary media can be unselected (not locked)
- Edit mode behavior (respects DB values)
- No fallback if all media unselected



