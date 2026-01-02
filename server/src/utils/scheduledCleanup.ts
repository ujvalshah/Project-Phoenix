import { cleanupOrphanedMedia } from '../services/mediaCleanupService.js';
import { getLogger } from './logger.js';

/**
 * Scheduled Cleanup Job
 * Runs periodically to clean up orphaned media
 * 
 * This should be called by a cron job or scheduled task runner
 * Recommended: Run every 6 hours
 */

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start scheduled cleanup
 * 
 * @param intervalHours - How often to run cleanup (default: 6 hours)
 */
export function startScheduledCleanup(intervalHours: number = 6): void {
  const logger = getLogger();
  
  if (cleanupInterval) {
    logger.warn('[ScheduledCleanup] Cleanup already running');
    return;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  logger.info({
    msg: 'Starting scheduled media cleanup',
    intervalHours
  });

  // Run immediately on start
  runCleanup();

  // Then run on interval
  cleanupInterval = setInterval(() => {
    runCleanup();
  }, intervalMs);
}

/**
 * Stop scheduled cleanup
 */
export function stopScheduledCleanup(): void {
  const logger = getLogger();
  
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info({ msg: 'Stopped scheduled media cleanup' });
  }
}

/**
 * Run cleanup once
 */
async function runCleanup(): Promise<void> {
  const logger = getLogger();
  
  try {
    logger.info({ msg: 'Running scheduled orphaned media cleanup' });
    const deletedCount = await cleanupOrphanedMedia(60); // 60 minutes orphan age
    logger.info({
      msg: 'Scheduled cleanup completed',
      deletedCount
    });
  } catch (error: any) {
    logger.error({
      msg: 'Scheduled cleanup failed',
      error: error.message
    });
  }
}

/**
 * Manual cleanup trigger (for admin endpoints)
 */
export async function triggerCleanup(): Promise<number> {
  return await cleanupOrphanedMedia(60);
}

