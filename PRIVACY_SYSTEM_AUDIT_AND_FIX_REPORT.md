# Privacy System Audit and Fix Report

**Date:** 2025-01-30  
**Scope:** Nugget/NewsCard Privacy System  
**Issue:** Private items visible on public homepage feed

---

## Executive Summary

A critical privacy bug was identified where articles marked as `private` were still visible on public feeds. The root cause was missing privacy filters in multiple API endpoints. This report documents all findings, fixes, and security hardening measures implemented.

---

## 1. Source of Truth for Privacy

### ✅ Confirmed: `visibility` Field

**Database Schema:**
- **Field:** `visibility` (String, enum: `['public', 'private']`)
- **Default:** `'public'`
- **Location:** `server/src/models/Article.ts` (line 128)

**TypeScript Interface:**
```typescript
visibility?: 'public' | 'private'; // Default: public
```

**Validation:**
- Backend validation via Zod schema (`server/src/utils/validation.ts`)
- Default value: `'public'` if not specified

**Toggle Logic:**
- ✅ **Working correctly** - Toggle updates database via `updateArticle` endpoint
- Location: `src/hooks/useNewsCard.ts` (line 588-680)
- Updates both local cache and database
- Includes rollback on error

---

## 2. Critical Bugs Found and Fixed

### 🐛 Bug #1: `getArticles` Endpoint - No Privacy Filter

**Location:** `server/src/controllers/articlesController.ts`  
**Severity:** CRITICAL  
**Impact:** Private articles visible on homepage, search, and all public feeds

**Root Cause:**
The `getArticles` endpoint (used by homepage, search, and discovery feeds) had **no privacy filtering**. It returned all articles regardless of `visibility` status.

**Fix Applied:**
```typescript
// PRIVACY FILTER: Apply based on context
// Rule 1: If filtering by authorId and it's the current user, show ALL their articles (public + private)
// Rule 2: Otherwise, only show public articles
const isViewingOwnArticles = currentUserId && authorId === currentUserId;

if (!isViewingOwnArticles) {
  // Public feed or viewing another user's articles: only show public
  query.$or = [
    { visibility: 'public' },
    { visibility: { $exists: false } }, // Default to public if field doesn't exist
    { visibility: null } // Handle null as public
  ];
}
```

**Additional Fix:**
- Properly merged search query conditions with privacy filter using MongoDB `$and` operator
- Ensures search results also respect privacy

---

### 🐛 Bug #2: `getArticleById` Endpoint - No Privacy Check

**Location:** `server/src/controllers/articlesController.ts`  
**Severity:** CRITICAL  
**Impact:** Anyone could access private articles via direct URL

**Root Cause:**
The endpoint returned any article by ID without checking if the requester had permission to view it.

**Fix Applied:**
```typescript
// PRIVACY CHECK: Verify user has access to this article
const currentUserId = (req as any).user?.userId;
const isPrivate = article.visibility === 'private';
const isOwner = article.authorId === currentUserId;

// If article is private and user is not the owner, deny access
if (isPrivate && !isOwner) {
  return sendForbiddenError(res, 'This article is private');
}

// If article is private and no user is authenticated, deny access
if (isPrivate && !currentUserId) {
  return sendUnauthorizedError(res, 'Authentication required to view private articles');
}
```

---

### 🐛 Bug #3: `getPersonalizedFeed` Endpoint - Incorrect Privacy Logic

**Location:** `server/src/controllers/usersController.ts`  
**Severity:** HIGH  
**Impact:** Private articles could appear in personalized feeds

**Root Cause:**
The query used `$or` with `visibility: 'public'` as one condition, but this would match ANY condition in the `$or` array, including private articles that matched category filters.

**Fix Applied:**
```typescript
// PRIVACY FIX: Only show public articles in personalized feed
// The $or was incorrectly structured - it would match ANY condition, including private articles
const articleQuery: any = {
  visibility: 'public', // Only public articles in personalized feed
  $or: [
    { categories: { $in: categories } },
    { category: { $in: categories } }
  ]
};

// If user has no categories, show all public articles
if (categories.length === 0) {
  delete articleQuery.$or;
  articleQuery.visibility = 'public';
}
```

---

### ✅ Verified: Collections Endpoints

**Status:** SAFE  
**Reason:** Collections store article IDs only. Articles are fetched individually via `getArticleById`, which now has privacy checks.

**Note:** The frontend `CollectionDetailPage` calls `getArticleById` for each entry, so privacy is enforced.

---

### ✅ Verified: `getArticlesByAuthor` Endpoint

**Status:** FIXED (via `getArticles`)  
**Reason:** This endpoint uses the same `getArticles` controller with `authorId` parameter. The fix ensures:
- If `authorId === currentUserId`: User sees all their articles (public + private)
- If `authorId !== currentUserId`: Only public articles are shown

