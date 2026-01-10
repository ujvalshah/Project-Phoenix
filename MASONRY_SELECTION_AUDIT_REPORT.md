# Masonry Image Selection Audit Report

## Executive Summary

**Problem**: Selecting images for "Include in Masonry View" is not working. Clicking the image toggle does nothing or does not persist the selection.

**Root Cause**: In Create mode, images are never added to `imageManager` state. The `useEffect` that builds masonry items from attachments/URLs creates a local array but never syncs it to `imageManager`. When users toggle selection, `imageManager.toggleMasonry()` is called but the images don't exist in the manager's state, so the toggle has no effect.

---

## 1. Code Locations

### 1.1 Modal Components

**CreateNuggetModal.tsx** (Lines 65-2137)
- Main modal component that handles both Create and Edit modes
- Uses `useImageManager` hook for image state management
- Renders `MasonryMediaToggle` component for selection UI

**MasonryMediaToggle.tsx** (Lines 1-192)
- UI component that displays image grid with toggle badges
- Receives `items: MasonryMediaItem[]` as props
- Calls `onToggle(itemId, !item.showInMasonry)` when badge is clicked

### 1.2 State Management

**useImageManager.ts** (Lines 1-633)
- Hook that manages canonical image state
- Maintains `state.images: ImageItem[]` as single source of truth
- Derives `masonryItems: MasonryMediaItem[]` from `state.images` via `useMemo` (lines 324-340)
- Provides `toggleMasonry(url, showInMasonry)` function (lines 518-531)

**CreateNuggetModal.tsx** (Lines 102-104)
```typescript
const existingImages = imageManager.existingImages;
const masonryMediaItems = imageManager.masonryItems; // ← Derived from imageManager.state.images
```

### 1.3 Toggle Handler

**CreateNuggetModal.tsx** (Lines 875-881)
```typescript
const handleMasonryMediaToggle = (itemId: string, showInMasonry: boolean) => {
  // Delegate to imageManager (Phase 9: Legacy code removed)
  const item = masonryMediaItems.find(m => m.id === itemId);
  if (item?.url) {
    imageManager.toggleMasonry(item.url, showInMasonry); // ← Toggles image in imageManager.state.images
  }
};
```

### 1.4 Create Mode Population Logic

**CreateNuggetModal.tsx** (Lines 993-1096)
```typescript
// Populate masonryMediaItems in Create mode from attachments and URLs
useEffect(() => {
  if (mode !== 'create') return;
  
  const items: MasonryMediaItem[] = [];
  // ... builds items array from attachments and URLs ...
  
  // Masonry items are now managed by imageManager (Phase 9: Legacy code removed)
  // The imageManager automatically derives masonryItems from existing images
  // ⚠️ BUG: items array is built but never synced to imageManager!
}, [mode, urls, attachments]);
```

### 1.5 Submission Handler

**CreateNuggetModal.tsx** (Lines 1435-1458)
- Calls `normalizeArticleInput()` with `masonryMediaItems` from `imageManager.masonryItems`
- `normalizeArticleInput.ts` (Lines 279-352, 551-620) processes `masonryMediaItems` to set `showInMasonry` flags on media objects

---

## 2. Data Flow Analysis

### 2.1 Expected Flow (Edit Mode - Working)

1. **Initialization**: `useImageManager(mode='edit', initialArticle)` → `articleToImageItems()` populates `state.images` (lines 188-270)
2. **Derivation**: `masonryItems` computed from `state.images` (lines 324-340)
3. **Display**: `MasonryMediaToggle` receives `imageManager.masonryItems`
4. **Toggle**: User clicks → `handleMasonryMediaToggle()` → `imageManager.toggleMasonry()` → Updates `state.images[].showInMasonry` → `masonryItems` recomputes → UI updates
5. **Submit**: `normalizeArticleInput()` reads `masonryMediaItems` → Sets `showInMasonry` on media objects → Saved to DB

### 2.2 Actual Flow (Create Mode - Broken)

