# Phase 2 Implementation - Testing Plan

## Summary

Phase 2 adds **stable Tag ID references** to eliminate all case-sensitivity issues. This document outlines what was implemented and how to test it.

---

## What Was Implemented

### Backend Changes ✅

1. **Article Schema** - Added `categoryIds` field
   - File: `server/src/models/Article.ts`
   - Field stores array of Tag ObjectIds for stable matching
   
2. **Tags API** - Added `format=full` parameter  
   - File: `server/src/controllers/tagsController.ts`
   - Returns full tag objects with `id`, `rawName`, `canonicalName`
   
3. **Article Controller** - Auto-resolves categoryIds
   - File: `server/src/controllers/articlesController.ts`
   - `resolveCategoryIds()` helper maps category names to Tag IDs
   - Automatically populates `categoryIds` on create/update
   
4. **Migration Script** - Backfills existing articles
   - File: `server/src/scripts/backfillCategoryIds.ts`
   - Updates all existing articles with categoryIds

### Frontend Changes ✅

1. **Type Definitions** - Added Tag interface and categoryIds
   - File: `src/types/index.ts`
   - `Tag` interface with id, rawName, canonicalName
   - `Article.categoryIds` field added
   
2. **RestAdapter** - Added getCategoriesWithIds() method
   - File: `src/services/adapters/RestAdapter.ts`
   - New method returns full Tag objects
   - Updated create/update to include categoryIds

### What Remains (Optional Enhancement)

The following changes would fully utilize Tag IDs in the UI, but Phase 1 fixes already handle the main issues:

- **TagSelector component** - Use Tag objects instead of strings
- **CreateNuggetModal** - Store selected tag IDs
- **Tag comparison logic** - Match by ID instead of name

These can be implemented incrementally without breaking existing functionality.

---

## Testing Phase 2

### Test 1: Verify Backend Tag API

**Goal:** Confirm backend returns full tag objects

**Steps:**
```bash
# Terminal 1: Start backend
cd "c:\Users\ujval\OneDrive\Desktop\Project Gold\Project Nuggets"
npm run dev:server

# Terminal 2: Test API
curl "http://localhost:3000/api/categories?format=full" | json_pp
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "rawName": "AI",
      "canonicalName": "ai",
      "usageCount": 5,
      "type": "category",
      "status": "active",
      "isOfficial": true
    },
    ...
  ],
  "total": 10,
  "page": 1,
  "limit": 500,
  "hasMore": false
}
```

---

### Test 2: Verify Article Creation with CategoryIds

**Goal:** Confirm new articles get categoryIds automatically

**Steps:**
1. Create a new nugget via frontend with tags ["AI", "Blockchain"]
2. Check MongoDB document:
```javascript
db.articles.findOne({}, { categories: 1, categoryIds: 1 }).pretty()
```

**Expected:**
```javascript
{
  "_id": ObjectId("..."),
  "categories": ["AI", "Blockchain"],  // Display names
  "categoryIds": [                      // Tag ObjectIds
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012"
  ]
}
```

---

### Test 3: Run Migration Script

**Goal:** Backfill categoryIds for existing articles

**Steps:**
```bash
cd "c:\Users\ujval\OneDrive\Desktop\Project Gold\Project Nuggets"
npm run migrate-categoryids
```

**Expected Output:**
```
[Migration] Starting categoryIds backfill...
[Migration] Connected to database
[Migration] Found 150 articles needing categoryIds
[Migration] Loaded 25 tags into memory
[Migration] Progress: 100/150 articles updated...
[Migration] Progress: 150/150 articles updated...

[Migration] Backfill complete!

Summary:
  Articles updated: 148
  Articles skipped: 2
  Errors: 0

[Migration] Done!
```

---

### Test 4: Verify CategoryIds After Migration

**Goal:** Confirm migration worked correctly

**Steps:**
```javascript
// In MongoDB shell or Compass
// Check sample articles
db.articles.find({ categoryIds: { $exists: true, $ne: [] } }).limit(5).pretty()

// Count articles with categoryIds
db.articles.countDocuments({ categoryIds: { $exists: true, $ne: [] } })

// Check for articles missing categoryIds (should be 0)
db.articles.countDocuments({ 
  categories: { $exists: true, $ne: [] },
  $or: [
    { categoryIds: { $exists: false } },
    { categoryIds: { $size: 0 } }
  ]
})
```

**Expected:**
- All articles with categories should have matching categoryIds
- Count should match total articles with categories
- Missing categoryIds count should be 0

---

### Test 5: Verify Tag ID Stability on Rename

**Goal:** Confirm categoryIds don't change when tag renamed

**Steps:**
1. Find an article with a specific tag:
```javascript
const article = db.articles.findOne({ categories: "AI" })
console.log("Before:", article.categoryIds)
```