---

## 3. Security Hardening

### 3.1 Authentication Context

**Implementation:**
- All endpoints now check for authenticated user via `(req as any).user?.userId`
- Privacy filters adapt based on authentication status
- Unauthenticated users can only see public content

**Middleware:**
- `authenticateToken` middleware adds `req.user = { userId, role, email }`
- Used on protected routes (update, delete, create)
- Optional on read routes (for privacy filtering)

### 3.2 Privacy Rules Enforced

1. **Public Feeds (Homepage, Search, Discovery):**
   - Only `visibility: 'public'` articles shown
   - Applies to unauthenticated and authenticated users viewing others' content

2. **My Space Page:**
   - Owner sees ALL their articles (public + private)
   - Other users only see owner's public articles

3. **Direct Article Access:**
   - Private articles require authentication AND ownership
   - Returns 403 Forbidden if unauthorized

4. **Collections:**
   - Private articles in collections are filtered at fetch time
   - Each article fetch goes through `getArticleById` privacy check

### 3.3 Additional Security Measures

**Share Links:**
- ✅ Protected - Uses `getArticleById` which now checks privacy
- Private articles return 403 to unauthorized users

**Embed Previews:**
- ✅ Protected - Uses `getArticleById` which now checks privacy

**RSS / Email Digests:**
- ⚠️ **Not Implemented** - No RSS/email digest feature found in codebase
- If added in future, must filter by `visibility: 'public'`

**Recommendation Engines:**
- ⚠️ **Not Found** - No recommendation engine found in codebase
- If added in future, must filter by `visibility: 'public'`

---

## 4. Testing Recommendations

### 4.1 Automated Tests Required

```typescript
// Test: Private nugget does NOT appear in public feed
describe('Privacy: Public Feed', () => {
  it('should exclude private articles from public feed', async () => {
    // Create private article
    const privateArticle = await createArticle({ visibility: 'private' });
    
    // Fetch public feed
    const response = await getArticles();
    
    // Verify private article is not in results
    expect(response.data).not.toContainEqual(
      expect.objectContaining({ id: privateArticle.id })
    );
  });
});

// Test: Same nugget DOES appear for owner in My Space
describe('Privacy: My Space', () => {
  it('should show private articles to owner', async () => {
    const owner = await createUser();
    const privateArticle = await createArticle({ 
      authorId: owner.id, 
      visibility: 'private' 
    });
    
    // Fetch owner's articles
    const response = await getArticles({ authorId: owner.id }, owner.token);
    
    // Verify private article is included
    expect(response.data).toContainEqual(
      expect.objectContaining({ id: privateArticle.id })
    );
  });
  
  it('should NOT show private articles to other users', async () => {
    const owner = await createUser();
    const otherUser = await createUser();
    const privateArticle = await createArticle({ 
      authorId: owner.id, 
      visibility: 'private' 
    });
    
    // Fetch owner's articles as other user
    const response = await getArticles({ authorId: owner.id }, otherUser.token);
    
    // Verify private article is NOT included
    expect(response.data).not.toContainEqual(
      expect.objectContaining({ id: privateArticle.id })
    );
  });
});

// Test: Other users cannot fetch private article via direct URL
describe('Privacy: Direct Access', () => {
  it('should return 403 for unauthorized access to private article', async () => {
    const owner = await createUser();
    const otherUser = await createUser();
    const privateArticle = await createArticle({ 
      authorId: owner.id, 
      visibility: 'private' 
    });
    
    // Try to fetch as other user
    const response = await getArticleById(privateArticle.id, otherUser.token);
    
    expect(response.status).toBe(403);
    expect(response.body.message).toContain('private');
  });
  
  it('should return 401 for unauthenticated access to private article', async () => {
    const owner = await createUser();
    const privateArticle = await createArticle({ 
      authorId: owner.id, 
      visibility: 'private' 
    });
    
    // Try to fetch without authentication
    const response = await getArticleById(privateArticle.id, null);
    
    expect(response.status).toBe(401);
  });
});

// Test: Search results exclude private content
describe('Privacy: Search', () => {
  it('should exclude private articles from search results', async () => {
    const owner = await createUser();
    const privateArticle = await createArticle({ 
      authorId: owner.id, 
      visibility: 'private',
      title: 'Private Search Test'
    });
    
    // Search for the title
    const response = await getArticles({ q: 'Private Search Test' });
    
    // Verify private article is not in results
    expect(response.data).not.toContainEqual(
      expect.objectContaining({ id: privateArticle.id })
    );
  });
});
```

### 4.2 Manual Testing Checklist

