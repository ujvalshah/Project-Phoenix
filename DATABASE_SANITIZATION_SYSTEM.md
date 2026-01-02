# Database Sanitization System

**Status:** ✅ Complete  
**Date:** 2025-01-XX  
**Author:** Senior Backend Engineer + Database Reliability Engineer

---

## Overview

A comprehensive, production-ready database sanitization system that safely identifies and removes orphaned references, stale entities, and invalid data from the MongoDB database.

### Key Features

- ✅ **Read-Only Discovery Phase** - Safe audit without data modification
- ✅ **Dry-Run Mode** - Default mode prevents accidental data loss
- ✅ **Idempotent Operations** - Safe to run multiple times
- ✅ **Comprehensive Logging** - Detailed reports of all operations
- ✅ **Verification System** - Post-cleanup integrity checks
- ✅ **Conservative Approach** - Preserves audit trails and critical data

---

## Architecture

### Phase 1: Discovery (Read-Only Audit)

Scans all collections for:
- **Orphaned References**: IDs pointing to non-existent documents
- **Stale Entities**: Documents referencing removed features
- **Invalid Fields**: Missing required fields or invalid data

**Collections Audited:**
- `Collection` - entries, creatorId, followers
- `Bookmark` - userId, nuggetId
- `BookmarkFolder` - userId
- `BookmarkFolderLink` - userId, bookmarkId, folderId
- `Article` - authorId, required fields
- `Report` - reporter, respondent, targetId, actionedBy
- `ModerationAuditLog` - reportId, performedBy
- `Feedback` - user.id

### Phase 2: Safe Cleanup Plan

Issues are classified into three categories:

1. **SAFE_AUTO_FIX** ✅
   - Orphaned references where parent entity no longer exists
   - Invalid array entries pointing to non-existent documents
   - Safe to automatically clean

2. **CONDITIONAL_CLEANUP** ⚠️
   - Audit trail data (reports, moderation logs)
   - User-related data where user no longer exists
   - Collections/articles with orphaned creators/authors
   - Requires manual review before cleanup

3. **DO_NOT_TOUCH** 🚫
   - Documents with missing required fields (may be critical)
   - Anything ambiguous or business-critical
   - Requires explicit business decision

### Phase 3: Cleanup Utilities

Dedicated sanitizers for each collection:
- `sanitizeCollections.ts` - Removes orphaned entries and followers
- `sanitizeBookmarks.ts` - Deletes orphaned bookmarks
- `sanitizeBookmarkFolders.ts` - Removes orphaned folders
- `sanitizeBookmarkFolderLinks.ts` - Cleans orphaned links
- `sanitizeReports.ts` - Audit only (no cleanup)
- `sanitizeModerationAuditLog.ts` - Audit only (no cleanup)
- `sanitizeFeedback.ts` - Audit only (no cleanup)

### Phase 4: Dry-Run Mode

**Default Behavior:** `DRY_RUN=true`
- No data is modified
- All intended operations are logged
- Safe to run on production

**Execution Mode:** `DRY_RUN=false` + `FORCE_EXECUTE=true`
- Requires explicit confirmation
- Performs actual cleanup operations
- Logs all changes

### Phase 5: Execution Script

Single entry point: `server/scripts/sanitizeDatabase.ts`

**Features:**
- Connects to database
- Runs discovery phase
- Generates markdown report
- Executes cleanup (if not dry-run)
- Verifies integrity post-cleanup
- Closes database connection gracefully

### Phase 6: Verification

Post-cleanup integrity checks:
- Validates all references are intact
- Ensures no new orphaned references
- Verifies data consistency
- Generates verification report

---

## Usage

### Dry-Run (Discovery Only)

```bash
npm run sanitize:dry-run
```

This will:
1. Connect to the database
2. Scan all collections for issues
3. Generate a markdown report
4. Exit without modifying any data

**Output:** `DATABASE_SANITIZATION_REPORT_<timestamp>.md`

### Execute Cleanup

```bash
# Step 1: Review the dry-run report
npm run sanitize:dry-run

# Step 2: Execute cleanup (requires explicit confirmation)
FORCE_EXECUTE=true DRY_RUN=false npm run sanitize:execute
```

