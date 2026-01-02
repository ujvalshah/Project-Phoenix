# Payload Audit & Discrepancy Report
  
Generated: 2025-12-11T20:54:38.639Z

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| High     | 0 | - |
| Medium   | 3 | - |
| Low      | 5 | - |

| Status   | Count |
|----------|-------|
| Open     | 3 |
| Resolved | 5 |

## API Contract Overview

### Nuggets (/api/nuggets)
- `POST /` - Create nugget (auth required)
- `GET /` - List nuggets (auth optional)
- `GET /:id` - Get single nugget (auth optional)
- `PUT /:id` - Update nugget (auth required)
- `PATCH /:id` - Partial update (auth required)
- `DELETE /:id` - Soft delete (auth required)

### Collections (/api/collections)
- `POST /` - Create collection (auth required)
- `GET /` - List collections (auth optional)
- `GET /:id` - Get collection with nuggets (auth optional)
- `PUT /:id` - Update collection (auth required)
- `DELETE /:id` - Soft delete (auth required)
- `POST /:id/add-nugget` - Add nugget to collection (auth required)
- `POST /:id/remove-nugget/:nuggetId` - Remove nugget (auth required)
- `POST /:id/follow` - Follow collection (auth required)
- `POST /:id/unfollow` - Unfollow collection (auth required)

### Bookmark Folders (/api/bookmark-folders)
- `POST /` - Create folder (auth required)
- `GET /` - List folders (auth required)
- `GET /:id` - Get folder with bookmarks (auth required)
- `PUT /:id` - Update folder (auth required)
- `DELETE /:id` - Delete folder (auth required)

### Bookmarks (via /api/nuggets/:id)
- `POST /:id/bookmark` - Bookmark nugget (auth required)
- `POST /:id/unbookmark` - Remove bookmark (auth required)

---

## Discrepancies Found

### 🔴 Open Issues (3)

#### NUGGET-UPDATE-001: Frontend RestAdapter.updateArticle sends raw Article object, but backend expects Nugget schema fields

- **Severity:** medium
- **Resource:** Nugget
- **Operation:** UPDATE (PUT /api/nuggets/:id)

**Frontend:**
- File: `src/services/adapters/RestAdapter.ts`
- Line: 146
```typescript
async updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
  return apiClient.put<Article>(`/nuggets/${id}`, updates);
}
```

**Backend:**
- File: `server/src/controllers/nuggetsController.ts`
- Line: 497
```typescript
const validated = updateNuggetSchema.parse(req.body);
```

**Fix:** Frontend should transform Article fields to Nugget fields before sending (e.g., content -> contentMarkdown)

---

#### NUGGET-CREATE-001: Tags are expected as array but could be sent as comma-separated string

- **Severity:** low
- **Resource:** Nugget
- **Operation:** CREATE (POST /api/nuggets)

**Frontend:**
- File: `src/services/adapters/RestAdapter.ts`
- Line: 124
```typescript
if (article.tags && article.tags.length > 0) {
  payload.tags = article.tags;
}
```

**Backend:**
- File: `server/src/controllers/nuggetsController.ts`
- Line: 21
```typescript
tags: z.array(z.string()).optional(),
```

**Fix:** Backend should normalize tags: accept both array and comma-separated string

---

#### HTTP-METHOD-001: Frontend apiClient only has PUT, backend supports both PUT and PATCH

- **Severity:** low
- **Resource:** All
- **Operation:** UPDATE

**Frontend:**
- File: `src/services/apiClient.ts`
- Line: 107
```typescript
put<T>(url: string, body: any, headers?: HeadersInit) {
  return this.request<T>(url, { method: 'PUT', body: JSON.stringify(body), headers });
}
// No patch() method
```

**Backend:**
- File: `server/src/routes/articles.ts`
- Line: 15
```typescript
router.patch('/:id', requireAuth, nuggetsController.updateNugget);
```

**Fix:** Add patch() method to apiClient for partial updates

---

### ✅ Resolved/Working as Intended (5)

#### RESPONSE-FORMAT-001: Frontend apiClient expects { success, data } format but sometimes accesses response directly

- **Severity:** low
- **Resource:** All
- **Operation:** All responses

**Frontend:**
- File: `src/services/adapters/RestAdapter.ts`
- Line: 9-11, 132-135
```typescript
// Line 9-11: Checks for response.success && response.data
// Line 132-135: Sometimes returns response as Article directly
```

**Backend:**
- File: `All controllers`

```typescript
res.json({ success: true, data: ... })
```

**Fix:** Already handled - apiClient extracts data from { success, data } wrapper. No action needed.

---

#### NUGGET-CREATE-002: Categories can be sent as names or slugs, backend resolves them differently

- **Severity:** low
- **Resource:** Nugget
- **Operation:** CREATE (POST /api/nuggets)

**Frontend:**
- File: `src/services/adapters/RestAdapter.ts`
- Line: 118
```typescript
if (article.categories && article.categories.length > 0) {
  payload.categories = article.categories;
}
```

