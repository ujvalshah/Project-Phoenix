import mongoose from 'mongoose';
import { Media } from '../models/Media.js';
import { deleteFromCloudinary, isCloudinaryConfigured } from './cloudinaryService.js';
import { getLogger } from '../utils/logger.js';

/**
 * Media Cleanup Service
 * Handles orphaned media cleanup and scheduled maintenance
 * 
 * CRITICAL: MongoDB-driven cleanup. Never delete from Cloudinary
 * without checking MongoDB first.
 */

/**
 * Find and clean up orphaned media
 * 
 * Orphaned media criteria:
 * - status: 'orphaned'
 * - OR usedBy missing after X minutes (configurable, default 1 hour)
 * 
 * @param orphanAgeMinutes - How long media must be orphaned before cleanup (default: 60)
 * @returns Number of media records cleaned up
 */
export async function cleanupOrphanedMedia(orphanAgeMinutes: number = 60): Promise<number> {
  const logger = getLogger();
  
  if (!isCloudinaryConfigured()) {
    logger.warn('[MediaCleanup] Cloudinary not configured, skipping cleanup');
    return 0;
  }

  try {
    const orphanCutoff = new Date(Date.now() - orphanAgeMinutes * 60 * 1000);

    // Find orphaned media:
    // 1. Status is 'orphaned'
    // 2. OR status is 'active' but usedBy is missing and created more than X minutes ago
    const orphanedMedia = await Media.find({
      $or: [
        { status: 'orphaned' },
        {
          status: 'active',
          $or: [
            { usedBy: { $exists: false } },
            { usedBy: null }
          ],
          createdAt: { $lt: orphanCutoff }
        }
      ]
    }).limit(100); // Process in batches

    if (orphanedMedia.length === 0) {
      logger.info('[MediaCleanup] No orphaned media found');
      return 0;
    }

    logger.info({
      msg: 'Starting orphaned media cleanup',
      count: orphanedMedia.length
    });

    let deletedCount = 0;
    let cloudinaryDeletedCount = 0;

    for (const media of orphanedMedia) {
      try {
        // Delete from Cloudinary (best-effort)
        const cloudinaryDeleted = await deleteFromCloudinary(
          media.cloudinary.publicId,
          media.cloudinary.resourceType
        );

        if (cloudinaryDeleted) {
          cloudinaryDeletedCount++;
        }

        // Mark as deleted in MongoDB
        media.status = 'deleted';
        media.deletedAt = new Date();
        await media.save();
        deletedCount++;

      } catch (error: any) {
        // Log but continue with other media
        logger.error({
          msg: 'Error cleaning up orphaned media',
          mediaId: media._id.toString(),
          error: error.message
        });
      }
    }

    logger.info({
      msg: 'Orphaned media cleanup completed',
      total: orphanedMedia.length,
      deleted: deletedCount,
      cloudinaryDeleted: cloudinaryDeletedCount
    });

    return deletedCount;
  } catch (error: any) {
    logger.error({
      msg: 'Orphaned media cleanup failed',
      error: error.message
    });
    throw error;
  }
}

/**
 * Mark media as orphaned when entity is deleted
 * 
 * @param entityType - Type of entity that was deleted
 * @param entityId - ID of entity that was deleted
 */
export async function markMediaAsOrphaned(
  entityType: 'nugget' | 'user' | 'post' | 'collection',
  entityId: string
): Promise<number> {
  const logger = getLogger();
  
  try {
    const result = await Media.updateMany(
      {
        'usedBy.entityType': entityType,
        'usedBy.entityId': new mongoose.Types.ObjectId(entityId),
        status: 'active'
      },
      {
        $set: {
          status: 'orphaned',
          'usedBy': null
        }
      }
    );

    logger.info({
      msg: 'Marked media as orphaned',
      entityType,
      entityId,
      count: result.modifiedCount
    });

    return result.modifiedCount;
  } catch (error: any) {
    logger.error({
      msg: 'Failed to mark media as orphaned',
      entityType,
      entityId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get storage statistics for a user
 * 
 * @param userId - User ID
 * @returns Storage statistics
 */
export async function getUserStorageStats(userId: string): Promise<{
  totalFiles: number;
  totalBytes: number;
  activeFiles: number;
  activeBytes: number;
}> {
  const logger = getLogger();
  
  try {
    const allMedia = await Media.find({ ownerId: userId });
    const activeMedia = await Media.find({ ownerId: userId, status: 'active' });

    const totalBytes = allMedia.reduce((sum, m) => sum + (m.cloudinary.bytes || 0), 0);
    const activeBytes = activeMedia.reduce((sum, m) => sum + (m.cloudinary.bytes || 0), 0);

    return {
      totalFiles: allMedia.length,
      totalBytes,
      activeFiles: activeMedia.length,
      activeBytes
    };
  } catch (error: any) {
    logger.error({
      msg: 'Failed to get user storage stats',
      userId,
      error: error.message
    });
    throw error;
  }
}

