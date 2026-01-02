# DATA FLOW DOCUMENTATION

## Overview

This document explains how data flows through the system, when MongoDB is used, and when mock fallback applies.

## Architecture

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │
       │ HTTP Requests
       │
┌──────▼─────────────────────────────────────┐
│         Backend (Express)                    │
│  ┌──────────────────────────────────────┐   │
│  │  Controllers                         │   │
│  │  - articlesController                │   │
│  │  - collectionsController             │   │
│  │  - usersController                   │   │
│  │  - tags route                        │   │
│  └──────┬───────────────────┬───────────┘   │
│         │                   │                │
│    ┌────▼────┐        ┌─────▼─────┐         │
│    │ MongoDB │        │ In-Memory │         │
│    │ (Real)  │        │ (Fallback)│         │
│    └─────────┘        └───────────┘         │
└─────────────────────────────────────────────┘
```

## Data Sources

### 1. MongoDB (Primary - When Connected)

**When Used:**
- MongoDB URI is set in `server/.env`
- MongoDB connection is successful
- `mongoose.connection.readyState === 1` (connected)

**Data Flow:**
1. Controller receives request
2. Checks `isMongoConnected()` → `true`
3. Executes Mongoose query (e.g., `Article.find()`)
4. Normalizes response (`_id` → `id`)
5. Returns JSON response

**Example:**
```typescript
// articlesController.ts
if (isMongoConnected()) {
  const articles = await Article.find().lean();
  return res.json(normalizeDocs(articles)); // _id → id
}
```

### 2. In-Memory (Fallback - When MongoDB Unavailable)

**When Used:**
- MongoDB URI not set
- MongoDB connection failed
- MongoDB query throws error
- `isMongoConnected()` → `false`

**Data Flow:**
1. Controller receives request
2. Checks `isMongoConnected()` → `false`
3. Uses in-memory array (e.g., `ARTICLES_DB`)
4. Returns JSON response (already has `id` field)

**Example:**
```typescript
// articlesController.ts
if (isMongoConnected()) {
  // MongoDB path
} else {
  return res.json(ARTICLES_DB); // Already has id field
}
```

### 3. LocalStorage (Frontend Mock Mode)

**When Used:**
- `VITE_ADAPTER_TYPE=local` or not set
- Frontend uses `LocalAdapter`
- No backend required

**Data Flow:**
1. Frontend uses `LocalAdapter`
2. Reads/writes to `localStorage`
3. Never makes HTTP requests
4. Completely independent of backend

## Response Normalization

### Backend Normalization

All MongoDB responses are normalized before sending to frontend:

```typescript
// server/src/utils/db.ts
export function normalizeDoc(doc: any): any {
  if (doc._id) {
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }
  return doc;
}
```

**Result:** Frontend always receives `{ id: "...", ... }` never `{ _id: "...", ... }`

### Frontend Normalization (Redundant but Safe)

`RestAdapter` has normalization logic that handles both cases:

```typescript
// src/services/adapters/RestAdapter.ts
const normalizeArticle = (doc: any): Article => {
  if (doc.id && !doc._id) return doc as Article; // Already normalized
  if (doc._id) {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id }; // Normalize if needed
  }
  return doc as Article;
};
```

**Why Redundant?** Backend already normalizes, but this provides extra safety.

## Seeding System

### When Seeding Occurs

1. MongoDB connects successfully
2. Seed function is called automatically
3. Checks if database is empty:
   - `Article.countDocuments() === 0`
   - `User.countDocuments() === 0`
   - `Collection.countDocuments() === 0`
   - `Tag.countDocuments() === 0`
4. If all empty → seeds data
5. If any collection has data → skips seeding

### Seed Data

- **12 Articles**: Various categories (Tech, Business, Finance, etc.)
- **2 Users**: Admin and regular user
- **2 Collections**: Private bookmarks and public collection
- **12 Tags**: Categories like Tech, Business, Finance, etc.

### Seed Flow

```
MongoDB Connects
    │
    ▼
seedDatabase() called
    │
    ▼
Check document counts
    │
    ├─→ All empty? → Seed data → Log "[Seed] Database seeded"
    │
    └─→ Any populated? → Skip → Log "[Seed] Skipped (already populated)"
```

## Request Flow Examples

### Example 1: Get All Articles (MongoDB Connected)

```
1. Frontend: GET /api/articles
2. Backend: articlesController.getArticles()
3. Check: isMongoConnected() → true
4. Query: Article.find().lean()
5. Normalize: normalizeDocs(articles) → { id: "...", ... }
6. Response: JSON array with id fields
7. Frontend: RestAdapter receives normalized data
```

### Example 2: Get All Articles (MongoDB Unavailable)

```
1. Frontend: GET /api/articles
2. Backend: articlesController.getArticles()
3. Check: isMongoConnected() → false
4. Fallback: ARTICLES_DB (in-memory array)
5. Response: JSON array (already has id fields)
6. Frontend: RestAdapter receives data
```

### Example 3: Create Article (MongoDB Connected)

```
1. Frontend: POST /api/articles { title: "...", ... }
2. Backend: articlesController.createArticle()
3. Check: isMongoConnected() → true
4. Create: new Article(data).save()
5. Normalize: normalizeDoc(article) → { id: "...", ... }
6. Response: 201 Created with normalized article
7. Frontend: Receives article with id field
```

### Example 4: LocalAdapter Mode

```
1. Frontend: LocalAdapter.getAllArticles()
2. Read: localStorage.getItem('newsbytes_articles')
3. Parse: JSON.parse(data)
4. Return: Article[] (no HTTP request)
```

## Error Handling

### MongoDB Errors

All MongoDB operations are wrapped in try-catch:

```typescript
try {
  if (isMongoConnected()) {
    // MongoDB operation
  } else {
    // Fallback
  }
} catch (error) {
  console.error('[Controller] Error:', error);
  // Fallback to in-memory
}
```

**Result:** System never crashes, always falls back gracefully.

### Connection State

MongoDB connection state is tracked:

```typescript
// server/src/index.ts
mongoose.connection.on('connected', () => {
  mongoConnected = true;
});

mongoose.connection.on('disconnected', () => {
  mongoConnected = false;
});
```

**Result:** Controllers always know current connection state.

## Data Consistency

### ID Field Format

- **Always**: `id: string` (never `_id`)
- **MongoDB**: `_id` converted to `id` in controllers
- **In-Memory**: Already uses `id` field
- **LocalStorage**: Already uses `id` field

### Response Shape

All responses follow consistent shape:

```typescript
// Article
{ id: string, title: string, content: string, ... }

// Collection
{ id: string, name: string, entries: [...], ... }

// User
{ id: string, name: string, email: string, ... }
```

## Summary

1. **MongoDB is primary** when connected
2. **In-memory is fallback** when MongoDB unavailable
3. **All responses normalized** to use `id` field
4. **Seeding is automatic** on first connection
5. **Error handling** ensures graceful degradation
6. **Frontend works identically** regardless of data source

---

**Key Principle**: Frontend should never know or care whether data comes from MongoDB or in-memory. The abstraction is complete.












