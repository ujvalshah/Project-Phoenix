# Tag Cleanup Script - Sample Output

## Example Console Output

### Dry-Run Mode

```
================================================================================
PHASE-2 TAG & CATEGORY CLEANUP MIGRATION
================================================================================

Mode: DRY-RUN
ℹ️  DRY-RUN mode: No data will be modified

[Cleanup] Database connected

[Cleanup] Total articles to scan: 5432

[Cleanup] Scanning articles...
[Cleanup] Processed 1000/5432 articles...
[Cleanup] Processed 2000/5432 articles...
[Cleanup] Processed 3000/5432 articles...
[Cleanup] Processed 4000/5432 articles...
[Cleanup] Processed 5000/5432 articles...

[Cleanup] Scan complete. Processed 5432 articles.

================================================================================
CLEANUP SUMMARY
================================================================================

Scan Date: 2025-01-28T10:30:45.123Z
Mode: DRY-RUN
Total Articles Scanned: 5432
Articles Modified: 1234
Articles Skipped: 4198
Execution Time: 12.45s

ISSUE | FIXED COUNT
--------------------------------------------------------------------------------
Tags Trimmed (Whitespace)        |        856
Tags Deduplicated                |        432
Tags Normalized (Casing)         |        678
Categories Trimmed               |        234
Categories Removed (Empty)       |        145
Fallback Tag Added               |         23
--------------------------------------------------------------------------------

Breakdown by Source Type:
  link: 456
  video: 234
  note: 189
  idea: 123
  unknown: 232

Breakdown by Year:
  2025: 456
  2024: 523
  2023: 189
  2022: 66

================================================================================
✅ DRY-RUN complete — no data was modified

To apply these changes, run:
  tsx server/src/scripts/tagCleanupFix.ts --apply
================================================================================

Report saved to: reports/tag-cleanup-dryrun-2025-01-28T10-30-45.json

[Cleanup] Database connection closed.
```

### Apply Mode (with confirmation)

```
================================================================================
PHASE-2 TAG & CATEGORY CLEANUP MIGRATION
================================================================================

Mode: APPLY
⚠️  WARNING: This will modify data in the database!

[Cleanup] Database connected

[Cleanup] Total articles to scan: 5432

⚠️  You are about to modify data in the database. Continue? (yes/no): yes

[Cleanup] Scanning articles...
[Cleanup] Processed 1000/5432 articles...
[Cleanup] Applied 500 updates...
[Cleanup] Processed 2000/5432 articles...
[Cleanup] Applied 1000 updates...
[Cleanup] Processed 3000/5432 articles...
[Cleanup] Processed 4000/5432 articles...
[Cleanup] Applied 1234 updates...
[Cleanup] Processed 5000/5432 articles...

[Cleanup] Scan complete. Processed 5432 articles.

================================================================================
CLEANUP SUMMARY
================================================================================

Scan Date: 2025-01-28T10:35:12.456Z
Mode: APPLY
Total Articles Scanned: 5432
Articles Modified: 1234
Articles Skipped: 4198
Execution Time: 13.21s

ISSUE | FIXED COUNT
--------------------------------------------------------------------------------
Tags Trimmed (Whitespace)        |        856
Tags Deduplicated                |        432
Tags Normalized (Casing)         |        678
Categories Trimmed               |        234
Categories Removed (Empty)       |        145
Fallback Tag Added               |         23
--------------------------------------------------------------------------------

Breakdown by Source Type:
  link: 456
  video: 234
  note: 189
  idea: 123
  unknown: 232

Breakdown by Year:
  2025: 456
  2024: 523
  2023: 189
  2022: 66

================================================================================
✅ APPLY mode complete — 1234 records updated safely
================================================================================

Report saved to: reports/tag-cleanup-apply-2025-01-28T10-35-12.json

[Cleanup] Database connection closed.

[Cleanup] Cleanup completed successfully.
```

## Example JSON Report Structure

```json
{
  "metadata": {
    "scanDate": "2025-01-28T10:30:45.123Z",
    "mode": "dry-run",
    "totalArticles": 5432,
    "articlesModified": 1234,
    "articlesSkipped": 4198,
    "executionTimeMs": 12450
  },
  "summary": [
    {
      "issueType": "Tags Trimmed (Whitespace)",
      "fixedCount": 856
    },
    {
      "issueType": "Tags Deduplicated",
      "fixedCount": 432
    },
    {
      "issueType": "Tags Normalized (Casing)",
      "fixedCount": 678
    },
    {
      "issueType": "Categories Trimmed",
      "fixedCount": 234
    },
    {
      "issueType": "Categories Removed (Empty)",
      "fixedCount": 145
    },
    {
      "issueType": "Fallback Tag Added",
      "fixedCount": 23
    }
  ],
  "breakdownBySourceType": {
    "link": 456,
    "video": 234,
    "note": 189,
    "idea": 123,
    "unknown": 232
  },
  "breakdownByYear": {
    "2025": 456,
    "2024": 523,
    "2023": 189,
    "2022": 66
  },
  "affectedRecords": [
    {
      "articleId": "507f1f77bcf86cd799439011",
      "title": "Example Article Title",
      "source_type": "link",
      "year": "2025",
      "before": {
        "tags": ["  tag1  ", "TAG1", "tag1", "  ", "tag2"],
        "categories": ["  cat1  ", "  ", "cat2"]
      },
      "after": {
        "tags": ["tag1", "tag2"],
        "categories": ["cat1", "cat2"]
      },
      "changes": {
        "tagsTrimmed": 2,
        "tagsDeduplicated": 2,
        "tagsNormalized": 1,
        "categoriesTrimmed": 1,
        "categoriesRemoved": 1,
        "fallbackTagAdded": false
      },
      "skipped": false
    }
  ],
  "executionStats": {
    "batchesProcessed": 3,
    "recordsPerBatch": 500,
    "errors": 0
  }
}
```

## Safety Abort Example

If more than 15% of records need modification:

```
[Cleanup] Scan complete. Processed 5432 articles.

⚠️  SAFETY ABORT: More than 15% of records require modification.
   Modification rate: 18.45%
   This may indicate a systemic issue. Please review before applying.

[Cleanup] Database connection closed.
```

## What Was Fixed vs Skipped

### ✅ Fixed Issues

1. **Whitespace-only tags** - Tags like `"  "`, `"   "` are trimmed and removed
2. **Duplicate tags** - Case-insensitive duplicates like `["Tag1", "tag1", "TAG1"]` → `["Tag1"]` (preserves first occurrence)
3. **Tag normalization** - Trims whitespace while preserving casing
4. **Empty/invalid categories** - Categories like `""`, `"   "` are removed
5. **Empty tags fallback** - If tags array becomes empty, assigns `["uncategorized"]`

### ⏭️ Skipped Issues

1. **Missing categoryIds** - Not modified in this phase (requires Tag collection lookups)
2. **Legacy structure** - Articles with only `category` field (not `categories` array) are not migrated
3. **Records with no changes** - Automatically skipped to minimize database writes

### Example Transformations

**Tags:**
- `["  tag1  ", "TAG1", "tag1", "  ", "tag2"]` → `["tag1", "tag2"]`
- `["  ", "   ", ""]` → `["uncategorized"]`
- `["Tag1", "tag1", "TAG1"]` → `["Tag1"]` (first occurrence preserved)

**Categories:**
- `["  cat1  ", "  ", "cat2", ""]` → `["cat1", "cat2"]`
- `["  ", ""]` → `[]` (empty array, not undefined)


