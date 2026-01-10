# Masonry Image Selection - Audit Findings

## Findings → Root Cause → Fix Plan → Architecture Recommendation

---

## 🔍 FINDINGS

### Code Locations

1. **Modal Component**: `src/components/CreateNuggetModal.tsx` (2,137 lines)
   - Line 72: `const imageManager = useImageManager(mode, initialData)`
   - Line 104: `const masonryMediaItems = imageManager.masonryItems`
   - Line 875-881: `handleMasonryMediaToggle()` handler
   - Line 993-1096: `useEffect` that builds masonry items in Create mode
   - Line 1964-1972: `MasonryMediaToggle` component rendering

2. **State Management**: `src/hooks/useImageManager.ts` (633 lines)
   - Line 324-340: `masonryItems` derived from `state.images` via `useMemo`
   - Line 518-531: `toggleMasonry(url, showInMasonry)` function
   - Line 301-306: Create mode initializes with empty `state.images = []`

3. **UI Component**: `src/components/CreateNuggetModal/MasonryMediaToggle.tsx` (192 lines)
   - Line 114-140: Toggle button that calls `onToggle(item.id, !item.showInMasonry)`

4. **Submission**: `src/shared/articleNormalization/normalizeArticleInput.ts`
   - Lines 279-352: Processes `masonryMediaItems` to set `showInMasonry` flags
   - Lines 551-620: Builds `supportingMedia` from selected masonry items

### Data Flow

**Edit Mode (Working)**:
```
initialData → useImageManager('edit', article) → articleToImageItems() 
→ state.images populated → masonryItems derived → UI displays 
→ toggle → imageManager.toggleMasonry() → state.images updated 
→ masonryItems recomputes → UI updates → submit → normalizeArticleInput() 
→ showInMasonry flags set → saved to DB
```

**Create Mode (Broken)**:
```
useImageManager('create') → state.images = [] (empty)
→ useEffect builds items array from attachments/URLs
→ items array discarded (never synced to imageManager)
→ masonryItems = [] (derived from empty state.images)
→ UI shows empty or stale data
→ toggle → imageManager.toggleMasonry(url) → URL not found in state.images 
→ No update → Toggle appears to do nothing
```

---

## 🎯 ROOT CAUSE

### Primary Issue

**Images are never added to `imageManager` in Create mode.**

**Evidence**:
1. `useImageManager('create')` initializes with `state.images = []` (line 301-306 in useImageManager.ts)
2. The `useEffect` (line 994 in CreateNuggetModal.tsx) builds a local `items: MasonryMediaItem[]` array from `attachments` and `urls`
3. **The `items` array is never synced to `imageManager`** - there's a comment (line 1094-1095) saying "Masonry items are now managed by imageManager" but no actual sync code
4. `masonryMediaItems = imageManager.masonryItems` returns `[]` because `state.images` is empty
5. When user clicks toggle, `handleMasonryMediaToggle()` calls `imageManager.toggleMasonry(item.url, ...)`
6. `toggleMasonry()` searches `state.images` for the URL (line 523-527)
7. **URL not found** → No update occurs → Toggle has no effect

### Why Edit Mode Works

Edit mode works because:
- `useImageManager('edit', initialArticle)` calls `articleToImageItems(initialArticle)` (line 292-298)
- This populates `state.images` from the article's media data
- Toggles work because images exist in `state.images`

### Why Create Mode Fails

Create mode fails because:
- `useImageManager('create')` initializes with empty `state.images = []`
- Images from `attachments` and `urls` are never added via `imageManager.addImage()`
- No calls to `imageManager.addImage()` found in CreateNuggetModal.tsx (grep returned zero matches)
- Toggles fail because images don't exist in the manager's state

---

## 🔧 FIX PLAN

### Step 1: Sync Images to imageManager in Create Mode

**File**: `src/components/CreateNuggetModal.tsx`  
**Location**: Lines 993-1096 (the useEffect)

**Change**: Replace the useEffect to call `imageManager.addImage()` for each item:

