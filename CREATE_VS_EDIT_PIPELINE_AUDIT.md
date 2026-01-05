# CREATE vs EDIT Pipeline Audit Report

**Date:** 2025-01-02  
**Scope:** Nugget/Article creation vs update pipelines  
**Mode:** AUDIT ONLY - No code modifications

---

## Executive Summary

This audit compares the CREATE and EDIT pipelines for Nugget/Article operations across four layers:
1. **Frontend Modal** (`CreateNuggetModal.handleSubmit`)
2. **Storage Service Adapter** (`RestAdapter.createArticle` vs `updateArticle`)
3. **Backend Controllers** (`createArticle` vs `updateArticle`)
4. **Data Transformations** (normalization, enrichment, validation)

**Key Finding:** Significant divergence exists between CREATE and EDIT pipelines, with duplicated logic, inconsistent normalization, and fields that behave differently between modes.

---

## 1. Create-Only Normalization

### Frontend (`CreateNuggetModal.tsx`)

**Lines 1684-1950 (CREATE branch):**

1. **PublishedAt Generation**
   - ✅ CREATE: `publishedAt: new Date().toISOString()` (line 90 in RestAdapter)
   - ❌ EDIT: Not set (preserves existing)

2. **Tag Validation & Rejection**
   - ✅ CREATE: Early rejection if tags empty (lines 68-70 RestAdapter)
   - ❌ EDIT: No tag validation (tags can be removed)

3. **Media Defaults (Masonry)**
   - ✅ CREATE: `showInMasonry: true` by default for primary media (lines 1870-1887)
   - ❌ EDIT: Preserves existing values, no defaults applied

4. **SupportingMedia Creation**
   - ✅ CREATE: Full async enrichment pipeline (lines 1894-1945)
   - ❌ EDIT: Only updates if masonryMediaItems exist (lines 1470-1612)

5. **Document Upload**
   - ✅ CREATE: Documents uploaded to Cloudinary during submit (lines 1708-1728)
   - ❌ EDIT: Documents not handled (no document upload in edit mode)

6. **Collection Auto-Creation**
   - ✅ CREATE: Auto-creates collections if they don't exist (lines 1952-1959)
   - ❌ EDIT: No collection handling

### Backend (`articlesController.ts`)

**Lines 268-492 (createArticle):**

1. **CategoryIds Resolution**
   - ✅ CREATE: Always resolves categoryIds from category names (line 377)
   - ❌ EDIT: Only resolves if categories are being updated (line 642)

2. **Image Deduplication**
   - ✅ CREATE: Simple deduplication within payload (lines 344-364)
   - ❌ EDIT: Checks against existing images + payload deduplication (lines 528-571)

3. **PublishedAt Handling**
   - ✅ CREATE: Always sets publishedAt (line 384)
   - ❌ EDIT: Only updates if customCreatedAt provided (admin-only, lines 597-633)

4. **Custom CreatedAt (Admin)**
   - ✅ CREATE: Validates and sets customCreatedAt (lines 388-422)
   - ❌ EDIT: Can reset to automatic timestamp (lines 629-632)

5. **Diagnostic Logging**
   - ✅ CREATE: Extensive diagnostic logging for media structure (lines 272-342)
   - ❌ EDIT: Minimal logging

---

## 2. Edit-Only Normalization

### Frontend (`CreateNuggetModal.tsx`)

**Lines 1273-1681 (EDIT branch):**

1. **Metadata Wait Logic**
   - ✅ EDIT: Waits for in-progress metadata fetch (lines 1277-1291)
   - ❌ CREATE: Metadata fetched before submit (no wait needed)

2. **Existing Images Preservation**
   - ✅ EDIT: Merges existingImages with new images (line 1390)
   - ❌ CREATE: Only uses new images

3. **MediaIds Merging**
   - ✅ EDIT: Merges existing mediaIds with new ones (lines 1379-1385)
   - ❌ CREATE: Only uses new mediaIds

4. **Media Enrichment**
   - ✅ EDIT: Calls `enrichMediaItemIfNeeded` for existing media (lines 1427, 1458, 1479)
   - ❌ CREATE: Uses fresh metadata from unfurl

5. **Legacy Image Normalization**
   - ✅ EDIT: Converts legacy-image items to supportingMedia (lines 1495-1532)
   - ❌ CREATE: No legacy handling needed

