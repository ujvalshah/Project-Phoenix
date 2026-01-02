/**
 * Sanitize Reports: Handle orphaned references (conditional cleanup)
 * 
 * Note: Reports are audit trail data, so we're conservative here.
 * We only clean obvious orphaned references that don't affect audit integrity.
 */

import { Report } from '../../models/Report.js';
import { CleanupResult } from './types.js';

export async function sanitizeReports(dryRun: boolean = true): Promise<CleanupResult> {
  const result: CleanupResult = {
    collection: 'Report',
    operation: 'Audit orphaned report references (read-only, no cleanup)',
    recordsScanned: 0,
    recordsCleaned: 0,
    recordsSkipped: 0,
    errors: []
  };

  try {
    const reports = await Report.find({}).lean();
    result.recordsScanned = reports.length;

    // Reports are audit trail data - we don't auto-clean them
    // They're marked for CONDITIONAL_CLEANUP and require manual review
    if (dryRun) {
      console.log(`[DRY RUN] Found ${reports.length} reports. No automatic cleanup performed (requires manual review).`);
    } else {
      console.log(`[INFO] Reports require manual review. No automatic cleanup performed.`);
    }

    // We could optionally set a flag or update metadata, but we don't delete
    result.recordsSkipped = reports.length;

  } catch (error: any) {
    result.errors.push(`Error auditing reports: ${error.message}`);
  }

  return result;
}











