# Phase-2 Tag & Category Cleanup Implementation

## Overview

This document describes the implementation of the Phase-2 Tag & Category Cleanup migration script, which safely fixes tag and category integrity issues detected in the Phase-2 audit.

## Script Location

**File:** `server/src/scripts/tagCleanupFix.ts`

## Features

### Safety First
- **DRY-RUN by default** - No data modifications unless explicitly requested
- **Confirmation prompt** - Interactive confirmation required before applying changes
- **Safety guardrails** - Aborts if >15% of records need modification
- **Error handling** - Wrapped in try/catch with rollback safety
- **Batch processing** - Updates in chunks of 500 records

### Issues Fixed

1. **Whitespace-only tags** - Trims and removes tags that are only whitespace
2. **Duplicate tags** - Removes case-insensitive duplicates (preserves first occurrence casing)
3. **Tag normalization** - Normalizes casing while preserving first occurrence
4. **Empty/invalid categories** - Removes empty or whitespace-only category values
5. **Empty tags fallback** - Assigns "uncategorized" if tags array becomes empty after cleanup

### What is NOT Modified

- **categoryIds** - This phase only fixes tag/category strings, not ObjectId references
- **Other fields** - Media, content, and all other fields remain untouched
- **Records with no changes** - Skipped automatically

## Usage

### Dry-Run Mode (Default)

```bash
tsx server/src/scripts/tagCleanupFix.ts
```

This mode:
- Scans all articles
- Computes fixes
- Logs before/after diffs
- Writes results to `reports/tag-cleanup-dryrun-*.json`
- **Does NOT modify the database**

### Apply Mode (Explicit)

```bash
tsx server/src/scripts/tagCleanupFix.ts --apply
```

This mode:
- Performs the same scan as dry-run
- **Writes changes to the database** in batches of 500
- Requires interactive confirmation (if TTY available)
- Logs count of modified records
- Saves before/after metadata snapshot for each updated record

## Output

### Console Summary

The script prints a summary table showing:

```
================================================================================
CLEANUP SUMMARY
================================================================================

Scan Date: 2025-01-XX...
Mode: DRY-RUN
Total Articles Scanned: XXXX
Articles Modified: XXX
Articles Skipped: XXXX
Execution Time: X.XXs

ISSUE | FIXED COUNT
--------------------------------------------------------------------------------
Tags Trimmed (Whitespace)        |        XXX
Tags Deduplicated                |        XXX
Tags Normalized (Casing)         |        XXX
Categories Trimmed               |        XXX
Categories Removed (Empty)       |        XXX
Fallback Tag Added               |        XXX
--------------------------------------------------------------------------------

Breakdown by Source Type:
  source_type_1: XXX
  source_type_2: XXX

Breakdown by Year:
  2025: XXX
  2024: XXX
```

### JSON Report

A detailed JSON report is saved to:
- **Dry-run:** `reports/tag-cleanup-dryrun-YYYY-MM-DDTHH-MM-SS.json`
- **Apply:** `reports/tag-cleanup-apply-YYYY-MM-DDTHH-MM-SS.json`

The report includes:
- Metadata (scan date, mode, execution stats)
- Summary table (issue types and fixed counts)
- Breakdown by source_type and year
- Detailed affected records with before/after snapshots
- Execution statistics

## Safety Features

### 1. Guardrail: Modification Threshold

If more than 15% of records require modification, the script **aborts** in apply mode:

```
⚠️  SAFETY ABORT: More than 15% of records require modification.
   Modification rate: XX.XX%
   This may indicate a systemic issue. Please review before applying.
```

### 2. Interactive Confirmation

In apply mode, the script prompts for confirmation:

```
⚠️  You are about to modify data in the database. Continue? (yes/no):
```

### 3. Error Handling

- All database operations wrapped in try/catch
- Errors logged but don't stop the entire process
- Connection cleanup on exit (even on errors)

### 4. Skip Unchanged Records

Records where cleanup produces no changes are automatically skipped to minimize database writes.

## Cleanup Logic

### Tags Cleanup

```typescript
// Input: ["  tag1  ", "TAG1", "tag1", "  ", "tag2"]
// Output: ["tag1", "tag2"] (preserves first occurrence casing)
```