1. **Initialization**: `useImageManager(mode='create')` → `state.images = []` (empty) (lines 301-306)
2. **Population Attempt**: `useEffect` (line 994) builds `items: MasonryMediaItem[]` from attachments/URLs
3. **Missing Sync**: `items` array is never added to `imageManager` via `addImage()` → `state.images` remains empty
4. **Derivation**: `masonryItems` computed from empty `state.images` → Returns `[]`
5. **Display**: `MasonryMediaToggle` receives empty array OR stale data
6. **Toggle**: User clicks → `handleMasonryMediaToggle()` → `imageManager.toggleMasonry(url, ...)` → Searches `state.images` for URL → **NOT FOUND** → No update occurs
7. **Submit**: `normalizeArticleInput()` receives empty or stale `masonryMediaItems` → No masonry flags set

### 2.3 State Disconnect

**The Problem**:
- `masonryMediaItems` displayed in UI comes from `imageManager.masonryItems`
- `imageManager.masonryItems` is derived from `imageManager.state.images`
- In Create mode, `state.images` is never populated
- The `useEffect` builds a local `items` array but never calls `imageManager.addImage()`
- Toggle operations fail because images don't exist in `state.images`

**Evidence**:
- Line 1094-1095 comment says "Masonry items are now managed by imageManager" but there's no code that syncs the `items` array to `imageManager`
- No calls to `imageManager.addImage()` found in CreateNuggetModal.tsx (grep returned no matches)

---

## 3. Root Cause

### 3.1 Primary Issue

**Images are never added to `imageManager` in Create mode.**

When the modal opens in Create mode:
1. `useImageManager('create')` initializes with empty `state.images = []`
2. A `useEffect` (line 994) builds `items: MasonryMediaItem[]` from `attachments` and `urls`
3. **The `items` array is discarded** - it's never synced to `imageManager` via `addImage()`
4. `masonryMediaItems = imageManager.masonryItems` returns `[]` because `state.images` is empty
5. When user toggles, `imageManager.toggleMasonry(url, ...)` searches `state.images` for the URL
6. **URL not found** → No update occurs → Toggle appears to do nothing

### 3.2 Secondary Issues

1. **ID Mismatch Risk**: `handleMasonryMediaToggle` uses `item.id` to find item, then passes `item.url` to `toggleMasonry()`. If the URL isn't in `state.images`, the lookup fails.

2. **Stale State**: If `masonryMediaItems` somehow gets populated (possibly from a previous render), toggles still fail because the underlying `state.images` is empty.

3. **Edit Mode Works**: Edit mode works because `useImageManager('edit', initialArticle)` calls `articleToImageItems()` which populates `state.images` from the article data.

---

## 4. Fix Plan

### 4.1 Immediate Fix (Minimal Change)

**Goal**: Sync images from attachments/URLs to `imageManager` in Create mode.

**Changes Required**:

1. **Modify the useEffect (lines 993-1096)** to call `imageManager.addImage()` for each item:

```typescript
useEffect(() => {
  if (mode !== 'create') return;
  
  // Clear existing images first (reset on attachments/URLs change)
  imageManager.clearAll();
  
  // Determine primary media
  const primaryUrl = getPrimaryUrl(urls) || imageAttachments[0]?.secureUrl || null;
  
  // Add primary media
  if (primaryUrl) {
    imageManager.addImage(primaryUrl, 'primary', {
      showInMasonry: true, // Selected by default
      type: detectProviderFromUrl(primaryUrl) as MediaType,
    });
  }
  
  // Add supporting image URLs
  imageUrls.forEach(url => {
    if (url !== primaryUrl) {
      imageManager.addImage(url, 'url-input', {
        showInMasonry: false,
        type: 'image',
      });
    }
  });
  
  // Add supporting non-image URLs
  nonImageUrls.forEach(url => {
    if (url !== primaryUrl) {
      imageManager.addImage(url, 'url-input', {
        showInMasonry: false,
        type: detectProviderFromUrl(url) as MediaType,
      });
    }
  });
  
  // Add image attachments
  imageAttachments.forEach(att => {
    const url = att.secureUrl || att.previewUrl;
    if (url && url !== primaryUrl) {
      imageManager.addImage(url, 'upload', {
        showInMasonry: false,
        type: 'image',
        mediaId: att.mediaId,
      });
    }
  });
}, [mode, urls, attachments, imageManager]);
```

