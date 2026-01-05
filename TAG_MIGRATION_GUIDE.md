# Tag Migration Guide - Phase 1 Implementation

**Date**: 2025-01-06  
**Status**: ✅ **PHASE 1 COMPLETE**

---

## Overview

This migration moves from string-based `tags[]` arrays to relational `tagIds[]` ObjectId references. This enables:
- **Instant tag renames** (no article updates needed)
- **Better data consistency** (single source of truth)
- **Improved query performance** (indexed ObjectId lookups)
- **Tag merging and aliasing** support

---

## Implementation Summary

### ✅ Phase 1 Complete

1. **Tag Model Enhanced**
   - Added `aliases` field for tag variations
   - Added `canonicalize()` helper function
   - Added `Tag.fromName()` static method
   - Kept all existing fields (`type`, `isOfficial`, `status`)

2. **Article Model Updated**
   - Added `tagIds: ObjectId[]` field
   - Added indexes: `{ tagIds: 1 }` and `{ tagIds: 1, publishedAt: -1 }`
   - Kept `tags: string[]` for backward compatibility

3. **Dual-Write Implementation**
   - Article create/update now populates both `tags[]` and `tagIds[]`
   - Transaction-safe updates
   - Feature flags for gradual rollout

4. **Query Filtering**
   - Supports both `tagIds` (new) and `tags[]` (legacy) filtering
   - Automatic tag name → tagId resolution

5. **API Responses**
   - Include both `tags` and `tagIds` in responses
   - Backward compatible

6. **Migration Scripts**
   - `backfillArticleTagIds.ts` - Batch backfill existing articles
   - `validateTagMigration.ts` - Data consistency validation
   - `repairTagDualWrite.ts` - Fix inconsistencies

7. **Utilities**
   - `tagHelpers.ts` - Tag resolution and dual-write helpers
   - `tagMigrationMetrics.ts` - Migration progress tracking

---

## Feature Flags

Control migration rollout with environment variables:

```bash
# Enable tagIds operations (default: true)
ENABLE_TAG_IDS=true

# Enable tagIds for read operations (default: true if ENABLE_TAG_IDS=true)
ENABLE_TAG_IDS_READ=true

# Enable tagIds for write operations (default: true if ENABLE_TAG_IDS=true)
ENABLE_TAG_IDS_WRITE=true

# Disable legacy tags[] (Phase 3 only - default: false)
DISABLE_LEGACY_TAGS=false
```

---

## Migration Steps

### Step 1: Run Backfill Script

Populate `tagIds[]` for all existing articles:

```bash
npx tsx server/src/scripts/backfillArticleTagIds.ts
```

**Expected Output:**
```
[BackfillTagIds] Starting tagIds backfill...
[BackfillTagIds] Connected to database
[BackfillTagIds] Found 150 articles with tags
[BackfillTagIds] Found 45 unique tag names
[BackfillTagIds] Tags resolved: 40 found, 5 created
[BackfillTagIds] Progress: 150/150 articles processed (150 updated, 0 errors)
[BackfillTagIds] Backfill complete!
```

### Step 2: Validate Migration

Check data consistency:

```bash
npx tsx server/src/scripts/validateTagMigration.ts
```

**Expected Output:**
```
[ValidateTagMigration] Validation complete!
Summary:
  Articles checked: 150
  Issues found: 0
```

### Step 3: Monitor Metrics

Check migration progress via API (if admin endpoint added):

```bash
GET /api/admin/tag-migration-status
```

Or use the utility directly:

```typescript
import { getMigrationMetrics } from './utils/tagMigrationMetrics';
const metrics = await getMigrationMetrics();
console.log(`Completion: ${metrics.completionPercentage}%`);
```

### Step 4: Repair Inconsistencies (if needed)

If validation finds issues:

```bash
npx tsx server/src/scripts/repairTagDualWrite.ts
```

---

## API Changes

### New Endpoints

**POST `/api/tags/resolve`**
Resolve tagIds to tag names (for frontend use).

**Request:**
```json
{
  "tagIds": ["507f1f77bcf86cd799439011", "507f191e810c19729de860ea"]
}
```

