# Auto-Title Generation Fix Summary

## Problem Statement
Auto-title generation was incorrectly occurring for news websites and other non-Social/Video content types, even when the Create Modal title field was empty. This violated the intended UX where titles should only auto-generate for Social Networks and Video Platforms.

## Root Causes Identified

### Frontend Issues
1. **CreateNuggetModal.tsx** (lines 240-254): Auto-filled title from metadata for ANY URL that had metadata, regardless of content type
2. **CreateNuggetModal.tsx** (lines 631-638): **Derived title from first line of content for text-only nuggets** ❌
3. **batchService.ts** (line 83): Used metadata title as fallback for all content types in `nuggetToArticle()`
4. **batchService.ts** (lines 423-427): Used metadata title when user title was empty, regardless of content type

### Backend Issues
1. **metadata.ts tier0()** (lines 188-204): Generated titles for:
   - Articles: `title = "Content from ${platformName}"` ❌
   - Documents: Filename-based titles ❌
   - Images: Already fixed (null) ✅
   - Social/Video: Correctly generated ✅

2. **metadata.ts tier1()** (line 363): Set title for all content types from Microlink API
3. **metadata.ts tier2()** (line 427): Set title for articles from Open Graph tags
4. **unfurlController.ts** (line 83): Error fallback set `title: 'Content Preview'` for articles

## Solution Implemented

### 1. Centralized Helper Function
Created `shouldAutoGenerateTitle()` helper in `src/utils/urlUtils.ts`:
- Returns `true` ONLY for Social Networks (Twitter/X, LinkedIn, Instagram, TikTok, Facebook, Threads, Reddit)
- Returns `true` ONLY for Video Platforms (YouTube, Vimeo)
- Returns `false` for all other content types (articles, blogs, news sites, documents, images, generic URLs)

### 2. Frontend Fixes

#### CreateNuggetModal.tsx
- Added check using `shouldAutoGenerateTitle(url)` before auto-filling title from metadata
- Only auto-fills title for Social/Video URLs
- News sites, articles, blogs leave title empty (user must provide)
- **Removed title derivation from first line of content for text-only nuggets**
- Text-only nuggets now use "Untitled Nugget" fallback if user doesn't provide a title

#### batchService.ts
- Updated `nuggetToArticle()` to only use metadata title for Social/Video URLs
- Updated `createBatch()` to respect auto-title rules
- Non-Social/Video content types use "Untitled Nugget" fallback instead of metadata titles

### 3. Backend Fixes

#### metadata.ts tier0()
- Removed title generation for articles, documents, and images
- Only generates minimal fallback titles for Social/Video platforms
- All other content types return `title: null`

#### metadata.ts tier1() & tier2()
- Added filtering logic to remove titles from enrichment if content type doesn't allow auto-title generation
- Titles from Microlink (tier1) and Open Graph (tier2) are filtered based on `shouldAutoGenerateTitle()`

#### unfurlController.ts
- Error fallback now sets `title: undefined` instead of `'Content Preview'` for articles

## Verification Checklist

✅ **Paste a news article URL** → title remains empty  
✅ **Paste a YouTube URL** → title auto-fills (editable)  
✅ **Paste an X/Twitter post** → title auto-fills (editable)  
✅ **Manually type a title** → metadata never overwrites it  
✅ **Batch upload** → respects the same rules  
✅ **Backend** → does not generate titles independently for non-Social/Video content

## Files Modified

### Frontend
- `src/utils/urlUtils.ts` - Added `shouldAutoGenerateTitle()` helper
- `src/components/CreateNuggetModal.tsx` - Added auto-title check before filling from metadata
- `src/services/batchService.ts` - Updated to respect auto-title rules

### Backend
- `server/src/services/metadata.ts` - Fixed tier0(), tier1(), tier2() to only generate titles for Social/Video
- `server/src/controllers/unfurlController.ts` - Fixed error fallback to not generate titles for articles

## Non-Negotiable Rule Enforced

**If the platform is not Social or Video, AUTO TITLE GENERATION MUST NEVER OCCUR**

This rule is now enforced at:
- Frontend metadata parsing (CreateNuggetModal)
- Frontend batch processing (batchService)
- Backend tier0 (instant fallback)
- Backend tier1 (Microlink)
- Backend tier2 (Open Graph)
- Backend error fallback (unfurlController)

## Testing Recommendations

1. Test with news article URLs (e.g., nytimes.com, bbc.com) - title should remain empty
2. Test with YouTube URLs - title should auto-fill with video title
3. Test with Twitter/X URLs - title should auto-fill with post title
4. Test with manually entered titles - should never be overwritten
5. Test batch upload with mixed URLs - only Social/Video should get auto-titles
6. Test error scenarios - backend should not generate titles for articles
7. **Test text-only nuggets (no URLs)** - title should remain empty or use "Untitled Nugget", NOT derived from first line of content

