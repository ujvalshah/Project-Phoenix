# Backend API Contract Discovery

**Date:** 2025-01-XX  
**Source:** Backend routes, controllers, and models audit  
**Status:** ✅ Complete

---

## API Base Configuration

- **Base URL:** `/api` (proxied to `localhost:5000` in development)
- **Auth Header:** `Authorization: Bearer <token>`
- **Content-Type:** `application/json`
- **Response Format:** All responses use `normalizeDoc()` which converts `_id` → `id`

---

## 1. AUTHENTICATION

| Endpoint | Method | Auth Required | Request Body | Response Shape | Notes |
|----------|--------|---------------|--------------|----------------|-------|
| `/api/auth/login` | POST | ❌ No | `{ email: string, password: string }` | `{ user: User, token: string }` | Rate limited |
| `/api/auth/signup` | POST | ❌ No | `{ fullName: string, username: string, email: string, password: string, pincode?: string, city?: string, country?: string, gender?: string, phoneNumber?: string }` | `{ user: User, token: string }` | Rate limited, validates password strength |
| `/api/auth/me` | GET | ✅ Yes | - | `User` | Returns current user from token |

**User Response Shape:**
```typescript
{
  id: string,  // _id converted to id
  role: 'admin' | 'user',
  auth: {
    email: string,
    emailVerified: boolean,
    provider: 'email' | 'google' | 'linkedin',
    createdAt: string,
    updatedAt?: string
  },
  profile: {
    displayName: string,
    username: string,
    bio?: string,
    avatarUrl?: string,
    avatarColor?: 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'teal' | 'indigo' | 'slate',
    phoneNumber?: string,
    location?: string,
    pincode?: string,
    city?: string,
    country?: string,
    gender?: string,
    dateOfBirth?: string,
    website?: string
  },
  security: {
    lastPasswordChangeAt?: string,
    mfaEnabled: boolean
  },
  preferences: {
    theme: 'light' | 'dark' | 'system',
    defaultVisibility: 'public' | 'private',
    interestedCategories: string[],
    compactMode: boolean,
    richMediaPreviews: boolean,
    autoFollowCollections: boolean,
    notifications: {
      emailDigest: boolean,
      productUpdates: boolean,
      newFollowers: boolean
    }
  },
  appState: {
    lastLoginAt?: string,
    onboardingCompleted: boolean,
    featureFlags?: Record<string, boolean>
  }
}
```

**Error Responses:**
- `400`: `{ message: string, errors?: array }` (validation errors)
- `401`: `{ message: string }` (invalid credentials)
- `409`: `{ message: string }` (email/username already exists)
- `500`: `{ message: string }` (server error)

---

## 2. ARTICLES (NUGGETS)

| Endpoint | Method | Auth Required | Request Body | Response Shape | Notes |
|----------|--------|---------------|--------------|----------------|-------|
| `/api/articles` | GET | ❌ No | Query: `?authorId=<string>` | `Article[]` | Filter by author (optional) |
| `/api/articles/:id` | GET | ❌ No | - | `Article` | Single article |
| `/api/articles` | POST | ✅ Yes | `{ title: string, excerpt?: string, content: string, authorId: string, authorName: string, category: string, categories?: string[], publishedAt?: string, tags?: string[], readTime?: number, visibility?: 'public' | 'private', media?: object, ... }` | `Article` | Creates new article |
| `/api/articles/:id` | PUT | ✅ Yes | Partial Article fields | `Article` | Updates article |
| `/api/articles/:id` | DELETE | ✅ Yes | - | `204 No Content` | Deletes article |

**Article Response Shape (transformed by normalizeDoc):**
```typescript
{
  id: string,  // _id converted to id
  title: string,
  excerpt?: string,
  content: string,
  author: {
    id: string,  // from authorId
    name: string,  // from authorName
    avatar_url?: undefined
  },
  publishedAt: string,
  categories: string[],  // from categories array or [category] if single
  tags: string[],
  readTime: number,
  visibility: 'public' | 'private',
  media?: {
    type: 'image' | 'video' | 'document' | 'link' | 'text' | 'youtube' | 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'rich',
    url: string,
    thumbnail_url?: string,
    aspect_ratio?: string,
    filename?: string,
    previewMetadata?: {
      url: string,
      finalUrl?: string,
      providerName?: string,
      siteName?: string,
      title?: string,
      description?: string,
      imageUrl?: string,
      faviconUrl?: string,
      authorName?: string,
      publishDate?: string,
      mediaType?: string
    }
  },
  images?: string[],  // Legacy
  video?: string,  // Legacy
  documents?: Array<{ title: string, url: string, type: string, size: string }>,  // Legacy
  engagement?: {
    likes: number,
    bookmarks: number,
    shares: number,
    views: number
  },
  source_type?: string,
  created_at?: string,
  updated_at?: string
}
```

