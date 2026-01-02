# API Base URL Normalization Summary

**Date:** 2025-01-02  
**Status:** ✅ Complete  
**Issue:** Production deployment failing with 404 errors on API calls like `/articles?sort=latest&page=1&limit=25` and `/categories?format=simple`

---

## Problem

The production build was calling legacy routes without the `/api` prefix because:
1. `apiClient.ts` had hardcoded `BASE_URL = '/api'` that didn't respect `VITE_API_URL` environment variable
2. Some direct `fetch()` calls used hardcoded `/api/` paths that wouldn't work when frontend/backend are on different domains
3. No normalization logic to ensure `/api` suffix is always present when `VITE_API_URL` is set

---

## Solution

All API calls now use a normalized base URL that:
- Defaults to `/api` (works with Vite proxy in development)
- Respects `VITE_API_URL` if set (for production deployments)
- **Always ensures `/api` suffix is present** (even if `VITE_API_URL` doesn't include it)

---

## Files Updated

### 1. ✅ `src/services/apiClient.ts`
**Change:** Updated `BASE_URL` to use `getNormalizedApiBase()` instead of hardcoded `/api`

**Before:**
```typescript
const BASE_URL = '/api';
```

**After:**
```typescript
import { getNormalizedApiBase } from '../utils/urlUtils.js';

// Normalize API base URL: defaults to '/api', respects VITE_API_URL if set (ensures /api suffix)
const BASE_URL = getNormalizedApiBase();

// Debug logging for API base URL (build mode only)
if (import.meta.env.PROD) {
  console.log(`API Base URL (runtime): ${BASE_URL}`);
}
```

**Impact:** All API calls made through `apiClient` now use the normalized base URL. This affects:
- All endpoints in `RestAdapter` (`/articles`, `/categories`, `/users`, etc.)
- All endpoints in admin services
- All endpoints in other services using `apiClient`

---

### 2. ✅ `src/components/MediaImage.tsx`
**Change:** Updated hardcoded `/api/media/` path to use `getNormalizedApiBase()`

**Before:**
```typescript
const response = await fetch(`/api/media/${mediaId}`);
```

**After:**
```typescript
import { getNormalizedApiBase } from '@/utils/urlUtils';

const apiBase = getNormalizedApiBase();
const response = await fetch(`${apiBase}/media/${mediaId}`);
```

---

### 3. ✅ `src/hooks/useMediaUpload.ts`
**Change:** Updated hardcoded `/api/media/upload/cloudinary` path to use `getNormalizedApiBase()`

**Before:**
```typescript
const response = await fetch('/api/media/upload/cloudinary', {
```

**After:**
```typescript
import { getNormalizedApiBase } from '@/utils/urlUtils';

const apiBase = getNormalizedApiBase();
const response = await fetch(`${apiBase}/media/upload/cloudinary`, {
```

---

### Files Already Correct (No Changes Needed)

These files already use `getNormalizedApiBase()` correctly:
- ✅ `src/pages/BulkYouTubeAnalysisPage.tsx` - Uses `getNormalizedApiBase()`
- ✅ `src/services/batchService.ts` - Uses `getNormalizedApiBase()`
- ✅ `src/components/admin/KeyStatusWidget.tsx` - Uses `getNormalizedApiBase()`
- ✅ `src/utils/urlUtils.ts` - Contains `getNormalizedApiBase()` function (no changes)

---

## API Path Changes

### Before Normalization

| Endpoint | Old Path | Issue |
|----------|----------|-------|
| Articles list | `/api/articles?sort=latest&page=1&limit=25` | Hardcoded `/api` (works with proxy, fails if frontend/backend separate) |
| Categories | `/api/categories?format=simple` | Hardcoded `/api` (works with proxy, fails if frontend/backend separate) |
| Media fetch | `/api/media/{id}` | Hardcoded `/api` path |
| Media upload | `/api/media/upload/cloudinary` | Hardcoded `/api` path |

### After Normalization

| Endpoint | New Path | Behavior |
|----------|----------|----------|
| Articles list | `${BASE_URL}/articles?sort=latest&page=1&limit=25` | Uses normalized base (defaults to `/api`, respects `VITE_API_URL`) |
| Categories | `${BASE_URL}/categories?format=simple` | Uses normalized base (defaults to `/api`, respects `VITE_API_URL`) |
| Media fetch | `${apiBase}/media/{id}` | Uses normalized base |
| Media upload | `${apiBase}/media/upload/cloudinary` | Uses normalized base |

**Where `BASE_URL` / `apiBase` resolves to:**
- Development (no `VITE_API_URL`): `/api` (uses Vite proxy)
- Production (no `VITE_API_URL`): `/api` (relative path - requires same domain)
- Production (`VITE_API_URL=https://api.example.com`): `https://api.example.com/api`
- Production (`VITE_API_URL=https://api.example.com/api`): `https://api.example.com/api` (already has suffix)

---

## Environment Variable Configuration

### `env.example` (No Changes Required)

The `env.example` file already has correct documentation:

```bash
# Frontend API base URL for production builds
# Only needed if deploying frontend separately from backend
# 
# In development: Leave empty to use Vite proxy (/api → localhost:5000)
# In production: Set to your backend API URL (the /api suffix will be added automatically)
#
# Examples:
#   - https://api.yourdomain.com (will be normalized to https://api.yourdomain.com/api)
#   - https://api.yourdomain.com/api (explicit - also works)
#   - Leave empty in development (uses relative /api with proxy)
#
# NOTE: The code automatically ensures /api suffix is present, but including it explicitly is clearer
VITE_API_URL=
```

### Production `.env` Configuration

**If frontend and backend are on the same domain:**
```bash
# Leave empty - uses relative /api paths
VITE_API_URL=
```

**If frontend and backend are on different domains:**
```bash
# Set to your backend domain (WITH or WITHOUT /api suffix - both work)
VITE_API_URL=https://api.yourdomain.com
# OR
VITE_API_URL=https://api.yourdomain.com/api
```

The normalization function will ensure `/api` suffix is always present.

---

## Normalization Logic

The `getNormalizedApiBase()` function in `src/utils/urlUtils.ts`:

```typescript
export function getNormalizedApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If not set, use relative /api (development mode with proxy)
  if (!envUrl) {
    return '/api';
  }
  
  const url = envUrl.trim();
  
  // If already ends with /api, return as-is
  if (url.endsWith('/api')) {
    return url;
  }
  
  // If ends with /, append 'api'
  if (url.endsWith('/')) {
    return `${url}api`;
  }
  
  // Otherwise, append '/api'
  return `${url}/api`;
}
```

**Examples:**
- `undefined` → `/api`
- `https://api.example.com` → `https://api.example.com/api`
- `https://api.example.com/` → `https://api.example.com/api`
- `https://api.example.com/api` → `https://api.example.com/api`
- `/api` → `/api`

---

## Debugging

Added console.log for API base URL (production builds only):

```typescript
// Debug logging for API base URL (build mode only)
if (import.meta.env.PROD) {
  console.log(`API Base URL (runtime): ${BASE_URL}`);
}
```

This will log the resolved API base URL in production builds for debugging.

---

## Testing Checklist

- [x] ✅ All API calls now use normalized base URL
- [x] ✅ `apiClient` uses `getNormalizedApiBase()`
- [x] ✅ Direct `fetch()` calls updated to use `getNormalizedApiBase()`
- [x] ✅ Debug logging added for production builds
- [x] ✅ No linting errors introduced
- [ ] ⏳ **Requires testing in production environment**

---

## Deployment Requirements

### ✅ Redeploy Required

**Yes, a redeploy is required** because:
1. The code changes affect how API URLs are constructed
2. Production builds need to be rebuilt with the new code
3. The console.log will help verify the correct API base URL is being used

### Deployment Steps

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Verify the build output:**
   - Check browser console in production for: `API Base URL (runtime): <value>`
   - Verify API calls are going to the correct endpoints

3. **Check environment variables:**
   - If using separate frontend/backend domains: Set `VITE_API_URL` in production environment
   - If same domain: Leave `VITE_API_URL` empty or unset

4. **Test API calls:**
   - Navigate to pages that fetch articles: `/articles?sort=latest&page=1&limit=25`
   - Navigate to pages that fetch categories: `/categories?format=simple`
   - Verify no 404 errors in browser console

---

## Summary

**Files Updated:** 3
- `src/services/apiClient.ts` - Main API client (affects all apiClient calls)
- `src/components/MediaImage.tsx` - Media image fetching
- `src/hooks/useMediaUpload.ts` - Media upload functionality

**Key Changes:**
- ✅ All API calls now use normalized base URL
- ✅ Defaults to `/api` (works with Vite proxy in development)
- ✅ Respects `VITE_API_URL` if set (for production)
- ✅ Always ensures `/api` suffix is present
- ✅ Added debug logging for production builds

**Environment Variables:**
- ✅ No changes required to `.env` files
- ✅ `VITE_API_URL` is optional (defaults to `/api`)
- ✅ If set, `/api` suffix is automatically appended if missing

**Redeploy:** ✅ **Required** - Code changes need to be deployed to production

---

## Verification

After deployment, verify:
1. Browser console shows: `API Base URL (runtime): <expected-value>`
2. API calls to `/articles` and `/categories` succeed (no 404 errors)
3. Network tab shows correct API endpoints being called
4. All API functionality works as expected

