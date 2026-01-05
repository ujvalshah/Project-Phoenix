# YouTube/Video Content Rewrite Audit Report

**Date:** 2026-01-05  
**Objective:** Find legacy logic that rewrites or truncates `article.content` ONLY when a YouTube URL or media object is present.

## Executive Summary

**FINDING: No code found that rewrites or truncates `article.content` specifically when YouTube/video media is present.**

The audit examined all code paths that:
- Detect YouTube links or `media.type === 'youtube'` / `'video'`
- Modify or replace `content`, `excerpt`, or `description`
- Run inside `normalizeArticleInput`, media enrichment, or article controller
- Execute post-validation mutations in `createArticle` / `updateArticle`

**Result:** No such logic exists. Content modification is **media-agnostic** and applies uniformly to all articles regardless of media type.

---

## Code Paths Examined

### 1. `normalizeArticleInput` Function
**Location:** `src/shared/articleNormalization/normalizeArticleInput.ts`

**YouTube Detection:** None - function does not check for YouTube/video media.

**Content Modification:**
```typescript
// Lines 100-103: generateExcerpt function
function generateExcerpt(content: string, title: string): string {
  const excerptText = content.trim() || title || '';
  return excerptText.length > 150 ? excerptText.substring(0, 150) + '...' : excerptText;
}

// Line 601: Excerpt generation (same for CREATE and EDIT)
const excerpt = generateExcerpt(content, title);

// Line 833: Content trimming (media-agnostic)
content: content.trim() || '',
```

**Analysis:**
- ✅ **Does NOT modify `content`** - only generates `excerpt` from it
- ✅ **Media-agnostic** - applies to all articles regardless of media type
- ✅ **No YouTube-specific logic** - no conditional checks for YouTube/video

**When it runs:**
- CREATE mode: Always
- EDIT mode: Always

**Can overwrite user-entered content?** ❌ No - only generates excerpt, never modifies content.

**Affects:** CREATE and EDIT (both modes)

---

### 2. Media Enrichment (`enrichPlatformSpecific`)
**Location:** `server/src/services/metadata.ts` (lines 579-615)

**YouTube Detection:**
```typescript
// Lines 580-595: YouTube-specific enrichment
function enrichPlatformSpecific(nugget: Nugget, url: URL, domain: string): void {
  // YouTube specific
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      nugget.media = {
        type: 'image',
        src: thumbnailUrl,
        width: 1280,
        height: 720,
        aspectRatio: 1280 / 720,
        renderMode: 'cover',
        isEstimated: false,
      };
      nugget.description = nugget.description || 'Watch on YouTube →';
    }
  }
  // ... other platform logic
}
```

**Analysis:**
- ✅ **Does NOT modify `content`** - only sets `description` (fallback text)
- ✅ **Operates on `Nugget` objects** - not `Article` objects
- ✅ **No content truncation** - only sets media metadata

**When it runs:**
- During URL metadata fetching (unfurl process)
- Before article creation (frontend metadata enrichment)

**Can overwrite user-entered content?** ❌ No - operates on `Nugget` objects, not `Article.content`.

**Affects:** CREATE only (metadata fetching phase)

---

### 3. Article Controllers (`createArticle` / `updateArticle`)
**Location:** `server/src/controllers/articlesController.ts`

**YouTube Detection:** None - controllers do not check for YouTube/video media.

**Content Modification:**
```typescript
// Lines 227-493: createArticle
// Lines 495-754: updateArticle
```

**Analysis:**
- ✅ **No content modification** - controllers only validate and save data
- ✅ **No post-validation mutations** - content is saved as-is
- ✅ **No YouTube-specific logic** - no conditional checks for YouTube/video

**When it runs:**
- CREATE: After frontend normalization, before database save
- EDIT: After frontend normalization, before database update

**Can overwrite user-entered content?** ❌ No - controllers are pass-through, no mutations.

**Affects:** CREATE and EDIT (both modes)

---

### 4. Database Transformation (`transformArticle`)
**Location:** `server/src/utils/db.ts` (lines 180-230)

**YouTube Detection:** None - function does not check for YouTube/video media.

**Content Modification:**
```typescript
// Line 199: Excerpt generation (fallback only)
excerpt: rest.excerpt || (rest.content ? rest.content.substring(0, 150) + '...' : ''),

// Line 200: Content preservation
content: rest.content || '',
```

**Analysis:**
- ✅ **Does NOT modify `content`** - only generates `excerpt` if missing
- ✅ **Media-agnostic** - applies to all articles regardless of media type
- ✅ **Read-only transformation** - converts DB format to frontend format

**When it runs:**
- When reading articles from database (GET requests)
- Before sending response to frontend