2. Rename the tag via Admin Panel: "AI" → "Artificial Intelligence"

3. Check article again:
```javascript
const updated = db.articles.findOne({ _id: article._id })
console.log("After categories:", updated.categories)  // ["Artificial Intelligence"]
console.log("After categoryIds:", updated.categoryIds)  // Same IDs!
```

**Expected:**
- `categories` array updates to new name
- `categoryIds` array **remains unchanged** (stable reference)

---

### Test 6: Integration Test

**Goal:** End-to-end flow with Phase 1 + Phase 2

**Steps:**
1. Create nugget with tag "AI"
2. Admin renames "AI" → "Ai"  
3. Edit same nugget
4. Verify tag appears selected

**Expected:**
- **Phase 1 fix:** UI matches tags case-insensitively (normalize("AI") === normalize("Ai"))
- **Phase 2 enhancement:** Backend uses stable IDs, so even if Phase 1 didn't exist, matching would work via IDs

---

## Performance Testing

### Test 7: Query Performance with CategoryIds

**Goal:** Verify categoryIds don't slow down queries

**Steps:**
```javascript
// Test query by categories (string matching)
db.articles.find({ categories: { $in: ["AI", "Blockchain"] } }).explain("executionStats")

// Test query by categoryIds (ObjectId matching)
const tagIds = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
db.articles.find({ categoryIds: { $in: tagIds } }).explain("executionStats")
```

**Expected:**
- Both queries should use index
- CategoryIds query may be slightly faster (ObjectId comparison vs string)
- No significant performance degradation

---

## Regression Testing

### Test 8: Verify Phase 1 Still Works

**Goal:** Ensure Phase 2 doesn't break Phase 1 fixes

**Steps:**
1. Run Phase 1 unit tests:
```bash
npx vitest run tagUtils
```

2. Manual tests from Phase 1 testing guide:
   - Edit modal shows correct selection ✅
   - Tag deselection works ✅
   - Duplicate prevention ✅

**Expected:**
- All 29 Phase 1 tests passing
- No regressions in edit modal behavior

---

## Troubleshooting

### Issue: Migration finds 0 articles

**Cause:** All articles already have categoryIds

**Solution:** This is expected after first run. Migration is idempotent.

---

### Issue: Missing tags warning during migration

**Cause:** Articles reference tags that don't exist in Tags collection

**Solution:**
1. Check which tags are missing:
```javascript
db.articles.distinct("categories").forEach(cat => {
  const tag = db.tags.findOne({ canonicalName: cat.toLowerCase() })
  if (!tag) console.log("Missing:", cat)
})
```

2. Create missing tags via Admin Panel or:
```javascript
db.tags.insertOne({
  rawName: "MissingTag",
  canonicalName: "missingtag",
  type: "category",
  status: "active",
  isOfficial: false,
  usageCount: 0
})
```

---

### Issue: CategoryIds not populating on new articles

**Cause:** Backend helper not resolving tags

**Solution:**
1. Check backend logs for errors
2. Verify tags exist in database
3. Test resolveCategoryIds directly:
```bash
# In backend console/test file
import { resolveCategoryIds } from './controllers/articlesController'
const ids = await resolveCategoryIds(["AI", "Blockchain"])
console.log(ids)  // Should return array of ObjectIds
```

---

## NPM Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "migrate-categoryids": "tsx server/src/scripts/backfillCategoryIds.ts"
  }
}
```

---

## Rollback Plan

If Phase 2 causes issues:

1. **Frontend:** Phase 2 changes are backward compatible
   - New `categoryIds` field is optional
   - Old code still works with `categories` array

2. **Backend:** Remove auto-population
   - Comment out `resolveCategoryIds()` calls in articlesController
   - Articles will stop getting categoryIds, but existing ones remain

3. **Database:** No rollback needed
   - `categoryIds` field doesn't interfere with existing queries
   - Can be removed with:
```javascript
db.articles.updateMany({}, { $unset: { categoryIds: "" } })
```

---

## Success Criteria

Phase 2 is successful if:

- ✅ Backend API returns full tag objects (`format=full`)
- ✅ New articles automatically get `categoryIds`
- ✅ Migration backfills existing articles
- ✅ Tag renames don't break article references
- ✅ Phase 1 tests still pass
- ✅ No performance degradation

---

## Next Steps

After Phase 2 testing:

1. **Optional UI Enhancement:** Update TagSelector to use Tag objects
2. **Cleanup:** Remove Phase 1 case-insensitive comparison (IDs make it unnecessary)
3. **Advanced Features:** 
   - Tag synonyms (multiple names → same ID)
   - Tag hierarchy (parent/child relationships)
   - Tag merging tool

---

**Status:** Phase 2 backend complete, ready for testing  
**Estimated Test Time:** 30-45 minutes  
**Risk:** Low (backward compatible, optional field)