```typescript
useEffect(() => {
  if (mode !== 'create') return;
  
  // Clear existing images first (reset when attachments/URLs change)
  imageManager.clearAll();
  
  // Separate image URLs from non-image URLs
  const imageUrls: string[] = [];
  const nonImageUrls: string[] = [];
  for (const url of urls) {
    const urlType = detectProviderFromUrl(url);
    if (urlType === 'image') {
      imageUrls.push(url);
    } else {
      nonImageUrls.push(url);
    }
  }
  
  // Collect image attachments
  const imageAttachments = attachments.filter(att => att.type === 'image' && att.secureUrl);
  
  // Determine primary media
  const primaryUrlFromUrls = getPrimaryUrl(urls);
  const primaryUrl = primaryUrlFromUrls || imageAttachments[0]?.secureUrl || null;
  const primaryUrlType = primaryUrl ? detectProviderFromUrl(primaryUrl) : null;
  
  // Add primary media
  if (primaryUrl) {
    imageManager.addImage(primaryUrl, 'primary', {
      showInMasonry: true, // Selected by default
      type: (primaryUrlType || 'image') as MediaType,
    });
  }
  
  // Add supporting image URLs
  imageUrls.forEach((url) => {
    if (url !== primaryUrl) {
      imageManager.addImage(url, 'url-input', {
        showInMasonry: false,
        type: 'image',
      });
    }
  });
  
  // Add supporting non-image URLs
  nonImageUrls.forEach((url) => {
    if (url !== primaryUrl) {
      const urlType = detectProviderFromUrl(url);
      imageManager.addImage(url, 'url-input', {
        showInMasonry: false,
        type: urlType as MediaType,
      });
    }
  });
  
  // Add image attachments
  imageAttachments.forEach((att) => {
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

**Key Changes**:
1. Call `imageManager.clearAll()` at start to reset state
2. Call `imageManager.addImage()` for each image (primary, URLs, attachments)
3. Add `imageManager` to dependency array (safe - it's from a hook)

### Step 2: Handle Attachment Upload Completion

**File**: `src/components/CreateNuggetModal.tsx`  
**Location**: Lines 833-850 (in `handleFileUpload`)

**Change**: After `attachment.secureUrl` is set, the useEffect above will automatically re-run and add the image. No additional code needed (the dependency on `attachments` handles this).

**Alternative**: If uploads are slow, could call `imageManager.addImage()` directly after `attachment.secureUrl` is set (line 839), but the useEffect approach is cleaner.

### Step 3: Remove Dead Code

**File**: `src/components/CreateNuggetModal.tsx`  
**Location**: Lines 998-1092

**Change**: Remove the local `items: MasonryMediaItem[]` array building logic - it's no longer needed since `imageManager` handles this.

### Testing Checklist

- [ ] Create mode: Add image attachment → Appears in masonry toggle
- [ ] Create mode: Toggle image selection → Selection persists (checkmark appears/disappears)
- [ ] Create mode: Add image URL → Appears in masonry toggle
- [ ] Create mode: Toggle URL image → Selection persists
- [ ] Create mode: Add multiple images → All appear → Toggle each independently
- [ ] Create mode: Remove attachment → Disappears from masonry toggle
- [ ] Create mode: Submit → Selected images have `showInMasonry: true` in saved article
- [ ] Edit mode: Existing behavior unchanged (regression test)

---

## 🏗️ SAFER ARCHITECTURE RECOMMENDATION

### Current Problems

1. **Dual State**: `masonryMediaItems` derived from `imageManager.masonryItems`, but images aren't always in `imageManager`
2. **Manual Sync**: Developer must remember to call `addImage()` when images are added
3. **Fragmented State**: `attachments`, `urls`, and `imageManager.state.images` exist separately

### Recommended Architecture

**Single Source of Truth**:

1. **`imageManager` owns all image state**:
   - All images (URLs, attachments, existing) live in `imageManager.state.images`
   - `masonryMediaItems` always derived from `imageManager.masonryItems`
   - No separate arrays for images

2. **Automatic Sync via useEffect**:
   ```typescript
   // Sync attachments/URLs to imageManager automatically
   useEffect(() => {
     if (mode === 'create') {
       // Clear and rebuild from current attachments/URLs
       imageManager.clearAll();
       // ... add all images ...
     }
   }, [mode, urls, attachments, imageManager]);
   ```

3. **Pure Toggle Function**:
   ```typescript
   const toggleMasonryImage = useCallback((url: string) => {
     const normalizedUrl = normalizeImageUrl(url);
     const image = imageManager.allImages.find(img => 
       normalizeImageUrl(img.url) === normalizedUrl
     );
     if (image) {
       imageManager.toggleMasonry(url, !image.showInMasonry);
     } else {
       console.warn('[MasonryToggle] Image not found in imageManager:', url);
     }
   }, [imageManager]);
   ```

4. **Unit Test Coverage**:
   ```typescript
   describe('Masonry Image Selection', () => {
     it('should sync attachments/URLs to imageManager in create mode', () => {
       // Test useEffect adds images correctly
     });
     
     it('should toggle showInMasonry flag', () => {
       // Test toggleMasonry updates state
     });
     
     it('should persist selection on submit', () => {
       // Test normalizeArticleInput receives correct data
     });
     
     it('should handle attachment upload completion', () => {
       // Test secureUrl update triggers re-sync
     });
   });
   ```

### Migration Path

**Phase 1** (Immediate): Fix bug with Step 1-3 above  
**Phase 2** (Future): Refactor to eliminate `attachments` array for images, use `imageManager` as single source

---

## 📋 SUMMARY

**Root Cause**: Images are never added to `imageManager` in Create mode. The `useEffect` builds a local array but never syncs it, so toggles fail because images don't exist in the manager's state.

**Fix**: Sync images from `attachments` and `urls` to `imageManager` via `addImage()` calls in the `useEffect`.

**Files to Modify**: 
- `src/components/CreateNuggetModal.tsx` (lines 993-1096)

**Risk Level**: Low - Fix is isolated to Create mode, Edit mode unchanged

**Testing**: Verify toggle works, selections persist, submit includes correct flags