**Can overwrite user-entered content?** ❌ No - read-only transformation, never modifies stored content.

**Affects:** READ operations only (not CREATE/EDIT)

---

### 5. Frontend Components (`CreateNuggetModal`)
**Location:** `src/components/CreateNuggetModal.tsx`

**YouTube Detection:**
```typescript
// Lines 388-399: YouTube detection for title suggestions
const isYouTubeOrSocial = primaryUrl && (
  primaryUrl.includes('youtube.com') || 
  primaryUrl.includes('youtu.be') ||
  // ... other social platforms
);
```

**Content Modification:**
- ❌ **No content modification** - only affects title suggestions
- ❌ **No truncation logic** - content is passed through unchanged

**Analysis:**
- ✅ **Does NOT modify `content`** - only disables auto-title suggestions
- ✅ **No YouTube-specific content handling** - content field is untouched

**When it runs:**
- During URL metadata fetching
- Before article submission

**Can overwrite user-entered content?** ❌ No - only affects title suggestions.

**Affects:** CREATE and EDIT (both modes)

---

## Summary of Findings

### ✅ No Content Rewrite Logic Found

1. **`normalizeArticleInput`**: Generates excerpts but never modifies content
2. **Media enrichment**: Sets `description` on `Nugget` objects, not `Article.content`
3. **Article controllers**: Pass-through, no mutations
4. **Database transformation**: Read-only, generates excerpts but doesn't modify content
5. **Frontend components**: No content modification logic

### ✅ Content Modification is Media-Agnostic

All content processing functions apply uniformly to all articles:
- `generateExcerpt()` - applies to all articles
- `content.trim()` - applies to all articles
- Excerpt fallback generation - applies to all articles

**No conditional logic exists that checks for YouTube/video media before modifying content.**

### ✅ No Post-Validation Mutations

- `createArticle`: No mutations after validation
- `updateArticle`: No mutations after validation (except tag normalization)

---

## Edge Cases Examined

### 1. Content → Excerpt Reassignment
**Status:** ❌ Not found  
**Location:** N/A  
**Behavior:** Excerpt is generated from content, but content is never replaced with excerpt.

### 2. Truncate / Substring / Ellipsis Logic
**Status:** ✅ Found (media-agnostic)  
**Location:** `normalizeArticleInput.ts:102`, `db.ts:199`  
**Behavior:** Only used for excerpt generation (max 150 chars), never truncates content.

### 3. CREATE-mode Logic in EDIT
**Status:** ❌ Not found  
**Location:** N/A  
**Behavior:** `normalizeArticleInput` has separate `buildMediaObjectCreate` and `buildMediaObjectEdit` functions. No content modification in either.

### 4. Post-Validation Mutations
**Status:** ❌ Not found  
**Location:** N/A  
**Behavior:** Controllers save data as-is after validation. No content mutations.

---

## Recommendations

### 1. If Content Truncation is Observed
If users report content being truncated when YouTube URLs are present, investigate:
- **Frontend display logic** - check `CardContent.tsx` for truncation (UI-only, not data mutation)
- **Browser/network issues** - check if content is being truncated during transmission
- **Database constraints** - verify MongoDB document size limits aren't causing truncation

### 2. If Legacy Code Exists Elsewhere
- Search for commented-out code in git history
- Check for feature flags that might disable content modification
- Review migration scripts that might have legacy logic

### 3. Future Prevention
- Add unit tests to prevent content modification based on media type
- Add integration tests to verify content preservation during CREATE/EDIT
- Document that content modification must be media-agnostic

---

## Conclusion

**No legacy logic exists that rewrites or truncates `article.content` specifically when YouTube URLs or video media objects are present.**

All content processing is:
- ✅ Media-agnostic
- ✅ Preserves user-entered content
- ✅ Only generates excerpts (doesn't modify content)
- ✅ No conditional YouTube/video checks

If content truncation is observed in production, it is likely:
1. A frontend display issue (CSS truncation, not data mutation)
2. A database constraint issue (document size limits)
3. A network/transmission issue
4. Legacy code that has since been removed

---

## Files Examined

1. `src/shared/articleNormalization/normalizeArticleInput.ts` - Main normalization logic
2. `server/src/services/metadata.ts` - Media enrichment
3. `server/src/controllers/articlesController.ts` - CREATE/UPDATE endpoints
4. `server/src/utils/db.ts` - Database transformation
5. `src/components/CreateNuggetModal.tsx` - Frontend article creation
6. `src/utils/urlUtils.ts` - URL detection utilities
7. `server/src/utils/validation.ts` - Validation schemas

---

**Audit completed:** 2026-01-05  
**Auditor:** Code analysis tool  
**Status:** ✅ No issues found - content modification is media-agnostic

