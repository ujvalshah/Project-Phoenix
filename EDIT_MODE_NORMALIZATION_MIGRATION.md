# EDIT Mode Normalization Migration Summary

## Overview
This document summarizes the refactoring of EDIT mode normalization logic in `CreateNuggetModal.tsx` to use the shared `normalizeArticleInput` function.

## Phase: EXTRACTION ONLY
- **NO behavior changes**
- **NO simplifications**
- **NO optimizations**
- **KEEP all quirks and inconsistencies EXACTLY as-is**

## Changes Made

### 1. Helper Functions Added

#### `deepCompareEditPayloads(oldPayload, newPayload)`
- Deep comparison helper for EDIT mode payloads
- Compares only fields that EDIT mode updates (partial payload)
- Handles null vs undefined as equivalent for EDIT mode
- Deep compares arrays and objects
- Returns `{ match: boolean, diff?: any }`

#### `buildLegacyEditPayload(...)`
- Extracted legacy EDIT mode payload building logic
- Preserves all existing behavior exactly as-is
- Marked with `TODO: Remove after parity verification`
- Used for comparison and fallback

### 2. EDIT Mode Submission Branch Refactored

**Location:** `src/components/CreateNuggetModal.tsx` (lines ~1684-1950)

**Before:**
- Inline normalization logic (340+ lines)
- Direct payload construction
- No comparison or safety checks

**After:**
- Dual-path approach:
  1. Build legacy payload using `buildLegacyEditPayload()`
  2. Build new payload using `normalizeArticleInput()`
  3. Deep compare payloads
  4. Use legacy if mismatch, otherwise use new

### 3. Safety Checks Implemented

#### Payload Comparison
- Deep comparison of all EDIT mode fields:
  - `title`, `content`, `categories`, `visibility`, `readTime`, `excerpt`
  - `images`, `mediaIds`, `media`, `supportingMedia`, `customCreatedAt`, `primaryMedia`
- If mismatch detected:
  - Log warning with diff details
  - Use legacy payload (ensures behavior remains identical)

#### Logging Guards Added

1. **Media null vs undefined tracking:**
   ```typescript
   if (normalizedInput.media === null && oldPayload.media !== null) {
       console.log('[EDIT MIGRATION] Media set to null (clearing media field)', ...);
   }
   ```

2. **Images pruned due to supportingMedia:**
   ```typescript
   // Tracks when images are removed from images array because they're in supportingMedia
   ```

3. **Masonry flags differences:**
   ```typescript
   if (newShowInMasonry !== oldShowInMasonry) {
       console.log('[EDIT MIGRATION] Masonry flag changed', ...);
   }
   ```

4. **hasEmptyTagsError in EDIT mode (should not appear):**
   ```typescript
   if (normalizedInput.hasEmptyTagsError) {
       console.warn('[EDIT MIGRATION] hasEmptyTagsError appeared in EDIT mode (unexpected)', ...);
   }
   ```

### 4. Payload Construction

#### New Payload (using normalizeArticleInput)
- Converts normalized output to partial update payload
- **CRITICAL:** Only includes fields that have changed (EDIT mode semantics)
- Preserves null vs undefined semantics:
  - `undefined` = don't update field
  - `null` = clear field

#### Legacy Payload (preserved)
- Kept in place for comparison and fallback
- Will be removed after parity verification

## Fields Migrated to Shared Module

The following normalization logic is now handled by `normalizeArticleInput()`:

1. **Basic fields:**
   - `title`, `content`, `categories`, `visibility`
   - `readTime` calculation
   - `excerpt` generation
   - `tags` normalization

2. **Media handling:**
   - URL separation (image URLs vs link URLs)
   - Primary URL detection
   - Media object construction
   - Supporting media normalization
   - Legacy-image → supportingMedia conversion

3. **Image handling:**
   - Image deduplication (EDIT mode specific)
   - Image array merging (existing + new + uploaded)
   - Image removal when moved to supportingMedia

4. **Masonry handling:**
   - Masonry flags (`showInMasonry`)
   - Masonry titles (`masonryTitle`)
   - Media enrichment
   - Supporting media normalization

5. **MediaIds handling:**
   - Merging existing + new mediaIds
   - Preserving existing mediaIds in EDIT mode

## Behavior Preserved

### EDIT Mode Semantics
- ✅ Payload remains incremental/partial (only changed fields)
- ✅ No create-mode defaults introduced
- ✅ Merge behavior for mediaIds + images preserved
- ✅ Legacy-image → supportingMedia handling preserved
- ✅ Masonry + enrichment behavior preserved
- ✅ Ownership + validation flow preserved

### Edge Cases Handled
- ✅ Null vs undefined semantics for media field
- ✅ Images pruned when moved to supportingMedia
- ✅ Masonry flags differences tracked
- ✅ Empty tags error detection in EDIT mode

## Testing Recommendations

### Manual Test Cases

1. **Text-only nugget edit:**
   - Edit title/content
   - Verify payload only includes changed fields

2. **Nugget with images edit:**
   - Add/remove images
   - Verify image deduplication works
   - Verify images array updates correctly

3. **Nugget with link edit:**
   - Add URL to text nugget
   - Verify media field is set
   - Verify metadata is fetched

4. **Nugget removing link:**
   - Remove URL from nugget with link
   - Verify media field is cleared (null)

5. **Masonry edit case:**
   - Toggle masonry flags
   - Change masonry titles
   - Verify supportingMedia updates correctly
   - Verify images are pruned when moved to supportingMedia

6. **No UI or payload behavior changes:**
   - Compare before/after payloads
   - Verify no unexpected fields added/removed
   - Verify no validation errors introduced

## Logging Output

### Success Case
```
[EDIT MIGRATION] Payloads match - using normalized payload
```

### Mismatch Case
```
[EDIT MIGRATION WARNING] Payload mismatch detected - using legacy payload
{
  diff: { ... },
  oldPayloadKeys: [...],
  newPayloadKeys: [...]
}
```

### Guard Logs
- Media null/undefined transitions
- Images pruned due to supportingMedia
- Masonry flag changes
- Unexpected hasEmptyTagsError in EDIT mode

## Next Steps

1. **Parity Verification:**
   - Monitor logs for mismatches
   - Verify all test cases pass
   - Ensure no behavior changes

2. **Legacy Code Removal:**
   - After verification period (recommend 1-2 weeks)
   - Remove `buildLegacyEditPayload()` function
   - Remove comparison logic
   - Use normalized payload directly

3. **Future Optimizations:**
   - Only after parity is verified
   - Can then simplify/optimize shared module
   - Can unify CREATE vs EDIT behavior differences

## Files Modified

- `src/components/CreateNuggetModal.tsx`
  - Added helper functions
  - Refactored EDIT mode submission branch
  - Added safety checks and logging

## Dependencies

- `src/shared/articleNormalization/normalizeArticleInput.ts`
  - Already exists and handles both CREATE and EDIT modes
  - No changes needed to shared module

## Notes

- Legacy logic is preserved and functional
- Comparison ensures behavior remains identical
- Logging provides visibility into migration process
- No breaking changes introduced
- Backward compatible with existing code