**Safety Features:**
- Requires `FORCE_EXECUTE=true` environment variable
- Logs all operations before execution
- Creates backup report before cleanup
- Verifies integrity after cleanup

---

## Report Format

The sanitization report includes:

1. **Summary**
   - Total issue types found
   - Total affected records
   - Breakdown by category
   - Breakdown by collection

2. **Detailed Issues**
   - Collection name
   - Issue type
   - Description
   - Count of affected records
   - Sample IDs (max 5)
   - Cleanup category
   - Field name (if applicable)
   - Additional details

3. **Recommendations**
   - Safe auto-fix items
   - Conditional cleanup items
   - Do not touch items

---

## Safety Guarantees

### ✅ Idempotent Operations

All sanitizers are safe to run multiple times:
- Check existence before deletion
- Use atomic MongoDB operations
- Handle errors gracefully

### ✅ No Schema Changes

- Does not modify database schema
- Does not add/remove indexes
- Preserves all existing fields

### ✅ Backward Compatible

- Does not break existing functionality
- Preserves all valid data
- Maintains referential integrity

### ✅ Comprehensive Logging

- Logs all operations
- Records errors with context
- Generates detailed reports

### ✅ Conservative Cleanup

- Preserves audit trails
- Does not delete business-critical data
- Requires manual review for ambiguous cases

---

## What Gets Cleaned

### ✅ Safe Auto-Fix

1. **Collection Entries**
   - Removes entries with non-existent `articleId`
   - Removes entries with non-existent `addedByUserId`
   - Updates `validEntriesCount` field

2. **Collection Followers**
   - Removes non-existent user IDs from `followers` array
   - Updates `followersCount` field

3. **Orphaned Bookmarks**
   - Deletes bookmarks with non-existent `userId`
   - Deletes bookmarks with non-existent `nuggetId`
   - Also deletes associated `BookmarkFolderLink` entries

4. **Orphaned Bookmark Folders**
   - Deletes folders with non-existent `userId`
   - Also deletes associated `BookmarkFolderLink` entries

5. **Orphaned Bookmark Folder Links**
   - Deletes links with non-existent `bookmarkId`
   - Deletes links with non-existent `folderId`
   - Deletes links with non-existent `userId`

### ⚠️ Conditional Cleanup (Manual Review Required)

1. **Collections with Orphaned Creator**
   - Collections where `creatorId` doesn't exist
   - **Action:** Manual review - may need to reassign or delete

2. **Articles with Orphaned Author**
   - Articles where `authorId` doesn't exist
   - **Action:** Manual review - may need to reassign or delete

3. **Reports with Orphaned References**
   - Reports with non-existent reporter/respondent/target
   - **Action:** Preserve for audit trail (no auto-cleanup)

4. **Moderation Audit Logs**
   - Logs with non-existent reportId or performedBy
   - **Action:** Preserve for compliance (no auto-cleanup)

5. **Feedback with Orphaned Users**
   - Feedback entries with non-existent user.id
   - **Action:** May preserve for historical context (no auto-cleanup)

### 🚫 Do Not Touch

1. **Articles with Missing Required Fields**
   - Missing title, content, authorId, or authorName
   - **Reason:** May be critical data, requires business decision

---

## File Structure

```
server/
├── scripts/
│   └── sanitizeDatabase.ts          # Main execution script
└── src/
    └── utils/
        └── dataSanitizers/
            ├── index.ts              # Exports
            ├── types.ts              # TypeScript types
            ├── discovery.ts          # Phase 1: Discovery
            ├── reportGenerator.ts    # Report generation
            ├── verification.ts       # Phase 6: Verification
            ├── sanitizeCollections.ts
            ├── sanitizeBookmarks.ts
            ├── sanitizeBookmarkFolders.ts
            ├── sanitizeBookmarkFolderLinks.ts
            ├── sanitizeReports.ts
            ├── sanitizeModerationAuditLog.ts
            └── sanitizeFeedback.ts
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DRY_RUN` | `true` | When `true`, no data is modified |
| `FORCE_EXECUTE` | `false` | When `true`, skips confirmation prompt |
| `MONGO_URI` | Required | MongoDB connection string |

---

## Example Output

### Dry-Run Report

