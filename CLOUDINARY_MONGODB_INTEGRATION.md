# Cloudinary + MongoDB Integration - Implementation Summary

## ✅ Implementation Complete

This document summarizes the production-safe Cloudinary integration with MongoDB as the source of truth for media metadata and lifecycle management.

---

## 📋 Architecture Overview

### Core Principle: **MongoDB-First**
- MongoDB is the **single source of truth** for all media metadata
- Cloudinary is used for storage and delivery only
- All operations validate against MongoDB before Cloudinary
- Rollback logic ensures Cloudinary never has orphaned assets

---

## 🔧 Components Implemented

### 1. Environment Configuration ✅

**File:** `server/src/config/envValidation.ts`

- Added Cloudinary environment variables (optional):
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Server fails gracefully if Cloudinary is not configured (media uploads disabled)

**Required in `.env`:**
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

### 2. MongoDB Media Model ✅

**File:** `server/src/models/Media.ts`

**Schema Fields:**
- `ownerId` - User who uploaded (indexed)
- `purpose` - 'avatar' | 'nugget' | 'attachment' | 'other' (indexed)
- `cloudinary` - Cloudinary metadata (publicId, secureUrl, dimensions, etc.)
- `file` - Original file metadata (mimeType, size, originalName)
- `status` - 'active' | 'orphaned' | 'deleted' (indexed)
- `usedBy` - Entity reference (entityType, entityId)
- `createdAt`, `updatedAt`, `deletedAt` - Timestamps

**Indexes:**
- `ownerId` (single)
- `cloudinary.publicId` (unique)
- `status` (single)
- `ownerId + status` (compound)
- `usedBy.entityType + usedBy.entityId` (compound)
- `deletedAt` (TTL index for automatic cleanup)

---

### 3. Cloudinary Service ✅

**File:** `server/src/services/cloudinaryService.ts`

**Functions:**
- `initializeCloudinary()` - Initialize on server startup
- `uploadToCloudinary()` - Upload file with folder structure
- `deleteFromCloudinary()` - Best-effort deletion (never throws)
- `getCloudinaryUrl()` - Generate transformed URLs
- `sanitizeFolderPath()` - Prevent directory traversal

**Folder Structure:**
- `/users/{userId}/avatars/` - User avatars
- `/nuggets/{nuggetId}/media/` - Nugget attachments
- `/uploads/{userId}/` - General uploads

---

### 4. Upload API ✅

**File:** `server/src/controllers/mediaController.ts`
**Route:** `POST /api/media/upload/cloudinary`

**Flow:**
1. ✅ Validate authentication
2. ✅ Check user quotas (files, storage, daily limit)
3. ✅ Upload to Cloudinary
4. ✅ Create MongoDB record
5. ✅ **Rollback Cloudinary if MongoDB fails**

**Security Controls:**
- Max 1000 files per user
- Max 500MB storage per user
- Max 100 uploads per day per user
- Ownership validation on all operations

**Response:**
```json
{
  "mediaId": "...",
  "secureUrl": "https://...",
  "publicId": "...",
  "width": 1920,
  "height": 1080,
  "resourceType": "image",
  "purpose": "nugget",
  "status": "active"
}
```

---

### 5. Entity Linking ✅

**Route:** `POST /api/media/:mediaId/link`

**Functionality:**
- Links media to entities (nuggets, users, etc.)
- Updates `usedBy` field in MongoDB
- Validates ownership before linking
- Prevents cross-user attachment attempts

---

### 6. Safe Deletion ✅

**Route:** `DELETE /api/media/:mediaId`