6. **SupportingMedia Deduplication**
   - ✅ EDIT: Removes images from images array if in supportingMedia (lines 1580-1611)
   - ❌ CREATE: No deduplication needed (fresh state)

7. **Query Cache Invalidation**
   - ✅ EDIT: Explicit cache invalidation + optimistic updates (lines 1622-1648)
   - ❌ CREATE: Only invalidates articles query (line 1961)

8. **Regression Safeguards**
   - ✅ EDIT: Asserts media presence if URL exists (lines 1650-1677)
   - ❌ CREATE: Similar safeguards but less comprehensive

### Backend (`articlesController.ts`)

**Lines 494-691 (updateArticle):**

1. **Ownership Verification**
   - ✅ EDIT: Verifies article ownership (lines 503-515)
   - ❌ CREATE: No ownership check (new article)

2. **YouTube Title Preservation**
   - ✅ EDIT: Prevents overwriting existing YouTube titles (lines 573-589)
   - ❌ CREATE: No existing titles to preserve

3. **Dot Notation Updates**
   - ✅ EDIT: Uses dot notation for nested previewMetadata updates (lines 591-675)
   - ❌ CREATE: Full object creation (no dot notation needed)

4. **Existing Images Check**
   - ✅ EDIT: Checks against existing images to prevent duplicates (lines 534-564)
   - ❌ CREATE: No existing images to check

5. **Partial Update Handling**
   - ✅ EDIT: Only updates provided fields (lines 677-681)
   - ❌ CREATE: All fields required

---

## 3. Shared Pipeline (Duplicated Logic)

### Duplicated Transformations

1. **Image Deduplication**
   - **Location:** 
     - CREATE: `RestAdapter.createArticle` (no dedup) + `articlesController.createArticle` (lines 344-364)
     - EDIT: `CreateNuggetModal.handleSubmit` (lines 1392-1405) + `articlesController.updateArticle` (lines 528-571)
   - **Issue:** Different deduplication logic in 3 places
   - **Risk:** Inconsistent deduplication behavior

2. **Category → CategoryIds Resolution**
   - **Location:**
     - CREATE: `articlesController.createArticle` (line 377)
     - EDIT: `articlesController.updateArticle` (line 642)
   - **Issue:** Same logic, but only runs conditionally in EDIT
   - **Risk:** CategoryIds may be missing if categories not updated

3. **ReadTime Calculation**
   - **Location:**
     - CREATE: `CreateNuggetModal.handleSubmit` (line 1270)
     - EDIT: `CreateNuggetModal.handleSubmit` (line 1302)
   - **Issue:** Same formula duplicated
   - **Risk:** Formula changes must be updated in 2 places

4. **Excerpt Generation**
   - **Location:**
     - CREATE: `CreateNuggetModal.handleSubmit` (lines 1754-1755)
     - EDIT: `CreateNuggetModal.handleSubmit` (lines 1311-1312)
   - **Issue:** Same truncation logic duplicated
   - **Risk:** Truncation length changes must be synced

5. **Primary URL Detection**
   - **Location:**
     - CREATE: `CreateNuggetModal.handleSubmit` (line 1751) - uses `getPrimaryUrl(urls)`
     - EDIT: `CreateNuggetModal.handleSubmit` (line 1328) - uses `getPrimaryUrl(urls)`
   - **Status:** ✅ Shared utility (`processNuggetUrl.ts`)
   - **Note:** Good - single source of truth

6. **Media Object Construction**
   - **Location:**
     - CREATE: `CreateNuggetModal.handleSubmit` (lines 1824-1891)
     - EDIT: `CreateNuggetModal.handleSubmit` (lines 1330-1363)
   - **Issue:** Similar logic but different structure
   - **Risk:** Media structure divergence

7. **Masonry Media Processing**
   - **Location:**
     - CREATE: `CreateNuggetModal.handleSubmit` (lines 1894-1945)
     - EDIT: `CreateNuggetModal.handleSubmit` (lines 1411-1613)
   - **Issue:** Complex logic duplicated with variations
   - **Risk:** Masonry behavior inconsistency

