import { Request, Response } from 'express';
import multer from 'multer';
import { Media, IMedia } from '../models/Media.js';
import { 
  uploadToCloudinary, 
  deleteFromCloudinary,
  isCloudinaryConfigured,
  sanitizeFolderPath,
  UploadOptions
} from '../services/cloudinaryService.js';
import { sendInternalError, sendValidationError, sendNotFoundError, sendUnauthorizedError } from '../utils/errorResponse.js';
import { getUserStorageStats } from '../services/mediaCleanupService.js';
import mongoose from 'mongoose';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

// Security limits (configurable via env in production)
const MAX_FILES_PER_USER = 1000; // Maximum total files per user
const MAX_STORAGE_BYTES = 500 * 1024 * 1024; // 500MB max storage per user
const MAX_DAILY_UPLOADS = 100; // Maximum uploads per day per user

/**
 * Media Controller
 * Handles all media upload, linking, and deletion operations
 * 
 * CRITICAL: MongoDB is the source of truth. All operations must:
 * 1. Validate ownership in MongoDB first
 * 2. Perform Cloudinary operations
 * 3. Update MongoDB records
 * 4. Rollback Cloudinary if MongoDB fails
 */

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store in memory for Cloudinary upload
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, and documents
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

/**
 * Upload file to Cloudinary and create MongoDB record
 * 
 * POST /api/upload/cloudinary
 * 
 * Body: multipart/form-data
 * - file: File
 * - purpose: 'avatar' | 'nugget' | 'attachment' | 'other'
 * - entityType?: 'nugget' | 'user' | 'post' | 'collection' (if linking immediately)
 * - entityId?: string (if linking immediately)
 */
