# Category Casing Fix - Preserve Acronyms

**Date:** January 1, 2026  
**Issue:** Category tabs showing "Ai" and "Usa" instead of "AI" and "USA"  
**Status:** ✅ FIXED

---

## Problem

Category filter bar was displaying tags with incorrect casing:
- **Shown:** "Ai", "Usa" (sentence case)
- **Expected:** "AI", "USA" (uppercase/acronyms)
- **Backend/Admin Panel:** Shows correct casing

---

## Root Cause

The `normalizeCategoryLabel()` function in `src/utils/formatters.ts` was converting **all** category names to Title Case, which transformed:
- "AI" → "Ai"
- "USA" → "Usa"  
- "PE/VC" → "Pe/Vc"

This happened when tags were created via the TagSelector component, which uses `normalizeCategoryLabel()` to format new tags.

---

## Solution

### Fix 1: Preserve Acronyms in normalizeCategoryLabel ✅

**File:** `src/utils/formatters.ts`

**Change:** Updated `normalizeCategoryLabel()` to detect and preserve acronyms (all-uppercase words with special characters like "/", "&").

**Logic:**
- If word is all uppercase AND contains only letters, numbers, "/", "&" → preserve as-is
- If word is mixed case → preserve as-is (e.g., "iPhone", "McDonald's")
- Only apply title case to all-lowercase words

**Result:**
- "AI" stays "AI" ✅
- "USA" stays "USA" ✅
- "PE/VC" stays "PE/VC" ✅
- "blockchain" becomes "Blockchain" ✅
- "machine learning" becomes "Machine Learning" ✅

### Fix 2: Use Backend Tag Names for Display ✅

**File:** `src/pages/HomePage.tsx`

**Change:** Fetch tags from backend API (`format=full`) to get correct `rawName` casing, then map category names to correct casing when displaying in category filter bar.

**Logic:**
1. Fetch all tags with `getCategoriesWithIds()` (returns Tag objects with `rawName`)
2. Create mapping: `canonicalName` (lowercase) → `rawName` (correct casing)
3. When counting categories, use canonical names for grouping
4. When displaying, look up correct casing from tag mapping

**Result:**
- Category tabs now show correct casing from backend tags
- Even if articles have old incorrect casing, display uses correct tag names

---

## Files Modified

1. **src/utils/formatters.ts**
   - Updated `normalizeCategoryLabel()` to preserve acronyms

2. **src/pages/HomePage.tsx**
   - Added `tagNameMap` state to store tag casing mapping
   - Updated `categoriesWithCounts` to use correct casing from tags
   - Added `useEffect` to fetch tags and build mapping

3. **src/services/adapters/IAdapter.ts**
   - Added optional `getCategoriesWithIds?()` method to interface

---

## Testing

### Before Fix ❌
```
Category tabs: "Ai (6)", "Usa (2)"
Backend tags: "AI", "USA"
Mismatch! ❌
```

### After Fix ✅
```
Category tabs: "AI (6)", "USA (2)"
Backend tags: "AI", "USA"
Match! ✅
```

### Test Cases

1. **New Tag Creation**
   - Create tag "AI" → Should stay "AI" (not "Ai")
   - Create tag "USA" → Should stay "USA" (not "Usa")
   - Create tag "PE/VC" → Should stay "PE/VC" (not "Pe/Vc")

2. **Category Display**
   - Category tabs should show correct casing from backend
   - Even if articles have old incorrect casing, display should be correct

3. **Mixed Case**
   - "blockchain" → "Blockchain" (title case)
   - "Machine Learning" → "Machine Learning" (preserved)
   - "iPhone" → "iPhone" (preserved)

---

## Backward Compatibility

✅ **Fully backward compatible**
- Old tags with incorrect casing still work
- New tags get correct casing
- Display automatically corrects casing from backend tags
- No database migration needed

---

## Future Improvements

### Option 1: Database Cleanup (Optional)
Run a script to update all articles' `categories` arrays to match Tag `rawName`:

```javascript
// For each article:
// 1. Get categoryIds
// 2. Look up Tag rawName for each ID
// 3. Update article.categories with correct names
```

### Option 2: Use categoryIds for Display (Phase 2 Enhancement)
Since we now have `categoryIds` in articles, we could:
1. Look up Tag `rawName` by `categoryId` when displaying
2. Eliminate need for casing mapping
3. Always show correct casing regardless of article data

---

## Impact

**User-Facing:**
- ✅ Category tabs now show correct casing
- ✅ Consistent with admin panel and backend
- ✅ Acronyms preserved (AI, USA, PE/VC)

**Technical:**
- ✅ New tags created with correct casing
- ✅ Display uses backend as source of truth
- ✅ No breaking changes
- ✅ Zero linter errors

---

## Rollback Plan

If issues arise:

1. **Revert formatters.ts:**
   ```bash
   git revert <commit-hash>
   ```

2. **Revert HomePage.tsx:**
   ```bash
   git revert <commit-hash>
   ```

3. **No data loss** - changes are display-only

---

## Related Issues

- **Phase 1 Fix:** Case-insensitive tag matching (already implemented)
- **Phase 2 Fix:** Tag ID references (already implemented)
- **This Fix:** Preserve acronym casing in display

All three fixes work together to ensure consistent tag handling across the system.

---

**Status:** ✅ Complete and tested  
**Ready for:** Production deployment



