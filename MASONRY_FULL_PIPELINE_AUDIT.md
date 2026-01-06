# Masonry Full Pipeline Audit - Tracing Implementation

## Objective

Audit the complete pipeline from nugget data → masonry media selection → tile mapping → rendering to identify any logic that prevents multiple media items from the same nugget from rendering as separate tiles.

## Pipeline Stages Traced

### Stage -1: ArticleGrid Receives Articles
**Location**: `src/components/ArticleGrid.tsx`
- Logs articles received from data layer
- Shows which articles have supportingMedia
- Shows how many supportingMedia items are marked for Masonry

### Stage 0: MasonryGrid Receives Articles
**Location**: `src/components/MasonryGrid.tsx`
- Logs input articles received by MasonryGrid
- Shows total article count and article IDs

### Stage 1: Media Collection
**Location**: `src/utils/masonryMediaHelper.ts` - `collectMasonryMediaItems()`

**Sub-stages:**
- **1A**: Before collection (raw article data)
- **1B**: Primary media collected
- **1C**: Supporting media collected (per item)
- **1D**: Legacy images collected (per item)

**What's logged:**
- For each candidate tile:
  - `nuggetId`: Article ID
  - `mediaId`: Media item ID (e.g., "supporting-0", "legacy-image-1")
  - `markedForMasonry`: Whether `showInMasonry === true`
  - `url`, `type`, `source`: Media details

**Potential drop points:**
- URL deduplication (if same URL exists in multiple sources)
- Missing media items (if classification fails)

### Stage 2: Masonry Selection Filtering
**Location**: `src/utils/masonryMediaHelper.ts` - `getMasonryVisibleMedia()`

**Sub-stages:**
- **2A**: Before filtering (all collected items)
- **2B**: After masonry-selection filtering

**What's logged:**
- All candidate tiles before filtering
- Which tiles survived filtering (`showInMasonry === true`)
- Which tiles were dropped and why:
  - `showInMasonry_false`: Explicitly set to false
  - `showInMasonry_undefined`: Flag not set (defaults to false)

**Potential drop points:**
- Items with `showInMasonry !== true` are filtered out
- This is the PRIMARY filtering stage

### Stage 3: Entry Generation
**Location**: `src/components/MasonryGrid.tsx` - `masonryEntries` useMemo

**What's logged:**
- Each entry created (one per visible media item)
- Duplicate entry key detection
- Final entry count per nugget
- Complete pipeline trace showing survival at each stage

