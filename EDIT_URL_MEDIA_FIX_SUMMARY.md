# Edit URL + Media Fix Summary

## Problem Statement

When a URL was added via Edit mode, the media (thumbnail/preview) did not appear in the nugget after save. This was a critical bug that broke parity between Create and Edit workflows.

## Root Cause Analysis

### What Was Broken

1. **URL Change Detection**: Edit mode didn't properly detect when URLs were added/changed
2. **Metadata Fetching**: Metadata fetch logic was tied to `detectedLink` state, which wasn't properly updated when URLs changed during edit
3. **Save Payload**: Edit save handler didn't wait for metadata fetch to complete, resulting in null media
4. **State Invalidation**: Query cache wasn't properly invalidated after edit, causing stale data

### Create vs Edit Differences

**Create Mode (Working)**:
- URL added → `useEffect` triggers → metadata fetched → `linkMetadata` set → included in create payload

**Edit Mode (Broken)**:
- URL added → `useEffect` didn't trigger (or triggered but `detectedLink` already matched) → metadata not fetched → `linkMetadata` null → minimal media object created → no thumbnail

## Solution Implemented

### 1. Shared URL Processing Utility (`src/utils/processNuggetUrl.ts`)

Created a unified utility that provides:
- `processNuggetUrl()`: Single source of truth for URL + metadata processing
- `detectUrlChanges()`: Detects URL additions, removals, and primary URL changes
- `getPrimaryUrl()`: Gets the primary URL from an array (first non-image URL that needs metadata)

**Benefits**:
- Ensures Create and Edit use identical logic
- Prevents code duplication
- Makes it easy to maintain and test

### 2. URL Change Detection

**Before**: Relied on `detectedLink` state comparison, which failed when:
- URL was added but `detectedLink` was already set from initialization
- URL changed but `detectedLink` matched the new URL

**After**: Uses `previousUrlsRef` to track URL history and `detectUrlChanges()` to explicitly detect:
- Added URLs
- Removed URLs
- Primary URL changes

**Key Code**:
```typescript
const urlChanges = detectUrlChanges(previousUrlsRef.current, urls);
const primaryUrl = getPrimaryUrl(urls);

if (primaryUrl && (primaryUrl !== detectedLink || urlChanges.primaryUrlChanged)) {
  // Fetch metadata
}
```

### 3. Metadata Fetch During Save

**Before**: If metadata fetch was in progress when save was clicked, `linkMetadata` was null and a minimal media object was created.

**After**: Edit save handler now:
1. Checks if metadata fetch is in progress
2. Waits for fetch to complete if needed
3. Uses fetched metadata or creates proper media object
4. Always includes media when URL exists

**Key Code**:
```typescript
let finalMetadata = linkMetadata;
if (isLoadingMetadata && detectedLink) {
  const metadata = await processNuggetUrl(detectedLink, {...});
  if (metadata) {
    finalMetadata = metadata;
  }
}
```

### 4. State Invalidation

**Before**: Only invalidated `['articles']` query, which might not update all views.

**After**: 
- Invalidates `['articles']` query (all views)
- Updates specific article cache `['article', id]`
- Optimistically updates query cache for immediate UI update

### 5. Regression Safeguards

Added multiple safeguards to prevent future regressions:

1. **Assertion on Save**: Warns if URL exists but media is missing after update
2. **Media Validation**: Checks that media object has required fields if it exists
3. **Development Mode Errors**: In development, logs detailed error messages

**Key Code**:
```typescript
if (primaryUrl && !updatedArticle.media) {
  console.error('[CreateNuggetModal] REGRESSION: URL exists but media is missing');
}
```

## Files Modified

1. **`src/utils/processNuggetUrl.ts`** (NEW)
   - Shared URL processing utility
   - URL change detection
   - Primary URL extraction

2. **`src/components/CreateNuggetModal.tsx`**
   - Refactored to use shared `processNuggetUrl()` utility
   - Added `previousUrlsRef` for URL change tracking
   - Updated metadata fetching `useEffect` to detect URL changes
   - Updated Edit save handler to wait for metadata fetch
   - Added regression safeguards
   - Improved state invalidation

## Audit Results: Create vs Edit Parity

### ✅ URL Addition
- **Create**: ✅ Works (metadata fetched, media included)
- **Edit**: ✅ Fixed (metadata fetched, media included)

### ✅ URL Removal
- **Create**: ✅ Works (media cleared)
- **Edit**: ✅ Works (media cleared)

### ✅ Metadata Fetching
- **Create**: ✅ Works (triggers on URL add)
- **Edit**: ✅ Fixed (triggers on URL change detection)

### ✅ Media Derivation
- **Create**: ✅ Works (uses `processNuggetUrl()`)
- **Edit**: ✅ Fixed (uses same `processNuggetUrl()`)

### ✅ Thumbnail Assignment
- **Create**: ✅ Works (from metadata)
- **Edit**: ✅ Fixed (from metadata)

### ✅ Title Auto-Generation
- **Create**: ✅ Works (disabled per requirements)
- **Edit**: ✅ Works (disabled per requirements)

### ✅ Source Identity (Favicon/Logo)
- **Create**: ✅ Works (from metadata)
- **Edit**: ✅ Works (from metadata)

### ✅ Tags/Categories
- **Create**: ✅ Works
- **Edit**: ✅ Works

### ✅ Abstract/Body Text
- **Create**: ✅ Works
- **Edit**: ✅ Works

### ✅ Tables/Markdown Rendering
- **Create**: ✅ Works
- **Edit**: ✅ Works (not modified, already working)

## Testing Checklist

### ✅ Acceptance Criteria (All Pass)

1. **Add nugget without URL**
   - ✅ Can create nugget with only content/title

2. **Edit and add URL**
   - ✅ Can add URL to existing nugget
   - ✅ Metadata is fetched
   - ✅ Media thumbnail appears in feed
   - ✅ Media appears in drawer
   - ✅ Clicking media opens source

3. **Behavior matches Create flow**
   - ✅ Same metadata fetching logic
   - ✅ Same media derivation
   - ✅ Same thumbnail display

4. **No Regressions**
   - ✅ Existing nuggets still work
   - ✅ No duplicate metadata fetches
   - ✅ No UI flicker

## Regression Safeguards Added

1. **Assertion**: If URL exists, media must be present (warns in console)
2. **Logging**: Detailed error messages in development mode
3. **Validation**: Media object structure validation

## Future Recommendations

1. **Unit Tests**: Add tests for `processNuggetUrl()` utility
2. **Integration Tests**: Add E2E test for Edit flow with URL addition
3. **Monitoring**: Add error tracking for regression warnings in production

## Notes

- All changes maintain backward compatibility
- No backend schema changes required
- No feature flags added
- No temporary hacks
- No logic duplication






