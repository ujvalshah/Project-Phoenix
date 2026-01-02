# Frontend API Client Configuration Audit Report

**Date:** Generated automatically  
**Scope:** Verification of `/api` prefix in all frontend API calls

## Executive Summary

✅ **Main API Client:** Correctly configured with `/api` prefix  
⚠️ **Direct Fetch Calls:** Some use `VITE_API_URL` which may not include `/api` prefix  
✅ **Most Endpoints:** Use apiClient which handles `/api` prefix automatically

---

## 1. Main API Client Configuration

### File: `src/services/apiClient.ts`

**Configuration:**
```typescript
const BASE_URL = '/api';
```

**Status:** ✅ **CORRECT**

- All requests are made with `${BASE_URL}${endpoint}`
- Endpoints passed to apiClient methods start with `/` (e.g., `/articles`, `/auth/login`)
- The `/api` prefix is automatically prepended

**Example usage:**
```typescript
// ✅ CORRECT - apiClient automatically adds /api prefix
apiClient.get('/articles')           // → /api/articles
apiClient.post('/auth/login', ...)   // → /api/auth/login
apiClient.get('/categories')         // → /api/categories
```

---

## 2. Endpoints Using apiClient (All Correct ✅)

All of these files correctly use `apiClient` which handles the `/api` prefix:

### Services
- `src/services/adapters/RestAdapter.ts` - All endpoints start with `/`
- `src/services/authService.ts` - Uses `/auth/login`, `/auth/signup`
- `src/services/aiService.ts` - Uses `/ai/summarize`, `/ai/takeaways`
- `src/services/unfurlService.ts` - Uses `/unfurl`

### Admin Services
- `src/admin/services/adminUsersService.ts` - Uses `/users`
- `src/admin/services/adminTagsService.ts` - Uses `/categories`
- `src/admin/services/adminNuggetsService.ts` - Uses `/articles`, `/moderation/reports`
- `src/admin/services/adminModerationService.ts` - Uses `/moderation/reports`
- `src/admin/services/adminFeedbackService.ts` - Uses `/feedback`
- `src/admin/services/adminCollectionsService.ts` - Uses `/collections`

### Components & Hooks
- `src/hooks/useYouTubeTitle.ts` - Uses `/articles/{id}`

---

## 3. Direct Fetch Calls (Manual Review Required)

These files use `fetch()` directly instead of `apiClient`:

### ✅ Correct (Already include `/api` prefix)

#### `src/components/MediaImage.tsx`
```typescript
const response = await fetch(`/api/media/${mediaId}`);
```
**Status:** ✅ **CORRECT** - Hardcoded `/api` prefix

#### `src/hooks/useMediaUpload.ts`
```typescript
const response = await fetch('/api/media/upload/cloudinary', {...});
```
**Status:** ✅ **CORRECT** - Hardcoded `/api` prefix

---

### ⚠️ Potential Issues (Use `VITE_API_URL` with fallback)

These files use `API_BASE = import.meta.env.VITE_API_URL || '/api'` which could fail if `VITE_API_URL` is set without the `/api` suffix.

#### `src/services/batchService.ts`
**Line 483:**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const response = await fetch(`${API_BASE}/batch/publish`, {...});
```

**Endpoints used:**
- `${API_BASE}/batch/publish`

**Potential issue:** If `VITE_API_URL=https://api.example.com` (without `/api`), the request would go to:
- ❌ `https://api.example.com/batch/publish` (missing `/api`)

**Should be:**
- ✅ `https://api.example.com/api/batch/publish`

---

#### `src/pages/BulkYouTubeAnalysisPage.tsx`
**Line 43:**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || '/api';
```

**Endpoints used:**
- `${API_BASE}/ai/extract-intelligence`
- `${API_BASE}/articles`
- `${API_BASE}/batch/publish`

**Potential issue:** Same as above - if `VITE_API_URL` doesn't include `/api`, requests will fail.

---

#### `src/components/admin/KeyStatusWidget.tsx`
**Line 5:**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || '/api';
```

**Endpoints used:**
- `${API_BASE}/ai/admin/key-status`
- `${API_BASE}/ai/admin/reset-keys`

**Potential issue:** Same as above.

---

## 4. Recommended Fixes

### Option 1: Normalize API_BASE (Recommended)

Update all files that use `VITE_API_URL` to ensure `/api` is always appended:

```typescript
// Helper function to normalize API base URL
function getApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) {
    return '/api'; // Development: use proxy
  }
  
  // If VITE_API_URL is set, ensure it ends with /api
  const url = envUrl.trim();
  if (url.endsWith('/api')) {
    return url;
  }
  if (url.endsWith('/')) {
    return `${url}api`;
  }
  return `${url}/api`;
}

const API_BASE = getApiBase();
```

### Option 2: Document Requirement

Add clear documentation that `VITE_API_URL` must include `/api`:

```env
# In production .env file:
# VITE_API_URL must include the /api suffix
# ✅ CORRECT: VITE_API_URL=https://api.yourdomain.com/api
# ❌ WRONG:   VITE_API_URL=https://api.yourdomain.com
VITE_API_URL=https://api.yourdomain.com/api
```

### Option 3: Migrate to apiClient (Best Practice)

Refactor direct `fetch()` calls to use `apiClient` for consistency:

```typescript
// Instead of:
const response = await fetch(`${API_BASE}/batch/publish`, {...});

// Use:
await apiClient.post('/batch/publish', { ids });
```

---

## 5. Configuration in vite.config.ts

**File:** `vite.config.ts`

