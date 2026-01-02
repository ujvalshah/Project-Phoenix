#!/usr/bin/env node
/**
 * Database Sanitization Script
 * 
 * PHASE 1: Discovery (Read-Only Audit)
 * PHASE 2: Safe Cleanup Plan
 * PHASE 3: Execute Cleanup (with dry-run protection)
 * PHASE 4: Verification
 * 
 * Usage:
 *   npm run sanitize:dry-run    # Discovery only (default)
 *   npm run sanitize:execute    # Execute cleanup (requires confirmation)
 * 
 * Environment Variables:
 *   DRY_RUN=true              # Force dry-run mode
 *   FORCE_EXECUTE=false      # Require explicit confirmation
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../src/utils/db.js';
import {
  discoverAllIssues,
  generateReport,
  writeReportToFile,
  sanitizeCollections,
  sanitizeBookmarks,
  sanitizeBookmarkFolders,
  sanitizeBookmarkFolderLinks,
  sanitizeReports,
  sanitizeModerationAuditLog,
  sanitizeFeedback,
  SanitizationStats,
  CleanupResult
} from '../src/utils/dataSanitizers/index.js';
import { verifyDatabaseIntegrity, printVerificationResults } from '../src/utils/dataSanitizers/verification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../..');

// Load environment variables
dotenv.config({ path: path.join(rootPath, '.env') });

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to true
const FORCE_EXECUTE = process.env.FORCE_EXECUTE === 'true';

async function main() {
  console.log('='.repeat(80));
  console.log('DATABASE SANITIZATION SYSTEM');
  console.log('='.repeat(80));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (No data will be modified)' : '⚠️ EXECUTION MODE (Data will be modified)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    // Connect to database
    console.log('[1/5] Connecting to database...');
    await connectDB();
    console.log('✓ Database connected\n');

    // PHASE 1: Discovery
    console.log('[2/5] PHASE 1: Discovery (Read-Only Audit)');
    console.log('-'.repeat(80));
    const issues = await discoverAllIssues();
    console.log('');

    // Generate report
    const report = generateReport(issues, DRY_RUN);
    const reportPath = await writeReportToFile(report);
    console.log(`✓ Sanitization report written to: ${reportPath}\n`);

    // Print summary
    console.log('DISCOVERY SUMMARY:');
    console.log(`- Total Issue Types: ${report.summary.totalIssues}`);
    console.log(`- Total Affected Records: ${report.summary.totalAffectedRecords}`);
    console.log(`- Safe Auto-Fix: ${report.summary.byCategory.SAFE_AUTO_FIX}`);
    console.log(`- Conditional Cleanup: ${report.summary.byCategory.CONDITIONAL_CLEANUP}`);
    console.log(`- Do Not Touch: ${report.summary.byCategory.DO_NOT_TOUCH}`);
    console.log('');

    // If dry-run, exit here
    if (DRY_RUN) {
      console.log('='.repeat(80));
      console.log('DRY RUN COMPLETE - No data was modified');
      console.log('='.repeat(80));
      console.log('');
      console.log('To execute cleanup, run:');
      console.log('  npm run sanitize:execute');
      console.log('');
      process.exit(0);
    }

    // PHASE 2: Confirmation (if not forced)
    if (!FORCE_EXECUTE) {
      console.log('[3/5] PHASE 2: Confirmation Required');
      console.log('-'.repeat(80));
      console.log('⚠️  WARNING: You are about to modify the database!');
      console.log('');
      console.log('This will:');
      console.log('- Remove orphaned references from collections');
      console.log('- Delete orphaned bookmarks, folders, and links');
      console.log('- Clean up invalid array entries');
      console.log('');
      console.log('Audit trail data (reports, moderation logs) will NOT be modified.');
      console.log('');
      console.log('To proceed, run:');
      console.log('  npm run sanitize:force');
      console.log('');
      process.exit(1);
    }

    // PHASE 3: Execute Cleanup
    console.log('[4/5] PHASE 3: Executing Cleanup');
    console.log('-'.repeat(80));

    const stats: SanitizationStats = {
      totalScanned: 0,
      totalCleaned: 0,
      totalSkipped: 0,
      totalErrors: 0,
      byCollection: {}
    };

    const sanitizers = [
      { name: 'Collections', fn: sanitizeCollections },
      { name: 'Bookmarks', fn: sanitizeBookmarks },
      { name: 'BookmarkFolders', fn: sanitizeBookmarkFolders },
      { name: 'BookmarkFolderLinks', fn: sanitizeBookmarkFolderLinks },
      { name: 'Reports', fn: sanitizeReports },
      { name: 'ModerationAuditLog', fn: sanitizeModerationAuditLog },
      { name: 'Feedback', fn: sanitizeFeedback }
    ];

    for (const sanitizer of sanitizers) {
      console.log(`\nCleaning ${sanitizer.name}...`);
      const result: CleanupResult = await sanitizer.fn(false); // false = execute mode
      
      stats.totalScanned += result.recordsScanned;
      stats.totalCleaned += result.recordsCleaned;
      stats.totalSkipped += result.recordsSkipped;
      stats.totalErrors += result.errors.length;
      stats.byCollection[result.collection] = result;

      if (result.errors.length > 0) {
        console.error(`  ⚠️  Errors: ${result.errors.length}`);
        result.errors.forEach(err => console.error(`    - ${err}`));
      } else {
        console.log(`  ✓ Scanned: ${result.recordsScanned}, Cleaned: ${result.recordsCleaned}, Skipped: ${result.recordsSkipped}`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('CLEANUP SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total Records Scanned: ${stats.totalScanned}`);
    console.log(`Total Records Cleaned: ${stats.totalCleaned}`);
    console.log(`Total Records Skipped: ${stats.totalSkipped}`);
    console.log(`Total Errors: ${stats.totalErrors}`);
    console.log('');

    // PHASE 4: Verification
    console.log('[5/5] PHASE 4: Verification');
    console.log('-'.repeat(80));
    console.log('Running post-cleanup verification...');

    // Run integrity checks
    const verificationResult = await verifyDatabaseIntegrity();
    printVerificationResults(verificationResult);

    // Re-run discovery to verify cleanup
    const postIssues = await discoverAllIssues();
    const postReport = generateReport(postIssues, false);
    
    console.log('');
    console.log('POST-CLEANUP DISCOVERY:');
    console.log(`- Remaining Issue Types: ${postReport.summary.totalIssues}`);
    console.log(`- Remaining Affected Records: ${postReport.summary.totalAffectedRecords}`);
    console.log('');

    if (postReport.summary.totalIssues > 0) {
      const postReportPath = await writeReportToFile(postReport, path.join(rootPath, `DATABASE_SANITIZATION_POST_CLEANUP_${Date.now()}.md`));
      console.log(`✓ Post-cleanup report written to: ${postReportPath}`);
      console.log('');
      console.log('⚠️  Some issues remain. These may require manual review.');
    } else {
      console.log('✓ All auto-fixable issues have been resolved!');
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('SANITIZATION COMPLETE');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('');
    console.error('='.repeat(80));
    console.error('ERROR: Sanitization failed');
    console.error('='.repeat(80));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    const mongoose = await import('mongoose');
    await mongoose.default.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