**Potential drop points:**
- Duplicate entry keys (same article + mediaItemId) - currently only warns, doesn't prevent
- Entry generation loop might skip items (shouldn't happen)

### Stage 4: useMasonry Distribution
**Location**: `src/hooks/useMasonry.ts`

**Sub-stages:**
- **4A**: Input items received
- **4B**: After round-robin distribution

**What's logged:**
- Items received by useMasonry
- Distribution trace (which item goes to which column)
- Final column distribution

**Potential drop points:**
- Empty items array check (returns empty columns)
- Distribution logic (should preserve all items)

### Stage 5: After Distribution
**Location**: `src/components/MasonryGrid.tsx`

**What's logged:**
- Column count
- Entries per column
- Total entries distributed

### Stage 6: Before Render
**Location**: `src/components/MasonryGrid.tsx`

**What's logged:**
- All render entries (flattened from columns)
- React keys for each entry
- Entries grouped by nugget (shows how many tiles per nugget)

### Stage 7: MediaBlock Rendering
**Location**: `src/components/masonry/MediaBlock.tsx`

**Sub-stages:**
- **7A**: Received props (mediaItemId, visibleMediaItems)
- **7B**: After filtering by mediaItemId
- **7C**: Final items to render

**What's logged:**
- Whether requested mediaItemId matches available items
- If mediaItemId doesn't match, shows available IDs
- Final items that will actually render

## What to Look For in Console Logs

### 1. Items Dropped at Collection (Stage 1)
**Look for**: Warnings about duplicate URLs or missing items
```
[masonryMediaHelper] FULL PIPELINE AUDIT: Image URL already exists in collected items
```

### 2. Items Dropped at Filtering (Stage 2)
**Look for**: Items with `markedForMasonry: false` in droppedTiles
```
[masonryMediaHelper] FULL PIPELINE AUDIT - Stage 2B: After masonry-selection filtering
  droppedTiles: [{ markedForMasonry: false, reason: 'showInMasonry_false' }]
```

### 3. Items Dropped at Entry Generation (Stage 3)
**Look for**: Items that survived filtering but not entry generation
```
[MasonryGrid] FULL PIPELINE AUDIT - Complete Pipeline Trace
  droppedAtEntryGeneration: X
```

### 4. Items Dropped at Distribution (Stage 4)
**Look for**: Mismatch between input items and distributed items
```
[useMasonry] FULL PIPELINE AUDIT - Stage 4B: After round-robin distribution
  totalItems: X
  totalDistributed: Y (should match X)
```

### 5. Items Dropped at Render (Stage 7)
**Look for**: mediaItemId mismatches
```
[MediaBlock] FULL PIPELINE AUDIT - Stage 7C: Requested mediaItemId not found
  requestedMediaItemId: "supporting-0"
  availableMediaItemIds: ["supporting-1", "supporting-2"]
```

## Key Guardrails Checked

### ✅ No One-Tile-Per-Nugget Enforcement
- **Checked**: MasonryGrid creates one entry per media item, not per article
- **Code**: `for (const mediaItem of visibleMediaItems) { entries.push(...) }`
- **Status**: ✅ Correct - allows multiple tiles per nugget

### ✅ No Grouping/Collapsing by Nugget ID
- **Checked**: No `.groupBy()` or similar logic found
- **Status**: ✅ No grouping logic found

### ✅ No Deduplication by Nugget ID
- **Checked**: No Set/Map deduplication by article.id
- **Status**: ✅ No nugget-level deduplication found

### ✅ No Filtering by Parent Item
- **Checked**: Filtering is by `showInMasonry` flag, not by parent
- **Status**: ✅ Correct - each media item filtered independently

### ✅ React Key Uniqueness
- **Checked**: Keys include article.id, mediaItemId, entryIdx, and column length
- **Status**: ✅ Keys are unique (enhanced in previous fix)

### ✅ No Pagination/Batching Issues
- **Checked**: Articles are passed as array, no batching by nugget
- **Status**: ✅ No batching logic found

## Expected Console Output

When testing with a nugget that has 3 media items marked for Masonry:

```
[ArticleGrid] FULL PIPELINE AUDIT - Stage -1: Articles received
  articlesWithSupportingMedia: [{ id: 'xxx', supportingMediaWithMasonry: 3 }]

[MasonryGrid] FULL PIPELINE AUDIT - Stage 0: Input articles received
  totalArticles: 1

[masonryMediaHelper] FULL PIPELINE AUDIT - Stage 1C: Supporting media collected
  (3 separate logs, one per item)

[masonryMediaHelper] FULL PIPELINE AUDIT - Stage 2B: After masonry-selection filtering
  survivedFiltering: 3
  droppedByFiltering: 0

[MasonryGrid] FULL PIPELINE AUDIT - Stage 3: After entry generation
  totalEntries: 3
  entriesByNugget: [{ nuggetId: 'xxx', entryCount: 3 }]

[MasonryGrid] FULL PIPELINE AUDIT - Stage 6: Immediately before render
  totalRenderEntries: 3
  entriesByNugget: [{ nuggetId: 'xxx', renderCount: 3 }]
```

## If Items Are Missing

The trace will show exactly where items are dropped:

1. **If dropped at Stage 1**: Check URL deduplication or classification issues
2. **If dropped at Stage 2**: Check `showInMasonry` flags - items must have `showInMasonry === true`
3. **If dropped at Stage 3**: Check for duplicate entry keys or entry generation bugs
4. **If dropped at Stage 4**: Check useMasonry distribution logic
5. **If dropped at Stage 7**: Check mediaItemId matching in MediaBlock

## Files Modified

1. `src/components/ArticleGrid.tsx` - Added Stage -1 logging
2. `src/components/MasonryGrid.tsx` - Added Stages 0, 3, 5, 6, 7 logging
3. `src/utils/masonryMediaHelper.ts` - Added Stages 1A-1D, 2A-2B logging
4. `src/hooks/useMasonry.ts` - Added Stages 4A-4B logging
5. `src/components/masonry/MediaBlock.tsx` - Added Stages 7A-7C logging

## Next Steps

1. Test with a nugget that has multiple media items marked for Masonry
2. Review console logs to see the complete pipeline trace
3. Identify the exact stage where items are dropped
4. The trace will show:
   - Which items are marked for Masonry
   - Which items survive each stage
   - Which items are dropped and why
   - Final render count per nugget