**Response:**
```json
{
  "tags": [
    { "id": "507f1f77bcf86cd799439011", "rawName": "Technology" },
    { "id": "507f191e810c19729de860ea", "rawName": "AI" }
  ]
}
```

### Updated Responses

Article responses now include both fields:

```json
{
  "id": "...",
  "title": "...",
  "tags": ["Technology", "AI"],  // Legacy
  "tagIds": ["507f1f77bcf86cd799439011", "507f191e810c19729de860ea"]  // New
}
```

---

## Query Filtering

Tag filtering now supports both methods:

**Query:**
```
GET /api/articles?tags=Technology&tags=AI
```

**Backend Behavior:**
1. Resolves tag names to Tag documents
2. Queries by `tagIds` (if enabled) OR `tags[]` (legacy)
3. Returns matching articles

---

## Benefits Achieved

### ✅ Immediate Benefits (Phase 1)

1. **Data Consistency**
   - All tags exist in Tag collection
   - No orphaned tag strings
   - Case-insensitive duplicate detection

2. **Performance**
   - Indexed ObjectId lookups
   - Compound indexes for tag-filtered queries
   - Batch processing in scripts

3. **Observability**
   - Migration metrics
   - Validation scripts
   - Repair utilities

### 🎯 Future Benefits (Phase 2-3)

1. **Tag Rename Performance**
   - Phase 1-2: Updates both Tag document AND all articles
   - Phase 3: Updates only Tag document (instant!)

2. **Tag Merging**
   - Reassign `tagIds` in articles
   - No string replacement needed

3. **Tag Aliasing**
   - Support multiple names for same tag
   - Better search/discovery

---

## Rollback Plan

If issues arise, rollback is safe:

1. **Disable tagIds writes:**
   ```bash
   ENABLE_TAG_IDS_WRITE=false
   ```

2. **Disable tagIds reads:**
   ```bash
   ENABLE_TAG_IDS_READ=false
   ```

3. **System continues using `tags[]` only**

4. **No data loss** - `tags[]` field remains intact

---

## Testing Checklist

- [x] Tag model updated with aliases and canonicalize
- [x] Article model has tagIds field
- [x] Dual-write in createArticle
- [x] Dual-write in updateArticle
- [x] Query filtering supports both methods
- [x] API responses include both fields
- [x] Backfill script works
- [x] Validation script works
- [x] Repair script works
- [ ] Integration tests (recommended)
- [ ] Load testing (recommended)

---

## Next Steps (Phase 2)

1. **Frontend Migration**
   - Update to use `tagIds` for reads
   - Use `/api/tags/resolve` endpoint
   - Keep `tags[]` for display (backward compat)

2. **Performance Optimization**
   - Cache tag resolution
   - Batch tag lookups
   - Optimize queries

3. **Monitoring**
   - Track migration metrics
   - Monitor query performance
   - Alert on inconsistencies

---

## Files Modified

### Models
- `server/src/models/Tag.ts` - Added aliases, canonicalize, fromName
- `server/src/models/Article.ts` - Added tagIds field and indexes

### Controllers
- `server/src/controllers/articlesController.ts` - Dual-write logic
- `server/src/controllers/tagsController.ts` - Resolve endpoint

### Utilities
- `server/src/utils/tagHelpers.ts` - Tag resolution helpers
- `server/src/utils/tagMigrationMetrics.ts` - Migration metrics
- `server/src/utils/db.ts` - Updated transformArticle

### Scripts
- `server/src/scripts/backfillArticleTagIds.ts` - Backfill script
- `server/src/scripts/validateTagMigration.ts` - Validation script
- `server/src/scripts/repairTagDualWrite.ts` - Repair script

### Routes
- `server/src/routes/tags.ts` - Added resolve endpoint

---

## Support

For issues or questions:
1. Run validation script to check data consistency
2. Check migration metrics for progress
3. Review logs for errors
4. Use repair script if needed

---

**Status**: ✅ **READY FOR PRODUCTION** (Phase 1)