**Error Responses:**
- `400`: `{ message: string, errors?: array }`
- `404`: `{ message: 'Article not found' }`
- `500`: `{ message: string }`

---

## 3. COLLECTIONS

| Endpoint | Method | Auth Required | Request Body | Response Shape | Notes |
|----------|--------|---------------|--------------|----------------|-------|
| `/api/collections` | GET | ❌ No | - | `Collection[]` | All collections |
| `/api/collections/:id` | GET | ❌ No | - | `Collection` | Single collection |
| `/api/collections` | POST | ✅ Yes | `{ name: string, description?: string, creatorId: string, type?: 'public' | 'private' }` | `Collection` | Creates collection, idempotent for "General Bookmarks" |
| `/api/collections/:id` | PUT | ✅ Yes | Partial Collection fields | `Collection` | Updates collection |
| `/api/collections/:id` | DELETE | ✅ Yes | - | `204 No Content` | Deletes collection |
| `/api/collections/:id/entries` | POST | ✅ Yes | `{ articleId: string, userId: string }` | `Collection` | Adds entry (prevents duplicates) |
| `/api/collections/:id/entries/:articleId` | DELETE | ✅ Yes | - | `Collection` | Removes entry |
| `/api/collections/:id/entries/:articleId/flag` | POST | ✅ Yes | `{ userId: string }` | `Collection` | Flags entry as irrelevant |

**Collection Response Shape:**
```typescript
{
  id: string,  // _id converted to id
  name: string,
  description: string,
  creatorId: string,
  createdAt: string,
  updatedAt: string,
  followersCount: number,
  entries: Array<{
    articleId: string,
    addedByUserId: string,
    addedAt: string,
    flaggedBy: string[]
  }>,
  type: 'private' | 'public'
}
```

**Error Responses:**
- `400`: `{ message: string, errors?: array }`
- `404`: `{ message: 'Collection not found' }`
- `500`: `{ message: string }`

---

## 4. USERS

| Endpoint | Method | Auth Required | Request Body | Response Shape | Notes |
|----------|--------|---------------|--------------|----------------|-------|
| `/api/users` | GET | ❌ No | - | `User[]` | All users (password excluded) |
| `/api/users/:id` | GET | ❌ No | - | `User` | Single user (password excluded) |
| `/api/users/:id` | PUT | ✅ Yes | `{ name?: string, email?: string, role?: 'admin' | 'user', preferences?: { interestedCategories: string[] }, profile?: object, preferences?: object }` | `User` | Updates user (nested structure) |
| `/api/users/:id` | DELETE | ✅ Yes | - | `204 No Content` | Deletes user |
| `/api/users/:id/feed` | GET | ✅ Yes | - | `{ articles: Article[], newCount: number }` | Personalized feed based on user interests |

**User Response Shape:** (Same as Auth section)

**Error Responses:**
- `400`: `{ message: string, errors?: array }`
- `404`: `{ message: 'User not found' }`
- `500`: `{ message: string }`

---

## 5. TAGS / CATEGORIES

| Endpoint | Method | Auth Required | Request Body | Response Shape | Notes |
|----------|--------|---------------|--------------|----------------|-------|
| `/api/categories` | GET | ❌ No | Query: `?format=simple` | `string[]` or `Tag[]` | If `format=simple`, returns array of tag names only |
| `/api/categories` | POST | ✅ Yes | `{ name: string, type?: 'category' | 'tag', status?: 'active' | 'pending' | 'deprecated', isOfficial?: boolean }` | `Tag` | Creates tag/category |
| `/api/categories/:name` | DELETE | ✅ Yes | - | `204 No Content` | Deletes tag by name |

**Tag Response Shape:**
```typescript
{
  id: string,  // _id converted to id
  name: string,
  usageCount: number,
  type: 'category' | 'tag',
  status: 'active' | 'pending' | 'deprecated',
  isOfficial: boolean
}
```

**Error Responses:**
- `400`: `{ message: string, errors?: array }`
- `404`: `{ message: 'Category not found' }`
- `409`: `{ message: 'Tag already exists' }`
- `500`: `{ message: string }`

---

## 6. MODERATION (REPORTS)