**Dependencies**: Add `imageManager` to dependency array (safe because it's from a hook).

2. **Handle attachment upload completion**: When `att.secureUrl` becomes available after upload, trigger re-sync:

```typescript
// In handleFileUpload, after attachment.secureUrl is set:
useEffect(() => {
  if (mode === 'create' && attachments.some(att => att.secureUrl)) {
    // Trigger re-sync by updating a dependency
    // The useEffect above will re-run and add new images
  }
}, [attachments, mode]);
```

**Alternative**: Call `imageManager.addImage()` directly in `handleFileUpload` after `attachment.secureUrl` is set (line 839).

### 4.2 Validation

**Test Cases**:
1. ✅ Create mode: Add image attachment → Appears in masonry toggle → Toggle works → Selection persists
2. ✅ Create mode: Add image URL → Appears in masonry toggle → Toggle works → Selection persists
3. ✅ Create mode: Add multiple images → All appear → Toggle each independently → Selections persist
4. ✅ Create mode: Remove attachment → Disappears from masonry toggle
5. ✅ Edit mode: Existing behavior unchanged (already works)
6. ✅ Submit: Selected images have `showInMasonry: true` in saved article

### 4.3 Edge Cases

1. **Duplicate URLs**: `imageManager.addImage()` already handles duplicates (lines 374-383)
2. **URL Normalization**: `imageManager` uses `normalizeImageUrl()` for comparison (line 371)
3. **Attachment Upload Delay**: Need to handle case where `secureUrl` is set after initial render
4. **Primary Media Change**: If primary URL changes, need to update `showInMasonry` for old vs new primary

---

## 5. Safer Architecture Recommendation

### 5.1 Current Architecture Issues

1. **Dual State**: `masonryMediaItems` is derived from `imageManager.masonryItems`, but in Create mode, images aren't in `imageManager`
2. **Manual Sync Required**: Developer must remember to call `addImage()` when images are added
3. **No Single Source of Truth**: `attachments` and `urls` arrays exist separately from `imageManager.state.images`

### 5.2 Recommended Architecture

**Single Source of Truth Pattern**:

1. **`imageManager` owns all image state**:
   - All images (from URLs, attachments, existing) live in `imageManager.state.images`
   - `masonryMediaItems` is always derived from `imageManager.masonryItems`
   - No separate `attachments` array for images (only for documents)

2. **Automatic Sync**:
   - When `urls` change → Sync to `imageManager` automatically
   - When `attachments` change → Sync to `imageManager` automatically
   - Use `useEffect` with proper dependencies

3. **Pure Toggle Function**:
   ```typescript
   const toggleMasonryImage = useCallback((url: string) => {
     const image = imageManager.allImages.find(img => 
       normalizeImageUrl(img.url) === normalizeImageUrl(url)
     );
     if (image) {
       imageManager.toggleMasonry(url, !image.showInMasonry);
     }
   }, [imageManager]);
   ```

4. **Unit Test Coverage**:
   ```typescript
   describe('Masonry Image Selection', () => {
     it('should add images to imageManager in create mode', () => {
       // Test that useEffect syncs attachments/URLs to imageManager
     });
     
     it('should toggle showInMasonry flag', () => {
       // Test toggleMasonry updates state correctly
     });
     
     it('should persist selection on submit', () => {
       // Test normalizeArticleInput receives correct masonryMediaItems
     });
   });
   ```

### 5.3 Migration Path

**Phase 1**: Fix immediate bug (Section 4.1)
**Phase 2**: Refactor to single source of truth
- Move image attachment handling into `imageManager`
- Remove manual sync logic
- Add comprehensive tests

---

## 6. Summary

**Root Cause**: Images are never added to `imageManager` in Create mode. The `useEffect` that builds masonry items creates a local array but never syncs it to `imageManager`, so toggles fail because images don't exist in the manager's state.

**Fix**: Sync images from `attachments` and `urls` to `imageManager` via `addImage()` calls in the `useEffect`.

**Files to Modify**:
- `src/components/CreateNuggetModal.tsx` (lines 993-1096)

**Testing**: Verify toggle works in Create mode, selections persist, and submit includes correct `showInMasonry` flags.