**Flow:**
1. ✅ Validate ownership in MongoDB
2. ✅ Mark as `deleted` in MongoDB
3. ✅ Set `deletedAt` timestamp
4. ✅ Best-effort Cloudinary deletion (doesn't fail if Cloudinary fails)

**Integration with Article Deletion:**
- When article is deleted, associated media is marked as `orphaned`
- Orphaned media is cleaned up by scheduled job

---

### 7. Orphan Cleanup Service ✅

**File:** `server/src/services/mediaCleanupService.ts`

**Functions:**
- `cleanupOrphanedMedia()` - Find and delete orphaned media
- `markMediaAsOrphaned()` - Mark media when entity is deleted
- `getUserStorageStats()` - Get user storage statistics

**Orphan Criteria:**
- Status is `'orphaned'`
- OR status is `'active'` but `usedBy` is missing and created > 60 minutes ago

---

### 8. Scheduled Cleanup Job ✅

**File:** `server/src/utils/scheduledCleanup.ts`

**Functionality:**
- Runs every 6 hours (configurable)
- Cleans up orphaned media
- Logs cleanup statistics

**To Start:**
```typescript
import { startScheduledCleanup } from './utils/scheduledCleanup.js';
startScheduledCleanup(6); // Run every 6 hours
```

---

## 🔒 Security Features

### Ownership Validation
- ✅ All operations check `ownerId` in MongoDB
- ✅ Cross-user operations are rejected
- ✅ No client-provided IDs are trusted

### Quota Enforcement
- ✅ Per-user file limits (1000 files)
- ✅ Per-user storage limits (500MB)
- ✅ Daily upload limits (100 files/day)

### Folder Security
- ✅ Folder paths are sanitized
- ✅ Directory traversal prevented
- ✅ Folder structure derived from MongoDB context

---

## 📊 Data Flow

### Upload Flow:
```
Client → API → Validate Quotas → Upload to Cloudinary → Create MongoDB Record → Return Response
                                    ↓ (if fails)
                                 Rollback Cloudinary
```

### Deletion Flow:
```
Client → API → Validate Ownership → Mark Deleted in MongoDB → Delete from Cloudinary (best-effort)
```

### Entity Deletion Flow:
```
Delete Entity → Mark Media as Orphaned → Scheduled Cleanup → Delete from Cloudinary
```

---

## 🚨 Rollback & Failure Scenarios

### Scenario 1: MongoDB Insert Fails After Cloudinary Upload
✅ **Handled:** Cloudinary asset is deleted (rollback)

### Scenario 2: Cloudinary Deletion Fails
✅ **Handled:** MongoDB record still marked as deleted (best-effort)

### Scenario 3: Entity Deleted, Media Orphaned
✅ **Handled:** Media marked as orphaned, cleaned up by scheduled job

### Scenario 4: Cloudinary Not Configured
✅ **Handled:** Server starts successfully, uploads return 503

---

## 📝 API Endpoints

### Upload Media
```
POST /api/media/upload/cloudinary
Content-Type: multipart/form-data
Body: { file, purpose, entityType?, entityId? }
```

### Get Media
```
GET /api/media/:mediaId
```

### Link Media
```
POST /api/media/:mediaId/link
Body: { entityType, entityId }
```

### Delete Media
```
DELETE /api/media/:mediaId
```

---

## 🔍 Validation Checklist

- ✅ MongoDB is the single source of truth
- ✅ No orphaned Cloudinary assets (rollback on MongoDB failure)
- ✅ Media deletion is safe & repeatable
- ✅ Ownership rules enforced at DB level
- ✅ Upload → attach → delete lifecycle fully covered
- ✅ Security controls (quotas, ownership validation)
- ✅ Scheduled cleanup for orphaned media
- ✅ Folder structure derived from MongoDB context

---

## ⚠️ Next Steps (Frontend Integration)

1. **Update CreateNuggetModal** to use `/api/media/upload/cloudinary` instead of Base64
2. **Update Article creation** to link media IDs instead of Base64 strings
3. **Update Article deletion** to trigger media cleanup (already done on backend)
4. **Update image display** to use Cloudinary URLs from MongoDB

---

## 📌 Notes

- Cloudinary is **optional** - server works without it (uploads disabled)
- All media operations require authentication
- Quotas are enforced at the API level
- TTL index on `deletedAt` enables automatic MongoDB cleanup
- Scheduled cleanup prevents storage cost leaks

---

## 🎯 Production Readiness

✅ **Ready for Production:**
- MongoDB-first architecture ensures data integrity
- Rollback logic prevents orphaned assets
- Security controls prevent abuse
- Cleanup jobs prevent cost leaks
- Graceful degradation if Cloudinary unavailable

**Remaining:**
- Frontend integration (update CreateNuggetModal)
- Optional: Add Cloudinary transformations for thumbnails
- Optional: Add CDN caching headers