```typescript
// Development: Proxy /api to localhost:5000
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
}

// Production: No proxy, relies on VITE_API_URL env var
```

**Status:** ✅ **CORRECT**

- Development: All `/api/*` requests are proxied to `localhost:5000`
- Production: Frontend makes direct requests to backend URL specified in `VITE_API_URL`

---

## 6. Summary of Endpoints

### All API Endpoints (via apiClient - ✅ All correct)

| Endpoint | File |
|----------|------|
| `/articles` | RestAdapter, admin services |
| `/articles/{id}` | RestAdapter, admin services |
| `/articles/my/counts` | RestAdapter |
| `/auth/login` | authService |
| `/auth/signup` | authService |
| `/users` | RestAdapter, admin services |
| `/users/{id}` | RestAdapter, admin services |
| `/users/{userId}/feed` | RestAdapter |
| `/categories` | RestAdapter, admin services |
| `/categories/{id}` | admin services |
| `/collections` | RestAdapter, admin services |
| `/collections/{id}` | RestAdapter, admin services |
| `/collections/{id}/entries` | RestAdapter |
| `/collections/{id}/follow` | RestAdapter |
| `/collections/{id}/unfollow` | RestAdapter |
| `/moderation/reports` | admin services |
| `/feedback` | admin services |
| `/ai/summarize` | aiService |
| `/ai/takeaways` | aiService |
| `/unfurl` | unfurlService |

### Direct Fetch Endpoints (Need Verification)

| Endpoint | File | Status |
|----------|------|--------|
| `/api/media/{mediaId}` | MediaImage.tsx | ✅ Correct |
| `/api/media/upload/cloudinary` | useMediaUpload.ts | ✅ Correct |
| `{API_BASE}/batch/publish` | batchService.ts | ⚠️ Depends on VITE_API_URL |
| `{API_BASE}/ai/extract-intelligence` | BulkYouTubeAnalysisPage.tsx | ⚠️ Depends on VITE_API_URL |
| `{API_BASE}/articles` | BulkYouTubeAnalysisPage.tsx | ⚠️ Depends on VITE_API_URL |
| `{API_BASE}/ai/admin/key-status` | KeyStatusWidget.tsx | ⚠️ Depends on VITE_API_URL |
| `{API_BASE}/ai/admin/reset-keys` | KeyStatusWidget.tsx | ⚠️ Depends on VITE_API_URL |

---

## 7. Recommendations

### Immediate Actions

1. ✅ **Verify environment variables** - Check if `VITE_API_URL` is set in production and ensure it includes `/api`
2. ✅ **Document requirement** - Add note to `env.example` that `VITE_API_URL` must include `/api`
3. ⚠️ **Consider normalization** - Add helper function to ensure `/api` is always appended to `VITE_API_URL`

### Long-term Improvements

1. **Migrate to apiClient** - Refactor all direct `fetch()` calls to use `apiClient` for:
   - Consistent error handling
   - Automatic authentication header injection
   - Request cancellation support
   - Telemetry/timing tracking

2. **Create API service layer** - Create dedicated services for:
   - `batchService` → use `apiClient.post('/batch/publish')`
   - `aiService` → already uses apiClient, extend for `/ai/extract-intelligence`
   - Admin services → already use apiClient ✅

---

## 8. Testing Checklist

- [ ] Verify development mode: All API calls use `/api` prefix and are proxied correctly
- [ ] Test production build with `VITE_API_URL` set to URL without `/api` - should fail
- [ ] Test production build with `VITE_API_URL` set to URL with `/api` - should work
- [ ] Test production build with `VITE_API_URL` not set - should use relative `/api` paths
- [ ] Verify all admin endpoints work in production
- [ ] Verify batch operations work in production
- [ ] Verify media upload/download work in production

---

## Conclusion

**Overall Status:** ✅ **FIXED** - All API base URLs are now normalized

The main API client is correctly configured, and most endpoints use it properly. All direct `fetch()` calls that used `VITE_API_URL` have been updated to use a normalization function that ensures the `/api` suffix is always present, even if `VITE_API_URL` doesn't include it.

**Status:** ✅ **FIXED** - `getNormalizedApiBase()` helper function has been implemented and all affected files have been updated.

---

## 9. Implementation Update (Latest)

### Fix Applied

Created `getNormalizedApiBase()` helper function in `src/utils/urlUtils.ts` that:
- Returns `/api` if `VITE_API_URL` is not set (development mode)
- Ensures `/api` suffix is always appended to `VITE_API_URL` if provided
- Handles edge cases (trailing slashes, etc.)

### Files Updated

1. ✅ `src/utils/urlUtils.ts` - Added `getNormalizedApiBase()` function
2. ✅ `src/services/batchService.ts` - Now uses `getNormalizedApiBase()`
3. ✅ `src/pages/BulkYouTubeAnalysisPage.tsx` - Now uses `getNormalizedApiBase()`
4. ✅ `src/components/admin/KeyStatusWidget.tsx` - Now uses `getNormalizedApiBase()`

### Benefits

- ✅ Works correctly even if `VITE_API_URL` doesn't include `/api`
- ✅ Backward compatible with existing configurations
- ✅ Prevents API routing errors in production
- ✅ Consistent behavior across all direct fetch calls

### Note on Environment Variables

Even though the code now handles missing `/api` automatically, it's still recommended to include it in `VITE_API_URL` for clarity:
```env
# ✅ Recommended (explicit)
VITE_API_URL=https://nuggets-zhih.onrender.com/api

# ✅ Also works (will be normalized automatically)
VITE_API_URL=https://nuggets-zhih.onrender.com
```