export const uploadMedia = async (req: Request, res: Response) => {
  try {
    // Check if Cloudinary is configured
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET'
      });
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    const file = req.file;
    if (!file) {
      return sendValidationError(res, 'No file provided', []);
    }

    // SECURITY: Check user quotas before upload
    try {
      const stats = await getUserStorageStats(userId);
      
      // Check total file count
      if (stats.totalFiles >= MAX_FILES_PER_USER) {
        return res.status(403).json({
          error: 'Quota Exceeded',
          message: `Maximum file limit reached (${MAX_FILES_PER_USER} files). Please delete some files before uploading.`
        });
      }
      
      // Check storage quota
      if (stats.totalBytes >= MAX_STORAGE_BYTES) {
        return res.status(403).json({
          error: 'Storage Quota Exceeded',
          message: `Maximum storage limit reached (${(MAX_STORAGE_BYTES / 1024 / 1024).toFixed(0)}MB). Please delete some files before uploading.`
        });
      }
      
      // Check daily upload limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayUploads = await Media.countDocuments({
        ownerId: userId,
        createdAt: { $gte: today }
      });
      
      if (todayUploads >= MAX_DAILY_UPLOADS) {
        return res.status(403).json({
          error: 'Daily Limit Exceeded',
          message: `Maximum daily upload limit reached (${MAX_DAILY_UPLOADS} files). Please try again tomorrow.`
        });
      }
    } catch (quotaError: any) {
      // Audit Phase-1 Fix: Use structured logging and Sentry capture
      const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
      requestLogger.error({
        msg: '[Media] Quota check failed',
        error: {
          message: quotaError.message,
          stack: quotaError.stack,
        },
      });
      captureException(quotaError instanceof Error ? quotaError : new Error(String(quotaError)), {
        requestId: req.id,
        route: req.path,
      });
      // Don't block upload if quota check fails, but log it
    }

    const purpose = req.body.purpose as 'avatar' | 'nugget' | 'attachment' | 'other';
    if (!purpose || !['avatar', 'nugget', 'attachment', 'other'].includes(purpose)) {
      return sendValidationError(res, 'Invalid purpose. Must be: avatar, nugget, attachment, or other', []);
    }

    // Optional: Link to entity immediately
    const entityType = req.body.entityType as 'nugget' | 'user' | 'post' | 'collection' | undefined;
    const entityId = req.body.entityId as string | undefined;

    // Validate entity linking if provided
    if (entityType && entityId) {
      if (!mongoose.Types.ObjectId.isValid(entityId)) {
        return sendValidationError(res, 'Invalid entityId', []);
      }
    }

    // Determine folder structure based on purpose and user
    let folder: string;
    if (purpose === 'avatar') {
      folder = sanitizeFolderPath(`users/${userId}/avatars`);
    } else if (purpose === 'nugget' && entityId) {
      folder = sanitizeFolderPath(`nuggets/${entityId}/media`);
    } else {
      folder = sanitizeFolderPath(`uploads/${userId}`);
    }

    // Determine resource type
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    const resourceType: 'image' | 'video' | 'raw' = isImage ? 'image' : isVideo ? 'video' : 'raw';

    // CRITICAL: Check for existing media by public_id hash or file content
    // For now, we rely on Cloudinary's overwrite: false to prevent duplicates
    // But we should check MongoDB first to avoid unnecessary Cloudinary calls
    
    // Upload to Cloudinary
    let cloudinaryResult;
    try {
      console.log(`[Media] Uploading ${resourceType} to Cloudinary:`, {
        fileName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        folder,
        purpose
      });
      
      const uploadOptions: UploadOptions = {
        folder,
        resourceType,
        overwrite: false, // CRITICAL: Don't overwrite existing assets
        invalidate: true
      };

      cloudinaryResult = await uploadToCloudinary(file.buffer, uploadOptions);
      
      console.log(`[Media] Cloudinary upload successful:`, {
        publicId: cloudinaryResult.publicId,
        secureUrl: cloudinaryResult.secureUrl,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height
      });
    } catch (cloudinaryError: any) {
      // Audit Phase-1 Fix: Use structured logging and Sentry capture
      const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
      requestLogger.error({
        msg: '[Media] Cloudinary upload failed',
        error: {
          message: cloudinaryError.message,
          stack: cloudinaryError.stack,
        },
      });
      captureException(cloudinaryError instanceof Error ? cloudinaryError : new Error(String(cloudinaryError)), {
        requestId: req.id,
        route: req.path,
      });
      return res.status(500).json({
        error: 'Upload Failed',
        message: `Failed to upload to Cloudinary: ${cloudinaryError.message}`
      });
    }

    // CRITICAL: Check if media with this publicId already exists (idempotency guard)
    // This prevents duplicate Media records even if Cloudinary allows the upload
    let existingMedia = await Media.findOne({
      'cloudinary.publicId': cloudinaryResult.publicId,
      status: 'active'
    });

    if (existingMedia) {
      console.log(`[Media] Media with publicId ${cloudinaryResult.publicId} already exists, returning existing record`);
      
      // ROLLBACK: Delete the duplicate Cloudinary asset (best effort)
      await deleteFromCloudinary(cloudinaryResult.publicId, cloudinaryResult.resourceType);
      
      // Return existing media record
      return res.status(200).json({
        mediaId: existingMedia._id.toString(),
        secureUrl: existingMedia.cloudinary.secureUrl,
        publicId: existingMedia.cloudinary.publicId,
        width: existingMedia.cloudinary.width,
        height: existingMedia.cloudinary.height,
        duration: existingMedia.cloudinary.duration,
        resourceType: existingMedia.cloudinary.resourceType,
        purpose: existingMedia.purpose,
        status: existingMedia.status
      });
    }

    // Create MongoDB record (MongoDB-first approach)
    let mediaDoc: IMedia;
    try {
      const mediaData: any = {
        ownerId: new mongoose.Types.ObjectId(userId),
        purpose,
        cloudinary: {
          publicId: cloudinaryResult.publicId,
          secureUrl: cloudinaryResult.secureUrl,
          resourceType: cloudinaryResult.resourceType,
          format: cloudinaryResult.format,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          duration: cloudinaryResult.duration,
          bytes: cloudinaryResult.bytes
        },
        file: {
          mimeType: file.mimetype,
          size: file.size,
          originalName: file.originalname
        },
        status: 'active'
      };

      // Add usedBy if entity linking provided
      if (entityType && entityId) {
        mediaData.usedBy = {
          entityType,
          entityId: new mongoose.Types.ObjectId(entityId)
        };
      }

      console.log(`[Media] Creating MongoDB record for publicId: ${cloudinaryResult.publicId}`);
      mediaDoc = await Media.create(mediaData);
      console.log(`[Media] MongoDB record created successfully: ${mediaDoc._id}`);
    } catch (mongoError: any) {
      // ROLLBACK: Delete from Cloudinary if MongoDB insert fails
      // Audit Phase-1 Fix: Use structured logging and Sentry capture
      const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
      requestLogger.error({
        msg: '[Media] MongoDB insert failed, rolling back Cloudinary upload',
        error: {
          message: mongoError.message,
          stack: mongoError.stack,
        },
        publicId: cloudinaryResult.publicId,
      });
      captureException(mongoError instanceof Error ? mongoError : new Error(String(mongoError)), {
        requestId: req.id,
        route: req.path,
        publicId: cloudinaryResult.publicId,
      });
      await deleteFromCloudinary(cloudinaryResult.publicId, cloudinaryResult.resourceType);
      
      // Check for duplicate publicId error
      if (mongoError.code === 11000) {
        console.log('[Media] Duplicate publicId detected (unique constraint violation)');
        // Try to find existing media
        const existing = await Media.findOne({ 'cloudinary.publicId': cloudinaryResult.publicId });
        if (existing) {
          return res.status(200).json({
            mediaId: existing._id.toString(),
            secureUrl: existing.cloudinary.secureUrl,
            publicId: existing.cloudinary.publicId,
            width: existing.cloudinary.width,
            height: existing.cloudinary.height,
            duration: existing.cloudinary.duration,
            resourceType: existing.cloudinary.resourceType,
            purpose: existing.purpose,
            status: existing.status
          });
        }
        return sendValidationError(res, 'Media already exists', []);
      }
      
      return sendInternalError(res);
    }

    // Return normalized response from MongoDB
    res.status(201).json({
      mediaId: mediaDoc._id.toString(),
      secureUrl: mediaDoc.cloudinary.secureUrl,
      publicId: mediaDoc.cloudinary.publicId,
      width: mediaDoc.cloudinary.width,
      height: mediaDoc.cloudinary.height,
      duration: mediaDoc.cloudinary.duration,
      resourceType: mediaDoc.cloudinary.resourceType,
      purpose: mediaDoc.purpose,
      status: mediaDoc.status
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Media] Upload error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    sendInternalError(res);
  }
};

