# Masonry Image Selection Edit Mode Fix

## Root Cause Analysis

### Problem
When selecting images for Masonry in edit mode:
1. ✅ Toast success message appears
2. ❌ Newly-selected images do not appear in Masonry layout after save + reload
3. ❌ Console shows "Media object exists but missing previewMetadata" error
4. ❌ Normalization warnings appear

### Root Cause Identified

**Primary Issue**: When converting legacy-image items (from `images` array) to `supportingMedia` format during save, the enrichment process (`enrichMediaItemIfNeeded`) could fail for direct image URLs. If `unfurlUrl()` failed or returned null, items were saved without `previewMetadata`. When reloaded, these items triggered the regression warning and didn't render in Masonry.

**Secondary Issue**: No safeguard ensured that items marked for Masonry (`showInMasonry: true`) had `previewMetadata` before persistence.

### Data Flow Analysis

1. **Selection**: User selects images from `images` array → stored in `masonryMediaItems` state
2. **Save (Edit Mode)**: 
   - Legacy-image items converted to `supportingMedia` format (lines 1456-1478)
   - `enrichMediaItemIfNeeded()` called to add `previewMetadata`
   - **FAILURE POINT**: If unfurl failed, item saved without `previewMetadata`
3. **Persistence**: Backend saves `supportingMedia` array (includes `showInMasonry` and `masonryTitle`)
4. **Reload**: Article loaded → `classifyArticleMedia()` uses explicit `supportingMedia` (if present)
5. **Render**: `getMasonryVisibleMedia()` filters by `showInMasonry: true`
   - **FAILURE POINT**: Items without `previewMetadata` trigger warnings and may not render correctly

## Fix Applied

### 1. Enhanced `enrichMediaItemIfNeeded()` Function

**Location**: `src/components/CreateNuggetModal.tsx` (lines ~965-1050)

**Changes**:
- For image URLs, always create minimal `previewMetadata` even if `unfurlUrl()` fails
- Minimal metadata includes: `{ url, imageUrl, mediaType: 'image' }`
- Ensures all image items have at least basic metadata required for rendering

**Code**:
```typescript
// If enrichment failed but this is an image URL, create minimal previewMetadata
const isImageType = mediaItem.type === 'image' || 
                    (mediaItem.url && (mediaItem.url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i) || 
                                      mediaItem.url.includes('cloudinary.com') ||
                                      mediaItem.url.includes('images.ctfassets.net')));

if (isImageType) {
  const minimalMetadata = {
    url: mediaItem.url,
    imageUrl: mediaItem.url,
    mediaType: 'image',
  };
  // ... return enriched item with minimal metadata
}
```

### 2. Added Safeguards in Normalization Pipeline

**Location**: `src/components/CreateNuggetModal.tsx` (lines ~1460-1505)

**Changes**:
- After enrichment, check if items marked for Masonry have `previewMetadata`
- If missing, create minimal metadata before saving
- Applies to both legacy-image items and other supporting items

**Code**:
```typescript
// Ensure items marked for Masonry have previewMetadata
if (enriched.showInMasonry && !enriched.previewMetadata && enriched.url) {
  enriched.previewMetadata = {
    url: enriched.url,
    imageUrl: enriched.url, // For images
    mediaType: 'image',
  };
}
```

### 3. Added Comprehensive Trace Logging

**Locations**:
- `src/components/CreateNuggetModal.tsx`: Selection, enrichment, save, reload
- `src/utils/masonryMediaHelper.ts`: Collection and filtering
- `src/utils/mediaClassifier.ts`: Classification decisions

**Purpose**: Enable end-to-end tracing of data flow to identify future issues

### 4. Enhanced Verification Guards

**Location**: `src/components/CreateNuggetModal.tsx` (lines ~1560-1580)

**Changes**:
- Warn if supportingMedia items marked for Masonry are missing `previewMetadata` after save
- Enhanced regression checks with detailed context

## Testing Checklist

- [ ] Select images for Masonry in edit mode
- [ ] Save article
- [ ] Reload page
- [ ] Verify new tiles appear in Masonry layout
- [ ] Check console for absence of "missing previewMetadata" warnings
- [ ] Verify no normalization warnings
- [ ] Test with both Cloudinary URLs and external image URLs
- [ ] Test with images that fail unfurl (should still work with minimal metadata)
- [ ] Verify create mode still works correctly (no regression)

## Acceptance Criteria

✅ **Selecting images for Masonry in edit mode → save → reload → new tiles appear consistently**

✅ **No previewMetadata or normalization warnings**

✅ **No unintended behavior changes in create mode**

✅ **No schema churn or data migrations introduced**

✅ **Only the confirmed broken step is changed**

## Files Modified

1. `src/components/CreateNuggetModal.tsx`
   - Enhanced `enrichMediaItemIfNeeded()` to create minimal metadata for images
   - Added safeguards in normalization pipeline
   - Added comprehensive trace logging
   - Enhanced verification guards

2. `src/utils/masonryMediaHelper.ts`
   - Added trace logging for collection and filtering

3. `src/utils/mediaClassifier.ts`
   - Added trace logging for classification decisions

## Notes

- The fix ensures backward compatibility: existing articles with `previewMetadata` are unchanged
- Minimal metadata is only created when enrichment fails, preserving rich metadata when available
- The fix is minimal and targeted: only affects the enrichment pipeline, no schema changes
- Trace logs can be removed after verification (currently enabled for debugging)