| Endpoint | Method | Auth Required | Request Body | Response Shape | Notes |
|----------|--------|---------------|--------------|----------------|-------|
| `/api/moderation/reports` | GET | ✅ Yes | Query: `?status=<string>&targetType=<string>&targetId=<string>` | `Report[]` | Admin access, filtered by query params |
| `/api/moderation/reports` | POST | ❌ No | `{ targetId: string, targetType: 'nugget' | 'user' | 'collection', reason: 'spam' | 'harassment' | 'misinformation' | 'copyright' | 'other', description?: string, reporter: { id: string, name: string }, respondent?: { id: string, name: string } }` | `Report` | Public route - anyone can report |
| `/api/moderation/reports/:id/resolve` | PATCH | ✅ Yes | `{ resolution: 'resolved' | 'dismissed' }` | `Report` | Admin access |

**Report Response Shape:**
```typescript
{
  id: string,  // _id converted to id
  targetId: string,
  targetType: 'nugget' | 'user' | 'collection',
  reason: 'spam' | 'harassment' | 'misinformation' | 'copyright' | 'other',
  description?: string,
  reporter: {
    id: string,
    name: string
  },
  respondent?: {
    id: string,
    name: string
  },
  status: 'open' | 'resolved' | 'dismissed',
  createdAt: string  // ISO date string
}
```

**Error Responses:**
- `400`: `{ message: string, errors?: array }`
- `404`: `{ message: 'Report not found' }`
- `500`: `{ message: string }`

---

## 7. FEEDBACK

| Endpoint | Method | Auth Required | Request Body | Response Shape | Notes |
|----------|--------|---------------|--------------|----------------|-------|
| `/api/feedback` | GET | ✅ Yes | Query: `?status=<string>&type=<string>` | `Feedback[]` | Admin access, filtered by query params |
| `/api/feedback` | POST | ❌ No | `{ content: string, type?: 'bug' | 'feature' | 'general', user?: { id: string, name: string, fullName?: string, username?: string, avatar?: string }, email?: string }` | `Feedback` | Public route - anyone can submit |
| `/api/feedback/:id/status` | PATCH | ✅ Yes | `{ status: 'new' | 'read' | 'archived' }` | `Feedback` | Admin access |
| `/api/feedback/:id` | DELETE | ✅ Yes | - | `204 No Content` | Admin access |

**Feedback Response Shape:**
```typescript
{
  id: string,  // _id converted to id
  content: string,
  type: 'bug' | 'feature' | 'general',
  status: 'new' | 'read' | 'archived',
  user?: {
    id: string,
    name: string,
    fullName?: string,
    username?: string,
    avatar?: string
  },
  email?: string,
  createdAt: string  // ISO date string
}
```

**Error Responses:**
- `400`: `{ message: string, errors?: array }`
- `404`: `{ message: 'Feedback not found' }`
- `500`: `{ message: string }`

---

## 8. ADMIN ENDPOINTS

**⚠️ CRITICAL:** No dedicated `/api/admin/*` routes exist in backend.

**Admin functionality is distributed across:**
- `/api/users` - User management (requires auth, but no role check in middleware)
- `/api/articles` - Nugget management (requires auth)
- `/api/collections` - Collection management (requires auth)
- `/api/categories` - Tag management (requires auth)
- `/api/moderation/reports` - Report management (requires auth)
- `/api/feedback` - Feedback management (requires auth)

**Note:** Backend does NOT enforce admin role checks in middleware. Frontend must handle admin-only UI visibility.

---

## COMMON ERROR RESPONSES

All endpoints follow consistent error format:

```typescript
{
  message: string,  // Human-readable error message
  errors?: Array<{  // Validation errors (when applicable)
    path: string[],
    message: string,
    code: string
  }>
}
```

**HTTP Status Codes:**
- `200` / `201`: Success
- `204`: Success (No Content)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `404`: Not Found
- `409`: Conflict (duplicate email/username/tag)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

---

## FIELD MAPPING NOTES

**Backend → Frontend Transformations:**
1. `_id` → `id` (automatic via `normalizeDoc()`)
2. Articles: `authorId` + `authorName` → `author: { id, name }`
3. Articles: `category` (single) → `categories` (array) if `categories` array is empty
4. User: Nested structure (`auth`, `profile`, `preferences`, `appState`) preserved as-is

**Frontend → Backend Transformations:**
1. Articles: `author: { id, name }` → `authorId` + `authorName`
2. User updates: Flat fields map to nested structure (e.g., `name` → `profile.displayName`)

---

*End of Backend API Contract*