8. **Media Enrichment**
   - **Location:**
     - CREATE: `CreateNuggetModal.handleSubmit` (lines 1922-1936) - `enrichMediaItemIfNeeded`
     - EDIT: `CreateNuggetModal.handleSubmit` (lines 1427, 1458, 1479, 1500, 1542) - `enrichMediaItemIfNeeded`
   - **Status:** ✅ Shared utility function
   - **Note:** Good - single source of truth

---

## 4. Fields: Overwritten vs Preserved

### Fields Overwritten on CREATE but Preserved on EDIT

1. **publishedAt**
   - CREATE: Always set to current timestamp
   - EDIT: Preserved unless `customCreatedAt` provided (admin-only)

2. **authorId / authorName**
   - CREATE: Set from current user
   - EDIT: Never updated (preserved)

3. **media.previewMetadata.title** (YouTube)
   - CREATE: Can be set from metadata
   - EDIT: Preserved if already exists (lines 573-589 backend)

4. **media.previewMetadata.titleSource / titleFetchedAt**
   - CREATE: Can be set from metadata
   - EDIT: Preserved if YouTube title exists (lines 586-587)

5. **isCustomCreatedAt**
   - CREATE: Set to true if customCreatedAt provided
   - EDIT: Can be reset to false (lines 632)

### Fields That Behave Differently

1. **tags**
   - CREATE: Required (rejected if empty, line 68-70 RestAdapter)
   - EDIT: Optional (can be removed, no validation)

2. **categories**
   - CREATE: Always resolves categoryIds
   - EDIT: Only resolves categoryIds if categories updated

3. **images**
   - CREATE: Simple deduplication
   - EDIT: Checks against existing + deduplication + removes if in supportingMedia

4. **mediaIds**
   - CREATE: Only new mediaIds
   - EDIT: Merges existing + new mediaIds

5. **supportingMedia**
   - CREATE: Created from masonryMediaItems selections
   - EDIT: Merges existing + new, normalizes legacy images

6. **media.showInMasonry**
   - CREATE: Defaults to `true` for primary media
   - EDIT: Preserves existing value

7. **readTime**
   - CREATE: Calculated and included
   - EDIT: Recalculated and included (same formula)

8. **excerpt**
   - CREATE: Generated from content/title
   - EDIT: Regenerated if content changed

---

## 5. Impact on Rendering/Classification

### Card Type Determination

**Affected by:**
- `media.type` (CREATE: from `detectProviderFromUrl`, EDIT: preserved or updated)
- `media.previewMetadata` (CREATE: from unfurl, EDIT: enriched if missing)
- `images` array (CREATE: new images, EDIT: merged with existing)

**Risk:** Card type may differ if media structure inconsistent between CREATE/EDIT.

### Media Layout (Masonry)

**Affected by:**
- `media.showInMasonry` (CREATE: defaults true, EDIT: preserved)
- `supportingMedia` array (CREATE: from selections, EDIT: merged + normalized)
- `masonryTitle` (CREATE: from state, EDIT: preserved or updated)

**Risk:** Masonry visibility inconsistent if defaults not applied in EDIT.

### Title Resolution

**Affected by:**
- `title` field (CREATE: optional, EDIT: optional)
- `media.previewMetadata.title` (CREATE: from metadata, EDIT: preserved if YouTube)
- `suggestedTitle` (CREATE: from metadata, EDIT: not used)

**Risk:** Title display may differ if previewMetadata.title preserved in EDIT but not in CREATE.

### Preview Metadata

**Affected by:**
- `media.previewMetadata` (CREATE: from unfurl, EDIT: enriched if missing)
- `media.previewMetadata.imageUrl` (CREATE: from metadata, EDIT: preserved)
- `media.previewMetadata.siteName` (CREATE: from customDomain, EDIT: preserved)

**Risk:** Preview cards may show different metadata if enrichment not applied consistently.

---

## 6. Gaps / Inconsistencies

### High-Risk Divergence Cases

1. **Tag Validation Gap**
   - **Issue:** CREATE rejects empty tags, EDIT allows removal
   - **Impact:** Articles can be created with tags, then edited to remove all tags
   - **Risk:** Data integrity violation (backend may require tags)

2. **CategoryIds Resolution Gap**
   - **Issue:** EDIT only resolves categoryIds if categories updated
   - **Impact:** CategoryIds may be stale if categories changed outside normal flow
   - **Risk:** Tag references may break