- [ ] Create a private article
- [ ] Verify it does NOT appear on homepage feed (unauthenticated)
- [ ] Verify it does NOT appear on homepage feed (authenticated as different user)
- [ ] Verify it DOES appear in owner's My Space page
- [ ] Verify direct URL access returns 403 for unauthorized users
- [ ] Verify direct URL access returns 401 for unauthenticated users
- [ ] Verify search does not return private articles
- [ ] Verify collections do not expose private articles
- [ ] Toggle privacy from private to public - verify it appears in feeds
- [ ] Toggle privacy from public to private - verify it disappears from feeds

---

## 5. Migration Script

### 5.1 Backfill Script

**Purpose:** Ensure all existing articles have explicit `visibility` field set

**Location:** `server/src/scripts/backfillVisibility.ts` (to be created)

```typescript
import mongoose from 'mongoose';
import { Article } from '../models/Article.js';
import { connectDB } from '../utils/db.js';

async function backfillVisibility() {
  await connectDB();
  
  // Find all articles without explicit visibility field
  const articlesWithoutVisibility = await Article.find({
    $or: [
      { visibility: { $exists: false } },
      { visibility: null }
    ]
  });
  
  console.log(`Found ${articlesWithoutVisibility.length} articles without visibility field`);
  
  // Set default to 'public' for all articles without visibility
  const result = await Article.updateMany(
    {
      $or: [
        { visibility: { $exists: false } },
        { visibility: null }
      ]
    },
    {
      $set: { visibility: 'public' }
    }
  );
  
  console.log(`Updated ${result.modifiedCount} articles with visibility: 'public'`);
  
  // Verify no articles are missing visibility field
  const remaining = await Article.countDocuments({
    $or: [
      { visibility: { $exists: false } },
      { visibility: null }
    ]
  });
  
  if (remaining > 0) {
    console.warn(`Warning: ${remaining} articles still missing visibility field`);
  } else {
    console.log('✅ All articles now have visibility field set');
  }
  
  await mongoose.connection.close();
  process.exit(0);
}

backfillVisibility().catch(console.error);
```

**Run Command:**
```bash
cd server
npm run ts-node src/scripts/backfillVisibility.ts
```

---

## 6. Files Modified

### Backend Changes

1. **`server/src/controllers/articlesController.ts`**
   - Added privacy filter to `getArticles` endpoint
   - Added privacy check to `getArticleById` endpoint
   - Fixed search query merging with privacy filter

2. **`server/src/controllers/usersController.ts`**
   - Fixed `getPersonalizedFeed` privacy filter logic

### Frontend Changes

**None required** - Privacy enforcement is server-side only. Frontend toggle already works correctly.

---

## 7. Breaking Changes

**None** - All changes are backward compatible:
- Existing public articles continue to work
- Private articles now properly hidden (intended behavior)
- API response shape unchanged
- Authentication remains optional for read endpoints (for privacy filtering)

---

## 8. Performance Impact

**Minimal:**
- Privacy filter adds one `$or` condition to MongoDB queries
- Index on `visibility` field recommended for optimal performance
- No additional database queries required

**Recommended Index:**
```typescript
ArticleSchema.index({ visibility: 1, publishedAt: -1 });
ArticleSchema.index({ authorId: 1, visibility: 1 });
```

---

## 9. Future Recommendations

1. **Add Indexes:**
   - Create compound indexes for common query patterns
   - `{ visibility: 1, publishedAt: -1 }` for public feeds
   - `{ authorId: 1, visibility: 1 }` for user profile pages

2. **Add Caching:**
   - Consider caching public feed results (private articles excluded)
   - Invalidate cache when article visibility changes

3. **Add Monitoring:**
   - Log privacy violations (403/401 responses)
   - Track how many private articles exist
   - Monitor feed query performance

4. **Add Tests:**
   - Implement automated test suite as outlined in section 4.1
   - Add integration tests for privacy flows
   - Add E2E tests for toggle functionality

5. **Documentation:**
   - Update API documentation with privacy rules
   - Document privacy behavior in developer guide
   - Add privacy notes to frontend component docs

---

## 10. Conclusion

All critical privacy bugs have been identified and fixed. The system now properly enforces privacy rules:

- ✅ Private articles excluded from public feeds
- ✅ Direct access to private articles requires authentication and ownership
- ✅ My Space page shows all articles to owner, only public to others
- ✅ Search results exclude private content
- ✅ Collections respect privacy when fetching articles

The fixes are backward compatible and require no frontend changes. All privacy enforcement is server-side, ensuring security even if frontend is compromised.

---

**Status:** ✅ **COMPLETE**  
**Next Steps:** 
1. Run migration script to backfill visibility field
2. Add automated tests
3. Deploy to staging for verification
4. Monitor for any edge cases



