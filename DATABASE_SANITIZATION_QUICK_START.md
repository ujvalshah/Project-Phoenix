# Database Sanitization - Quick Start Guide

## 🚀 Quick Commands

### 1. Run Discovery (Safe - No Data Modified)
```bash
npm run sanitize:dry-run
```

### 2. Execute Cleanup (Requires Confirmation)
```bash
FORCE_EXECUTE=true DRY_RUN=false npm run sanitize:execute
```

---

## 📋 What It Does

### ✅ Automatically Cleans (Safe Auto-Fix)
- Orphaned collection entries (non-existent articles/users)
- Orphaned collection followers
- Orphaned bookmarks
- Orphaned bookmark folders
- Orphaned bookmark folder links

### ⚠️ Requires Manual Review
- Collections with orphaned creators
- Articles with orphaned authors
- Reports (preserved for audit trail)
- Moderation audit logs (preserved for compliance)
- Feedback entries (may preserve for history)

### 🚫 Never Touches
- Articles with missing required fields
- Any ambiguous or business-critical data

---

## 📊 Output Files

1. **Discovery Report:** `DATABASE_SANITIZATION_REPORT_<timestamp>.md`
   - Generated after dry-run
   - Shows all issues found
   - Categorized by safety level

2. **Post-Cleanup Report:** `DATABASE_SANITIZATION_POST_CLEANUP_<timestamp>.md`
   - Generated after execution
   - Shows remaining issues
   - Verification results

---

## 🔒 Safety Features

- ✅ **Default Dry-Run:** No data modified by default
- ✅ **Explicit Confirmation:** Requires `FORCE_EXECUTE=true`
- ✅ **Idempotent:** Safe to run multiple times
- ✅ **Comprehensive Logging:** All operations logged
- ✅ **Verification:** Post-cleanup integrity checks

---

## 📖 Full Documentation

See `DATABASE_SANITIZATION_SYSTEM.md` for complete documentation.

---

## ⚡ Example Workflow

```bash
# Step 1: Discover issues (safe)
npm run sanitize:dry-run

# Step 2: Review the generated report
cat DATABASE_SANITIZATION_REPORT_*.md

# Step 3: If satisfied, execute cleanup
FORCE_EXECUTE=true DRY_RUN=false npm run sanitize:execute

# Step 4: Review post-cleanup report
cat DATABASE_SANITIZATION_POST_CLEANUP_*.md
```

---

**Remember:** Always run dry-run first and review the report before executing cleanup!