3. **Image Deduplication Inconsistency**
   - **Issue:** 3 different deduplication implementations
   - **Impact:** Different deduplication behavior between CREATE/EDIT
   - **Risk:** Duplicate images may appear in some cases

4. **SupportingMedia Normalization Gap**
   - **Issue:** EDIT normalizes legacy images, CREATE doesn't need to
   - **Impact:** Legacy articles may have inconsistent structure
   - **Risk:** Rendering issues for legacy articles

5. **Media Enrichment Timing**
   - **Issue:** CREATE uses fresh metadata, EDIT enriches if missing
   - **Impact:** EDIT may have stale metadata if enrichment fails
   - **Risk:** Preview cards may show outdated information

6. **Masonry Defaults Gap**
   - **Issue:** CREATE defaults `showInMasonry: true`, EDIT preserves existing
   - **Impact:** New articles appear in Masonry by default, edited articles may not
   - **Risk:** Inconsistent Masonry visibility

7. **Document Upload Gap**
   - **Issue:** CREATE uploads documents, EDIT doesn't handle documents
   - **Impact:** Documents cannot be added via EDIT
   - **Risk:** Feature gap

8. **Collection Handling Gap**
   - **Issue:** CREATE auto-creates collections, EDIT doesn't handle collections
   - **Impact:** Collections cannot be modified via EDIT
   - **Risk:** Feature gap

9. **Query Cache Invalidation Gap**
   - **Issue:** EDIT has explicit optimistic updates, CREATE only invalidates
   - **Impact:** CREATE may have stale cache briefly
   - **Risk:** UI inconsistency

10. **YouTube Title Preservation**
    - **Issue:** EDIT preserves YouTube titles, CREATE can overwrite
    - **Impact:** YouTube titles may be lost on CREATE if metadata fetched
    - **Risk:** Title accuracy loss

---

## 7. Recommendations (For Future Refactoring)

### Critical (Data Integrity)

1. **Unify Tag Validation**
   - Apply same validation rules to CREATE and EDIT
   - Decide: Can tags be removed in EDIT?

2. **Unify CategoryIds Resolution**
   - Always resolve categoryIds, even in EDIT
   - Or: Resolve on read if missing

3. **Unify Image Deduplication**
   - Extract to shared utility
   - Use same logic in CREATE/EDIT

### High Priority (Consistency)

4. **Extract Shared Transformations**
   - ReadTime calculation → shared utility
   - Excerpt generation → shared utility
   - Media object construction → shared utility

5. **Unify Masonry Defaults**
   - Apply same defaults in EDIT as CREATE
   - Or: Document that defaults only apply on CREATE

6. **Unify Media Enrichment**
   - Always enrich missing metadata in both modes
   - Or: Document when enrichment is skipped

### Medium Priority (Features)

7. **Document Upload in EDIT**
   - Add document upload support to EDIT mode

8. **Collection Handling in EDIT**
   - Add collection modification support to EDIT mode

9. **Unify Query Cache Strategy**
   - Apply same optimistic update strategy to CREATE

### Low Priority (Polish)

10. **Diagnostic Logging**
    - Add same diagnostic logging to EDIT as CREATE

11. **Error Handling**
    - Unify error handling patterns between CREATE/EDIT

---

## 8. Code Locations Reference

### Frontend

- **CreateNuggetModal.tsx**
  - CREATE branch: Lines 1684-1950
  - EDIT branch: Lines 1273-1681
  - Shared utilities: `enrichMediaItemIfNeeded` (lines 970-1026), `processNuggetUrl` (imported)

- **RestAdapter.ts**
  - `createArticle`: Lines 48-108
  - `updateArticle`: Lines 110-155

### Backend

- **articlesController.ts**
  - `createArticle`: Lines 268-492
  - `updateArticle`: Lines 494-691
  - `resolveCategoryIds`: Lines 53-81 (shared helper)

### Utilities

- **processNuggetUrl.ts**: Shared URL processing (lines 58-100)
- **mediaClassifier.ts**: Shared media classification
- **masonryMediaHelper.ts**: Shared masonry media collection

---

## 9. Summary Statistics

- **Create-Only Transformations:** 11
- **Edit-Only Transformations:** 10
- **Duplicated Logic:** 8 areas
- **Fields with Different Behavior:** 8
- **High-Risk Gaps:** 10
- **Shared Utilities:** 3 (good)

---

**END OF AUDIT REPORT**