```
================================================================================
DATABASE SANITIZATION SYSTEM
================================================================================
Mode: 🔍 DRY RUN (No data will be modified)
Timestamp: 2025-01-XX...

[1/5] Connecting to database...
✓ Database connected

[2/5] PHASE 1: Discovery (Read-Only Audit)
--------------------------------------------------------------------------------
[Discovery] Starting database audit...
[Discovery] Scanning Collections...
[Discovery] Scanning Bookmarks...
...
[Discovery] Audit complete. Found 8 issue types.

✓ Sanitization report written to: DATABASE_SANITIZATION_REPORT_2025-01-XX.md

DISCOVERY SUMMARY:
- Total Issue Types: 8
- Total Affected Records: 142
- Safe Auto-Fix: 5
- Conditional Cleanup: 3
- Do Not Touch: 0
```

### Execution Output

```
[4/5] PHASE 3: Executing Cleanup
--------------------------------------------------------------------------------

Cleaning Collections...
  ✓ Scanned: 45, Cleaned: 12, Skipped: 0

Cleaning Bookmarks...
  ✓ Scanned: 230, Cleaned: 8, Skipped: 0
...

================================================================================
CLEANUP SUMMARY:
================================================================================
Total Records Scanned: 1,234
Total Records Cleaned: 45
Total Records Skipped: 0
Total Errors: 0

[5/5] PHASE 4: Verification
--------------------------------------------------------------------------------
Running post-cleanup verification...

================================================================================
VERIFICATION RESULTS
================================================================================
✓ Collection Creator IDs: All collections have valid creator IDs
✓ Collection Entry Article References: All collection entries reference valid articles
✓ Bookmark References: All bookmarks reference valid users and articles
...
================================================================================
Overall Status: ✅ PASSED
================================================================================
```

---

## Best Practices

1. **Always Run Dry-Run First**
   ```bash
   npm run sanitize:dry-run
   ```

2. **Review the Report**
   - Check the markdown report
   - Understand what will be cleaned
   - Verify counts are expected

3. **Backup Before Execution**
   - Create database backup
   - Export critical collections

4. **Execute During Low Traffic**
   - Run during maintenance window
   - Monitor database performance

5. **Verify After Cleanup**
   - Check verification results
   - Review post-cleanup report
   - Test critical functionality

6. **Handle Conditional Cleanup Manually**
   - Review each case individually
   - Make business decisions
   - Document actions taken

---

## Troubleshooting

### Error: "MONGO_URI is not defined"

**Solution:** Set `MONGO_URI` or `MONGODB_URI` environment variable

```bash
export MONGO_URI="mongodb+srv://..."
npm run sanitize:dry-run
```

### Error: "FORCE_EXECUTE must be true"

**Solution:** This is a safety feature. Explicitly set the flag:

```bash
FORCE_EXECUTE=true DRY_RUN=false npm run sanitize:execute
```

### Verification Fails

**Solution:**
1. Check the verification report
2. Review which checks failed
3. Some failures may be expected (e.g., orphaned creators requiring manual review)
4. Re-run discovery to see remaining issues

---

## Maintenance

### Regular Audits

Recommend running dry-run monthly:
```bash
npm run sanitize:dry-run
```

### After Major Data Migrations

Run full cleanup after:
- User deletions
- Article deletions
- Feature removals
- Schema migrations

### Monitoring

Track:
- Number of orphaned references over time
- Cleanup frequency
- Verification results

---

## Limitations

1. **No Automatic Cleanup of Audit Trails**
   - Reports and moderation logs preserved
   - Requires manual review

2. **No Automatic Author/Creator Reassignment**
   - Orphaned creators/authors require manual decision
   - May need to reassign or delete

3. **No Cross-Collection Validation**
   - Only validates direct references
   - Does not validate business logic

4. **No Soft-Delete Cleanup**
   - Does not handle soft-deleted records
   - Only handles hard-deleted references

---

## Future Enhancements

- [ ] Soft-delete cleanup (with configurable retention period)
- [ ] Automatic author/creator reassignment rules
- [ ] Scheduled automated cleanup
- [ ] Integration with monitoring/alerting
- [ ] Support for additional collections
- [ ] Performance optimization for large datasets

---

## Support

For questions or issues:
1. Review the generated reports
2. Check verification results
3. Consult the code comments
4. Review this documentation

---

**System Status:** ✅ Production Ready  
**Last Updated:** 2025-01-XX