**Process:**
1. Trim whitespace from each tag
2. Remove whitespace-only tags
3. Deduplicate case-insensitively (preserve first occurrence casing)
4. If result is empty, add "uncategorized"

### Categories Cleanup

```typescript
// Input: ["  cat1  ", "  ", "cat2", ""]
// Output: ["cat1", "cat2"]
```

**Process:**
1. Trim whitespace from each category
2. Remove empty/whitespace-only categories
3. Preserve order and casing

## Example Report Output

### Dry-Run Complete

```
================================================================================
✅ DRY-RUN complete — no data was modified

To apply these changes, run:
  tsx server/src/scripts/tagCleanupFix.ts --apply
================================================================================
```

### Apply Mode Complete

```
================================================================================
✅ APPLY mode complete — 1234 records updated safely
================================================================================
```

## What Was Fixed vs Skipped

### Fixed Issues

The script fixes the following issues detected in Phase-2 audit:

1. **Whitespace-only tags** - Removed and trimmed
2. **Duplicate tags** - Deduplicated (case-insensitive)
3. **Tag casing inconsistencies** - Normalized while preserving first occurrence
4. **Empty/invalid categories** - Removed
5. **Empty tags arrays** - Assigned "uncategorized" fallback

### Skipped Issues

The following issues are **NOT** addressed in this phase:

1. **Missing categoryIds** - This requires Tag collection lookups (separate phase)
2. **Legacy structure** - Articles with only `category` field (not `categories` array)
3. **Business-meaning changes** - Edge cases where cleanup might change semantic meaning

### Records Skipped

Records are skipped if:
- No changes detected after cleanup
- Error during processing (logged but skipped)
- Schema validation fails (unexpected structure)

## Testing Recommendations

### Before Running in Production

1. **Run dry-run first:**
   ```bash
   tsx server/src/scripts/tagCleanupFix.ts
   ```

2. **Review the JSON report:**
   - Check the breakdown by source_type and year
   - Review sample affected records
   - Verify the changes look correct

3. **Test on a small subset** (if possible):
   - Create a test database
   - Run the script
   - Verify results

4. **Run apply mode:**
   ```bash
   tsx server/src/scripts/tagCleanupFix.ts --apply
   ```

### Verification Steps

After running the script, verify:

1. **Tag integrity:**
   ```javascript
   // Check for whitespace-only tags
   db.articles.find({ tags: { $regex: /^\s+$/ } })
   
   // Check for duplicates (case-insensitive)
   // This requires application-level check
   ```

2. **Category integrity:**
   ```javascript
   // Check for empty categories
   db.articles.find({ categories: { $in: ['', '   '] } })
   ```

3. **Fallback tags:**
   ```javascript
   // Check for uncategorized fallback
   db.articles.find({ tags: 'uncategorized' })
   ```

## Integration with Phase-2 Audit

This script addresses the following issues from `tagAuditReport.ts`:

| Audit Issue | Cleanup Fix |
|------------|-------------|
| `whitespace_tags` | ✅ Fixed - Trims and removes whitespace-only tags |
| `duplicate_tags` | ✅ Fixed - Deduplicates case-insensitively |
| `bad_categories` | ✅ Fixed - Removes empty/whitespace categories |
| `empty_tags` | ✅ Fixed - Assigns "uncategorized" fallback |
| `missing_categoryIds` | ⏭️ Skipped - Separate phase required |
| `legacy_structure` | ⏭️ Skipped - Separate phase required |

## Next Steps

After running this cleanup:

1. **Review the report** - Ensure changes are as expected
2. **Run Phase-3 cleanup** (if needed) - Backfill categoryIds
3. **Monitor application** - Verify no regressions
4. **Update normalization** - Ensure future articles use normalized tags/categories

## Notes

- The script preserves the **first occurrence casing** when deduplicating tags
- Empty tags arrays are assigned "uncategorized" as a fallback
- The script does **NOT** modify `categoryIds` (that's a separate migration)
- All changes are logged in the JSON report for audit purposes
- The script is idempotent - running it multiple times produces the same result