/**
 * Link media to an entity
 * 
 * POST /api/media/:mediaId/link
 * 
 * Body: { entityType, entityId }
 */
export const linkMedia = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    const { mediaId } = req.params;
    const { entityType, entityId } = req.body;

    if (!entityType || !entityId) {
      return sendValidationError(res, 'entityType and entityId are required', []);
    }

    if (!['nugget', 'user', 'post', 'collection'].includes(entityType)) {
      return sendValidationError(res, 'Invalid entityType', []);
    }

    if (!mongoose.Types.ObjectId.isValid(mediaId) || !mongoose.Types.ObjectId.isValid(entityId)) {
      return sendValidationError(res, 'Invalid mediaId or entityId', []);
    }

    // Find media and validate ownership
    const media = await Media.findById(mediaId);
    if (!media) {
      return sendNotFoundError(res, 'Media not found');
    }

    // Ownership validation
    if (media.ownerId.toString() !== userId) {
      return sendUnauthorizedError(res, 'You do not own this media');
    }

    // Update usedBy field
    media.usedBy = {
      entityType: entityType as any,
      entityId: new mongoose.Types.ObjectId(entityId)
    };
    media.status = 'active';
    await media.save();

    res.json({
      success: true,
      media: {
        mediaId: media._id.toString(),
        secureUrl: media.cloudinary.secureUrl,
        usedBy: media.usedBy
      }
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Media] Link error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    sendInternalError(res);
  }
};

/**
 * Delete media (safe deletion)
 * 
 * DELETE /api/media/:mediaId
 */
export const deleteMedia = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    const { mediaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return sendValidationError(res, 'Invalid mediaId', []);
    }

    // Find media and validate ownership
    const media = await Media.findById(mediaId);
    if (!media) {
      return sendNotFoundError(res, 'Media not found');
    }

    // Ownership validation
    if (media.ownerId.toString() !== userId) {
      return sendUnauthorizedError(res, 'You do not own this media');
    }

    // MongoDB-first: Mark as deleted
    media.status = 'deleted';
    media.deletedAt = new Date();
    await media.save();

    // Best-effort Cloudinary deletion (don't fail if this fails)
    const deleted = await deleteFromCloudinary(
      media.cloudinary.publicId,
      media.cloudinary.resourceType
    );

    if (!deleted) {
      console.warn(`[Media] Cloudinary deletion failed for ${media.cloudinary.publicId}, but MongoDB record marked as deleted`);
    }

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Media] Delete error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    sendInternalError(res);
  }
};

/**
 * Get media by ID
 * 
 * GET /api/media/:mediaId
 */
export const getMedia = async (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return sendValidationError(res, 'Invalid mediaId', []);
    }

    const media = await Media.findById(mediaId);
    if (!media) {
      return sendNotFoundError(res, 'Media not found');
    }

    // Only return active media
    if (media.status !== 'active') {
      return sendNotFoundError(res, 'Media not found');
    }

    res.json({
      mediaId: media._id.toString(),
      secureUrl: media.cloudinary.secureUrl,
      publicId: media.cloudinary.publicId,
      width: media.cloudinary.width,
      height: media.cloudinary.height,
      duration: media.cloudinary.duration,
      resourceType: media.cloudinary.resourceType,
      purpose: media.purpose,
      usedBy: media.usedBy
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Media] Get error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    sendInternalError(res);
  }
};

