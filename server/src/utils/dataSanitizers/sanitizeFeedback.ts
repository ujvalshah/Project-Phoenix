/**
 * Sanitize Feedback: Handle orphaned user references (conditional cleanup)
 */

import { Feedback } from '../../models/Feedback.js';
import { CleanupResult } from './types.js';

export async function sanitizeFeedback(dryRun: boolean = true): Promise<CleanupResult> {
  const result: CleanupResult = {
    collection: 'Feedback',
    operation: 'Audit orphaned feedback references (read-only, no cleanup)',
    recordsScanned: 0,
    recordsCleaned: 0,
    recordsSkipped: 0,
    errors: []
  };

  try {
    const feedbacks = await Feedback.find({}).lean();
    result.recordsScanned = feedbacks.length;

    // Feedback may have historical value even if user is deleted
    // We don't auto-clean them - marked for CONDITIONAL_CLEANUP
    if (dryRun) {
      console.log(`[DRY RUN] Found ${feedbacks.length} feedback entries. No automatic cleanup performed (requires manual review).`);
    } else {
      console.log(`[INFO] Feedback entries require manual review. No automatic cleanup performed.`);
    }

    result.recordsSkipped = feedbacks.length;

  } catch (error: any) {
    result.errors.push(`Error auditing feedback: ${error.message}`);
  }

  return result;
}











