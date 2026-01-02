# User Duplicate Username/Email Fix Guide

**Issue:** Admin panel shows only one user, but signup fails with "username already in use" errors.

---

## Root Cause

This issue typically occurs when:
1. **Duplicate users exist** in the database (same email or username)
2. **Admin panel pagination** hides users (only showing page 1)
3. **Users were deleted** but unique indexes weren't cleaned up (rare in MongoDB)

---

## Step 1: Diagnose the Issue

Run the diagnostic script to see ALL users in the database:

```bash
npm run diagnose-users
```

This will show:
- Total users in database
- All users with their emails/usernames
- Duplicate emails
- Duplicate usernames
- Invalid users (missing required fields)

**Expected Output:**
```
📊 TOTAL USERS IN DATABASE: X

📋 ALL USERS IN DATABASE:
[Lists all users]

🔍 CHECKING FOR DUPLICATE EMAILS:
[Shows duplicates if any]

🔍 CHECKING FOR DUPLICATE USERNAMES:
[Shows duplicates if any]
```

---

## Step 2: Clean Up Duplicates (Dry Run)

Before deleting anything, run a dry run to see what would be deleted:

```bash
npm run cleanup-duplicates:dry-run
```

This will:
- Identify duplicate users (by email or username)
- Show which users would be kept (newest)
- Show which users would be deleted (older duplicates)
- **NOT actually delete anything**

---

## Step 3: Clean Up Duplicates (Execute)

If the dry run looks correct, execute the cleanup:

```bash
npm run cleanup-duplicates
```

This will:
- Delete duplicate users (keeps newest, deletes older)
- Clean up both email and username duplicates
- Show summary of deleted users

**⚠️ WARNING:** This permanently deletes users. Make sure you've reviewed the dry run output.

---

## Step 4: Verify Fix

After cleanup, verify:

1. **Check users again:**
   ```bash
   npm run diagnose-users
   ```
   Should show no duplicates.

2. **Try signup again:**
   - Attempt to signup with a username that was previously blocked
   - Should now work if duplicates were cleaned up

3. **Check admin panel:**
   - Should show all remaining users
   - If still only showing one user, check pagination (page 1 might have limit)

---

## Alternative: Check Admin Panel Pagination

If admin panel only shows one user but database has more:

1. **Check pagination:**
   - Admin panel might be paginated (25 users per page)
   - Check if there are multiple pages
   - Look for pagination controls

2. **Check query parameters:**
   - Admin panel might filter by role/status
   - Check if filters are hiding users

3. **Check backend endpoint:**
   - `/api/users` endpoint has pagination (limit: 25)
   - Might need to increase limit or check multiple pages

---

## Prevention

To prevent this issue in the future:

1. **Always use unique constraints** (already in place)
2. **Clean up duplicates regularly** using the cleanup script
3. **Monitor user creation** for duplicate attempts
4. **Consider soft-delete** instead of hard-delete (mark as deleted, don't remove)

---

## Manual Database Check

If scripts don't work, you can check MongoDB directly:

```javascript
// Connect to MongoDB
use nuggets

// Count all users
db.users.countDocuments()

// List all users
db.users.find({}, { "auth.email": 1, "profile.username": 1, "profile.displayName": 1 })

// Find duplicate emails
db.users.aggregate([
  { $group: { _id: { $toLower: "$auth.email" }, count: { $sum: 1 }, userIds: { $push: "$_id" } } },
  { $match: { count: { $gt: 1 } } }
])

// Find duplicate usernames
db.users.aggregate([
  { $group: { _id: { $toLower: "$profile.username" }, count: { $sum: 1 }, userIds: { $push: "$_id" } } },
  { $match: { count: { $gt: 1 } } }
])
```

---

## Files Created

1. **`server/src/utils/diagnoseUserIssues.ts`**
   - Diagnostic script to list all users and find duplicates
   - Run: `npm run diagnose-users`

2. **`server/src/utils/cleanupDuplicateUsers.ts`**
   - Cleanup script to remove duplicate users
   - Dry run: `npm run cleanup-duplicates:dry-run`
   - Execute: `npm run cleanup-duplicates`

---

## Quick Fix Commands

```bash
# 1. Diagnose the issue
npm run diagnose-users

# 2. See what would be deleted (dry run)
npm run cleanup-duplicates:dry-run

# 3. Actually delete duplicates
npm run cleanup-duplicates

# 4. Verify fix
npm run diagnose-users
```

---

## If Issue Persists

If duplicates are cleaned but signup still fails:

1. **Check MongoDB indexes:**
   ```javascript
   db.users.getIndexes()
   ```
   Should show unique indexes on `auth.email` and `profile.username`

2. **Rebuild indexes if needed:**
   ```javascript
   db.users.reIndex()
   ```

3. **Check for case-sensitivity issues:**
   - Usernames are stored lowercase
   - Check if there are case variations causing conflicts

4. **Check for whitespace issues:**
   - Usernames are trimmed
   - Check if there are whitespace-only usernames

---

## Summary

The most likely cause is **duplicate users in the database** that aren't showing in the admin panel due to pagination or filtering. Use the diagnostic and cleanup scripts to identify and fix the issue.











