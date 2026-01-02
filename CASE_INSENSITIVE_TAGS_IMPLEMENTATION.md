# Case-Insensitive Tag/Collection Names Implementation

## Summary

Implemented a system where tag and collection names preserve exact user-entered casing for display (`rawName`), but duplicates differing only by case are treated as the same logical entity using `canonicalName`.

## Root Cause

Previously, tags and collections used a single `name` field with case-sensitive uniqueness. This allowed duplicates like "Ai", "AI", and "ai" to exist as separate entities. Additionally, the UI applied `toSentenceCase()` transformations, which modified the display casing from what users entered.

## Solution

### 1. Data Model Changes

**Tag Model** (`server/src/models/Tag.ts`):
- Added `rawName`: Exact user-entered text, preserved for display
- Added `canonicalName`: Normalized lowercase version (`rawName.trim().toLowerCase()`) for uniqueness
- Unique index on `canonicalName`
- Virtual `name` field maps to `rawName` for backward compatibility

**Collection Model** (`server/src/models/Collection.ts`):
- Added `rawName`: Exact user-entered text, preserved for display
- Added `canonicalName`: Normalized lowercase version for uniqueness
- Compound index on `canonicalName` and `creatorId` for efficient lookups
- Virtual `name` field maps to `rawName` for backward compatibility

### 2. Creation Flow

**Tag Creation** (`server/src/controllers/tagsController.ts`):
- Computes `canonicalName` from input
- Checks for existing tag with same `canonicalName`
- If exists → returns existing tag (200) instead of creating duplicate
- Does NOT overwrite existing `rawName`

**Collection Creation** (`server/src/controllers/collectionsController.ts`):
- Computes `canonicalName` from input
- For private collections: checks per creator (same creator can't have duplicate `canonicalName`)
- For public collections: checks globally (anyone can't create duplicate `canonicalName`)
- If exists → returns existing collection (200) instead of creating duplicate

### 3. Update Logic

**Collection Updates**:
- When `name` is updated, both `rawName` and `canonicalName` are updated
- Validates that new `canonicalName` doesn't create duplicates
- Returns 409 if duplicate would be created

### 4. Display Changes

Removed all `toSentenceCase()` transformations from UI components:
- `src/components/collections/CollectionCard.tsx`
- `src/components/collections/TableView.tsx`
- `src/pages/CollectionDetailPage.tsx`

Tags and collections now display exactly as entered by users.

### 5. Search/Filter Updates

**Collection Search** (`server/src/controllers/collectionsController.ts`):
- Updated to search by both `canonicalName` (case-insensitive) and `rawName` (for display matching)

**Tag Queries**:
- Sorting now uses `rawName` instead of `name`
- Tag lookups use `canonicalName` for case-insensitive matching

### 6. Migration Script

Created `server/src/utils/migrateCanonicalNames.ts`:
- Backfills `canonicalName` for all existing Tag and Collection records
- Handles conflicts by logging them (doesn't auto-merge)
- Can be run via `server/src/scripts/runMigration.ts`

**To run migration:**
```bash
tsx server/src/scripts/runMigration.ts
```

### 7. Backward Compatibility

- Virtual `name` field ensures existing code continues to work
- Articles store tag names as strings (rawName values) - no changes needed
- API responses include `name` field (mapped from `rawName`)

## Files Changed

### Backend Models
- `server/src/models/Tag.ts` - Added rawName, canonicalName, unique index
- `server/src/models/Collection.ts` - Added rawName, canonicalName, indexes

### Backend Controllers
- `server/src/controllers/tagsController.ts` - Updated create/delete/get to use canonicalName
- `server/src/controllers/collectionsController.ts` - Updated create/update/search to use canonicalName

### Frontend Components
- `src/components/collections/CollectionCard.tsx` - Removed toSentenceCase
- `src/components/collections/TableView.tsx` - Removed toSentenceCase
- `src/pages/CollectionDetailPage.tsx` - Removed toSentenceCase

### Migration & Scripts
- `server/src/utils/migrateCanonicalNames.ts` - Migration script
- `server/src/scripts/runMigration.ts` - Script runner

## Behavior Examples

### Before
- User enters "Ai" → stored as "Ai"
- User enters "AI" → stored as "AI" (duplicate allowed)
- User enters "ai" → stored as "ai" (duplicate allowed)
- Display: All shown as "Ai" (toSentenceCase applied)

### After
- User enters "Ai" → stored as `rawName="Ai"`, `canonicalName="ai"`
- User enters "AI" → matches `canonicalName="ai"` → returns existing tag with `rawName="Ai"`
- User enters "ai" → matches `canonicalName="ai"` → returns existing tag with `rawName="Ai"`
- Display: Shows "Ai" exactly as first entered (no transformation)

## Database Constraints

- **Tag**: Unique index on `canonicalName`
- **Collection**: Compound index on `canonicalName` and `creatorId` (for efficient per-creator lookups)

## Testing Checklist

- [ ] "Ai", "AI", "ai" → resolves to one tag
- [ ] Display casing stays exactly how it was originally entered
- [ ] Slugs/filters remain functional and case-insensitive
- [ ] No UI layer transforms label text
- [ ] Searching works regardless of case
- [ ] Migration script handles existing duplicates safely
- [ ] Private collections allow same canonicalName for different creators
- [ ] Public collections prevent duplicate canonicalName globally

## Next Steps

1. Run migration script on production database
2. Review and resolve any conflicts logged by migration
3. Test tag/collection creation with various case combinations
4. Verify UI displays exact casing
5. Monitor for any edge cases



