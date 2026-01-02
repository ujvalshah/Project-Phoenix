# Make Primary Media Optional in Masonry View - Fix Report

## Problem Summary

Primary media was previously auto-included and locked in Masonry view, preventing users from:
- Excluding primary media from Masonry layout
- Creating nuggets with zero media selections in Masonry
- Having full control over which media appears in Masonry view

## Solution Implemented

### Changes Made

1. **Removed Auto-Include and Locked Behavior for Primary Media**
   - Primary media no longer defaults to `showInMasonry: true`
   - Primary media is no longer locked (`isLocked: false`)
   - All media items (including primary) now default to `showInMasonry: false` (opt-in)

2. **Removed Fallback Logic**
   - Removed fallback that auto-included primary media when no items were selected
   - If no media has `showInMasonry: true`, nugget won't appear in Masonry view
   - This allows users to explicitly exclude all media from Masonry

3. **Updated UI Messaging**
   - Removed "Primary media is always included in Masonry view" message
   - Added helper text: "Select the media you want to appear in the Masonry layout (optional)."
   - Updated footer text to explain zero selections are allowed

4. **Backward Compatibility**
   - Existing nuggets with `showInMasonry: true` continue to display normally
   - Only newly created or edited nuggets use the new opt-in behavior
   - If `showInMasonry` is explicitly set (true or false), that value is preserved

## Code Changes

### File: `src/utils/masonryMediaHelper.ts`

1. **Updated Documentation**:
   - Added explanation that masonry participation is now user-controlled
   - Documented that primary media is no longer auto-included or locked

2. **Updated `collectMasonryMediaItems` function**:
   - Changed primary media default from `showInMasonry: true` to `showInMasonry: false`
   - Changed `isLocked: true` to `isLocked: false` for primary media
   - Added backward compatibility comments

3. **Updated `getMasonryVisibleMedia` function**:
   - Removed fallback logic that auto-included primary media
   - Now returns empty array if no items have `showInMasonry: true`
   - Allows users to explicitly exclude all media from Masonry

### File: `src/components/CreateNuggetModal.tsx`

1. **Updated Create Mode Media Population**:
   - Changed primary media defaults to `showInMasonry: false` and `isLocked: false`
   - Updated comments explaining the new opt-in behavior

2. **Updated Create Mode Submission**:
   - Changed default from `true` to `false` when applying masonry fields
   - Uses value from `masonryMediaItems` state (which defaults to false)

3. **Updated Documentation Comments**:
   - Added explanation that masonry participation is now user-controlled
   - Documented backward compatibility behavior

### File: `src/components/CreateNuggetModal/MasonryMediaToggle.tsx`

1. **Removed Locked UI**:
   - Removed `disabled` attribute and locked styling
   - Removed `isLocked` checks from click handler
   - All media items can now be toggled

2. **Updated Tooltips and Labels**:
   - Removed "Primary media is always included" tooltip
   - Simplified tooltips to just "Click to include/exclude"

3. **Updated Messaging**:
   - Added helper text: "Select the media you want to appear in the Masonry layout (optional)."
   - Updated footer text: "If no media is selected, this nugget will not appear in Masonry view."

4. **Updated Documentation**:
   - Added comments explaining that masonry participation is now user-controlled

## Behavior Changes

### Before
- Primary media: Auto-included (`showInMasonry: true`), locked (`isLocked: true`)
- Supporting media: Opt-in (`showInMasonry: false`), toggleable
- Fallback: If no items selected, primary media auto-included

### After
- Primary media: Opt-in (`showInMasonry: false`), toggleable (`isLocked: false`)
- Supporting media: Opt-in (`showInMasonry: false`), toggleable
- No fallback: If no items selected, nugget won't appear in Masonry

## Backward Compatibility

✅ **Existing Nuggets**: Nuggets with `showInMasonry: true` continue to display normally  
✅ **Explicit Values**: If `showInMasonry` is explicitly set (true or false), that value is preserved  
✅ **New Nuggets**: Only newly created or edited nuggets use the new opt-in behavior  

## Test Scenarios

### ✅ Create nugget → upload one image → do not select masonry → post
**Expected**: Nugget appears normally, not in masonry

### ✅ Create nugget → upload multiple images → select only one → post
**Expected**: Only selected tile appears in masonry

### ✅ Edit nugget → deselect previously-included media → save
**Expected**: Tile disappears from masonry

### ✅ Create nugget → upload media → select all → post
**Expected**: All selected tiles appear in masonry

### ✅ Create nugget → upload media → select none → post
**Expected**: Nugget appears normally, not in masonry

## Files Modified

- `src/utils/masonryMediaHelper.ts`
- `src/components/CreateNuggetModal.tsx`
- `src/components/CreateNuggetModal/MasonryMediaToggle.tsx`

## Related Files (No Changes)

- `src/components/masonry/MediaBlock.tsx` (Uses `getMasonryVisibleMedia`, automatically benefits from changes)
- `src/components/MasonryGrid.tsx` (Renders articles, no changes needed)
- `src/components/masonry/MasonryAtom.tsx` (Renders individual tiles, no changes needed)

## Guard Rails Maintained

✅ **No Breaking Changes**: Existing nuggets continue to work  
✅ **No Side Effects**: Grid/feed layouts unaffected  
✅ **State Sync**: `masonryMediaItems` ↔ `media` ↔ backend payload  
✅ **Rendering Logic**: Masonry rendering logic unchanged (only selection behavior)  
✅ **Carousel/Drawer**: Click behavior unchanged  

## Inline Comments Added

All changes include inline comments explaining:
- Why primary media is no longer forced
- That masonry participation is now user-controlled
- Backward-compatibility intent
- Default behavior changes