**Backend:**
- File: `server/src/controllers/nuggetsController.ts`
- Line: 427
```typescript
for (const catName of validated.categories) {
  let category = await Category.findOne({ 
    $or: [
      { slug: catName.toLowerCase() },
      { name: new RegExp(`^${catName}$`, 'i') },
    ],
    status: 'approved',
  });
```

**Fix:** Already handled - backend accepts both name and slug. No action needed.

---

#### COLLECTION-CREATE-001: Frontend sends `type` but backend expects `visibility` for public/private

- **Severity:** medium
- **Resource:** Collection
- **Operation:** CREATE (POST /api/collections)

**Frontend:**
- File: `src/services/adapters/RestAdapter.ts`
- Line: 301
```typescript
async createCollection(name: string, description: string, creatorId: string, type: 'public' | 'private'): Promise<Collection> {
  const response = await apiClient.post<...>('/collections', {
    name: name.trim(),
    description: description.trim(),
    visibility: type, // Maps type -> visibility
  });
```

**Backend:**
- File: `server/src/controllers/collectionsController.ts`
- Line: 14
```typescript
visibility: z.enum(['public', 'private']).optional().default('private'),
```

**Fix:** Already handled - Frontend correctly maps type to visibility. No action needed.

---

#### BOOKMARK-FOLDER-001: Backend returns folder in Collection format for frontend compatibility

- **Severity:** low
- **Resource:** BookmarkFolder
- **Operation:** CREATE (POST /api/bookmark-folders)

**Frontend:**
- File: `src/services/adapters/RestAdapter.ts`
- Line: 389
```typescript
async createBookmarkFolder(name: string, description?: string): Promise<Collection>
```

**Backend:**
- File: `server/src/controllers/bookmarkFoldersController.ts`
- Line: 37
```typescript
function folderToCollection(folder: any, userId: string): any {
  return {
    id: folder._id.toString(),
    name: folder.name,
    type: 'private',
    visibility: 'private',
    ...
  };
}
```

**Fix:** Working as intended - folder converts to Collection format. No action needed.

---

#### COLLECTION-ADD-001: Frontend uses isBookmarkFolder flag to route to different endpoints, could be simplified

- **Severity:** medium
- **Resource:** Collection/Bookmark
- **Operation:** ADD (POST /api/collections/:id/add-nugget OR /api/nuggets/:id/bookmark)

**Frontend:**
- File: `src/services/adapters/RestAdapter.ts`
- Line: 361
```typescript
async addArticleToCollection(collectionId: string, articleId: string, _userId: string, isBookmarkFolder: boolean = false): Promise<void> {
  if (isBookmarkFolder) {
    await apiClient.post(`/nuggets/${articleId}/bookmark`, { folderId: collectionId });
  } else {
    await apiClient.post(`/collections/${collectionId}/add-nugget`, { nuggetId: articleId });
  }
}
```

**Backend:**
- File: `Multiple controllers`

```typescript
Different endpoints handle collections vs bookmarks
```

**Fix:** Working as intended - different resources need different endpoints. Consider unified API in future.

---


---

## Recommended Fixes

### Priority 1: Update Nugget Payload Transformation

The `RestAdapter.updateArticle` should transform Article fields to Nugget schema:

```typescript
async updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
  // Transform Article -> Nugget payload
  const payload: any = {};
  
  if (updates.content !== undefined) {
    payload.contentMarkdown = updates.content;
  }
  if (updates.categories !== undefined) {
    payload.categories = updates.categories;
  }
  if (updates.tags !== undefined) {
    payload.tags = updates.tags;
  }
  if (updates.visibility !== undefined) {
    payload.visibility = updates.visibility;
  }
  
  return apiClient.put<Article>(`/nuggets/${id}`, payload);
}
```

### Priority 2: Add PATCH Method to apiClient

```typescript
patch<T>(url: string, body: any, headers?: HeadersInit) {
  return this.request<T>(url, { method: 'PATCH', body: JSON.stringify(body), headers });
}
```

### Priority 3: Backend Tags Normalization

Accept both array and comma-separated string for tags:

```typescript
// In createNuggetSchema
tags: z.union([
  z.array(z.string()),
  z.string().transform(s => s.split(',').map(t => t.trim()).filter(Boolean))
]).optional(),
```

---

## Testing Checklist

- [ ] Create nugget with URL only (no content)
- [ ] Create nugget with content only
- [ ] Create nugget with attachments
- [ ] Update nugget content
- [ ] Delete and restore nugget
- [ ] Create collection (public)
- [ ] Create collection (private)
- [ ] Add nugget to collection
- [ ] Remove nugget from collection
- [ ] Follow/unfollow collection
- [ ] Create bookmark folder
- [ ] Bookmark nugget (with and without folder)
- [ ] Move bookmark between folders
- [ ] Delete bookmark folder

---

## Conclusion

The codebase has a well-structured API with proper separation between frontend and backend.
Most discrepancies are minor and already handled through normalization.

**Action Items:**
1. Fix updateArticle payload transformation (medium priority)
2. Add PATCH method to apiClient (low priority)
3. Add backend tags normalization (low priority)

