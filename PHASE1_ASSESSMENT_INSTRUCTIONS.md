# Phase 1 Assessment Instructions

**Phase:** Establish Ground Truth in the Database  
**Status:** Ready to Execute  
**Last Updated:** 2026-01-10

---

## Overview

Phase 1 assesses the database to determine:
- **Bucket A:** Articles with `externalLinks[]` already populated (already migrated)
- **Bucket B:** Articles with legacy URLs but no `externalLinks[]` (recoverable)
- **Bucket C:** Articles with no URLs anywhere (lost)

This is a **READ-ONLY** assessment - no data is modified.

---

## Prerequisites

1. **Database Access:**
   - Ensure `.env` file is configured with `MONGO_URI` or `MONGODB_URI`
   - Database connection should be accessible

2. **Node.js & Dependencies:**
   - Node.js installed
   - Project dependencies installed (`npm install`)

---

## Running the Assessment

### Basic Assessment (Summary Only)

```bash
cd server
npx ts-node scripts/assessExternalLinksPhase1.ts
```

**Output:** Summary counts for each bucket (A, B, C)

### Detailed Assessment (With Sample Articles)

```bash
npx ts-node scripts/assessExternalLinksPhase1.ts --detailed
```

**Output:** Summary + sample article IDs and titles for each bucket

### Export Article IDs to JSON

```bash
npx ts-node scripts/assessExternalLinksPhase1.ts --export-ids
```

**Output:** Summary + JSON files with article IDs for each bucket

**Export Location:** `server/scripts/phase1-assessment/`
- `bucket-a-ids.json` - Articles already migrated
- `bucket-b-ids.json` - Recoverable articles (with legacy URLs)
- `bucket-c-ids.json` - Lost articles (no URLs)
- `assessment-summary.json` - Summary statistics

### Combined Options

```bash
# Detailed + Export
npx ts-node scripts/assessExternalLinksPhase1.ts --detailed --export-ids
```

---

## Expected Output

### Summary Output Example

```
======================================================================
PHASE 1 ASSESSMENT: External Links Database State
======================================================================

Total Articles: 1234

Bucket Classification:
  📦 Bucket A (Already Migrated):       850 (68.88%)
     └─ Articles with externalLinks[] populated
  📦 Bucket B (Recoverable):            320 (25.93%)
     └─ Articles with legacy URLs but no externalLinks[]
  📦 Bucket C (Lost):                    64 (5.19%)
     └─ Articles with no URLs anywhere

======================================================================
```

### Detailed Output Example

```
📦 BUCKET A - Already Migrated (Sample):
  • 507f1f77bcf86cd799439011 - "Sample Article 1" (2 links)
  • 507f191e810c19729de860ea - "Sample Article 2" (1 links)
  ... and 848 more

📦 BUCKET B - Recoverable (Sample):
  • 507f1f77bcf86cd799439012 - "Legacy Article 1"
    └─ Legacy URL: https://example.com/article1
  • 507f191e810c19729de860eb - "Legacy Article 2"
    └─ Legacy URL: https://example.com/article2
  ... and 318 more

📦 BUCKET C - Lost (Sample):
  • 507f1f77bcf86cd799439013 - "Text-Only Article 1"
  • 507f191e810c19729de860ec - "Text-Only Article 2"
  ... and 62 more
```

---

## Interpreting Results

### Bucket A (Already Migrated)
- ✅ **Status:** No action needed
- **Meaning:** Articles already have `externalLinks[]` populated
- **Action:** None required

### Bucket B (Recoverable)
- ⚠️ **Status:** Can be recovered
- **Meaning:** Articles have legacy URLs in `media.url` or `media.previewMetadata.url` but no `externalLinks[]`
- **Action:** Phase 2 migration will recover these
- **Priority:** High (recoverable data)

### Bucket C (Lost)
- ❌ **Status:** Not recoverable
- **Meaning:** Articles have no URLs anywhere (text-only articles or data already lost)
- **Action:** Phase 3 - Accept loss or restore from backups
- **Priority:** Low (not recoverable)

---

## Exit Criteria Checklist

- [ ] Assessment script runs successfully
- [ ] Total article count is known
- [ ] Bucket A count is known (already migrated)
- [ ] Bucket B count is known (recoverable)
- [ ] Bucket C count is known (lost)
- [ ] Percentages calculated
- [ ] Sample articles identified (if using `--detailed`)
- [ ] Article IDs exported (if using `--export-ids`)
- [ ] Recommendations documented

---

## Next Steps

After completing Phase 1:

1. **If Bucket B > 0:**
   - Proceed to Phase 2 (migration script)
   - Use `bucket-b-ids.json` for migration planning

2. **If Bucket C > 0:**
   - Document impact (number of lost articles)
   - Decide on approach (accept loss / restore from backups / manual re-entry)
   - Proceed to Phase 3

3. **If Bucket A = Total:**
   - All articles already migrated
   - Skip Phase 2
   - Proceed directly to Phase 4 (regression tests)

---

## Troubleshooting

### Error: "MONGO_URI or MONGODB_URI environment variable is required"

**Solution:** Ensure `.env` file exists and contains database connection string:
```
MONGO_URI=mongodb://localhost:27017/nuggets
# OR
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/nuggets
```

### Error: "Cannot find module"

**Solution:** Install dependencies:
```bash
npm install
```

### Error: "Database connection failed"

**Solution:** 
- Verify database is running
- Check connection string is correct
- Verify network access (for cloud databases)

---

## Notes

- This script is **READ-ONLY** - it does not modify any data
- Safe to run multiple times
- Can be run in production (assessment only)
- Execution time depends on database size (typically seconds to minutes)

---

**Script Location:** `server/scripts/assessExternalLinksPhase1.ts`  
**Phase 1 Status:** ✅ Ready  
**Next Phase:** Phase 2 (Migration) or Phase 3 (Accept Loss)
