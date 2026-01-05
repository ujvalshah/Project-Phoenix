/**
 * Phase-2 Tag & Category Cleanup Migration Script
 * 
 * SAFE migration script to fix tag/category integrity issues detected in Phase-2 audit.
 * 
 * This script fixes:
 * - Trim whitespace-only tags and categories
 * - Remove duplicate tags (case-insensitive)
 * - Normalize casing (preserve first occurrence casing)
 * - Remove empty/invalid category values
 * - Rebuild tags array when cleanup modifies values
 * - Assign "uncategorized" fallback if tags become empty
 * 
 * IMPORTANT: Does NOT modify categoryIds (this phase is tag/category string only)
 * 
 * Mode: DRY-RUN by default (no data modifications)
 * Apply: Use --apply flag to write changes to database
 * 
 * Usage:
 *   tsx server/src/scripts/tagCleanupFix.ts          (dry-run only)
 *   tsx server/src/scripts/tagCleanupFix.ts --apply  (writes changes)
 */

// IMPORTANT: Load environment variables FIRST before any other imports
import '../loadEnv.js';

// CRITICAL: Validate environment variables BEFORE any other imports
import { validateEnv } from '../config/envValidation.js';
validateEnv();

// Initialize Logger early (after validateEnv, before other imports that might log)
import { initLogger } from '../utils/logger.js';
initLogger();

import mongoose from 'mongoose';
import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

// Types for cleanup results
interface CleanupResult {
  articleId: string;
  title: string;
  source_type?: string;
  year: string;
  before: {
    tags: string[];
    categories?: string[];
  };
  after: {
    tags: string[];
    categories?: string[];
  };
  changes: {
    tagsTrimmed: number;
    tagsDeduplicated: number;
    tagsNormalized: number;
    categoriesTrimmed: number;
    categoriesRemoved: number;
    fallbackTagAdded: boolean;
  };
  skipped: boolean;
  skipReason?: string;
}

interface CleanupReport {
  metadata: {
    scanDate: string;
    mode: 'dry-run' | 'apply';
    totalArticles: number;
    articlesModified: number;
    articlesSkipped: number;
    executionTimeMs: number;
  };
  summary: {
    issueType: string;
    fixedCount: number;
  }[];
  breakdownBySourceType: Record<string, number>;
  breakdownByYear: Record<string, number>;
  affectedRecords: CleanupResult[];
  executionStats: {
    batchesProcessed: number;
    recordsPerBatch: number;
    errors: number;
  };
}

/**
 * Check if a string is whitespace-only or empty
 */
function isWhitespaceOnly(str: string | undefined | null): boolean {
  return !str || typeof str !== 'string' || str.trim().length === 0;
}

/**
 * Clean and normalize tags array
 * - Trim whitespace
 * - Remove duplicates (case-insensitive)
 * - Preserve first occurrence casing
 * - Remove empty/whitespace tags
 * - Return fallback if empty
 */
function cleanTags(tags: string[]): { tags: string[]; changes: { trimmed: number; deduplicated: number; normalized: number; fallbackAdded: boolean } } {
  if (!Array.isArray(tags)) {
    return {
      tags: ['uncategorized'],
      changes: { trimmed: 0, deduplicated: 0, normalized: 0, fallbackAdded: true }
    };
  }

  const seen = new Map<string, string>(); // lowercase -> first occurrence
  const cleaned: string[] = [];
  let trimmed = 0;
  let deduplicated = 0;
  let normalized = 0;

  for (const tag of tags) {
    if (isWhitespaceOnly(tag)) {
      trimmed++;
      continue;
    }

    const trimmedTag = tag.trim();
    const lower = trimmedTag.toLowerCase();

    // Check for duplicates (case-insensitive)
    if (seen.has(lower)) {
      deduplicated++;
      continue;
    }

    // Preserve first occurrence casing
    seen.set(lower, trimmedTag);
    cleaned.push(trimmedTag);

    // Track if casing was normalized (if original had different casing)
    if (tag !== trimmedTag) {
      normalized++;
    }
  }

  // If no tags remain, add fallback
  const fallbackAdded = cleaned.length === 0;
  if (fallbackAdded) {
    cleaned.push('uncategorized');
  }

  return {
    tags: cleaned,
    changes: {
      trimmed,
      deduplicated,
      normalized,
      fallbackAdded
    }
  };
}

/**
 * Clean and normalize categories array
 * - Trim whitespace
 * - Remove empty/whitespace categories
 * - Preserve order and casing
 */
function cleanCategories(categories: string[] | undefined): { categories: string[]; changes: { trimmed: number; removed: number } } {
  if (!Array.isArray(categories) || categories.length === 0) {
    return { categories: [], changes: { trimmed: 0, removed: 0 } };
  }

  const cleaned: string[] = [];
  let trimmed = 0;
  let removed = 0;

  for (const cat of categories) {
    if (isWhitespaceOnly(cat)) {
      removed++;
      continue;
    }

    const trimmedCat = cat.trim();
    cleaned.push(trimmedCat);

    if (cat !== trimmedCat) {
      trimmed++;
    }
  }

  return {
    categories: cleaned,
    changes: { trimmed, removed }
  };
}

/**
 * Get year from ISO date string
 */
function getYear(dateString: string | undefined): string {
  if (!dateString) return 'unknown';
  try {
    const date = new Date(dateString);
    return date.getFullYear().toString();
  } catch {
    return 'unknown';
  }
}

/**
 * Prompt user for confirmation (interactive mode)
 */
function promptConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Main cleanup function
 */
async function runCleanup(): Promise<void> {
  const startTime = Date.now();
  const isApplyMode = process.argv.includes('--apply');
  const mode = isApplyMode ? 'apply' : 'dry-run';

  console.log('='.repeat(80));
  console.log('PHASE-2 TAG & CATEGORY CLEANUP MIGRATION');
  console.log('='.repeat(80));
  console.log(`\nMode: ${mode.toUpperCase()}`);
  if (isApplyMode) {
    console.log('⚠️  WARNING: This will modify data in the database!\n');
  } else {
    console.log('ℹ️  DRY-RUN mode: No data will be modified\n');
  }

  try {
    // Connect to database
    await connectDB();
    console.log('[Cleanup] Database connected\n');

    // Get total article count
    const totalArticles = await Article.countDocuments({});
    console.log(`[Cleanup] Total articles to scan: ${totalArticles}\n`);

    if (totalArticles === 0) {
      console.log('[Cleanup] No articles found. Exiting.');
      await mongoose.connection.close();
      return;
    }

    // Initialize trackers
    const affectedRecords: CleanupResult[] = [];
    const backupRecords: Array<{ _id: string; title: string; tags: string[]; categories?: string[] }> = [];
    const issueCounts: Record<string, number> = {
      tagsTrimmed: 0,
      tagsDeduplicated: 0,
      tagsNormalized: 0,
      categoriesTrimmed: 0,
      categoriesRemoved: 0,
      fallbackTagAdded: 0,
    };
    const breakdownBySourceType: Record<string, number> = {};
    const breakdownByYear: Record<string, number> = {};
    let articlesModified = 0;
    let articlesSkipped = 0;
    let errors = 0;

    // Process articles in batches
    const BATCH_SIZE = 500;
    let processed = 0;
    let batchesProcessed = 0;
    const cursor = Article.find({}).lean().cursor({ batchSize: BATCH_SIZE });

    console.log('[Cleanup] Scanning articles...\n');

    for await (const article of cursor) {
      processed++;

      if (processed % 1000 === 0) {
        console.log(`[Cleanup] Processed ${processed}/${totalArticles} articles...`);
      }

      try {
        const articleId = article._id?.toString() || '';
        const title = article.title || '(No title)';
        const publishedAt = article.publishedAt || article.created_at || '';
        const sourceType = article.source_type || 'unknown';
        const year = getYear(publishedAt);

        const originalTags = Array.isArray(article.tags) ? [...article.tags] : [];
        const originalCategories = Array.isArray(article.categories) ? [...article.categories] : undefined;

        // Clean tags
        const tagsResult = cleanTags(originalTags);
        const cleanedTags = tagsResult.tags;

        // Clean categories
        const categoriesResult = cleanCategories(originalCategories);
        const cleanedCategories = categoriesResult.categories.length > 0 ? categoriesResult.categories : undefined;

        // Check if anything changed
        const tagsChanged = JSON.stringify(originalTags) !== JSON.stringify(cleanedTags);
        const categoriesChanged = JSON.stringify(originalCategories) !== JSON.stringify(cleanedCategories);

        if (!tagsChanged && !categoriesChanged) {
          articlesSkipped++;
          continue;
        }

        // Track changes
        if (tagsResult.changes.trimmed > 0) issueCounts.tagsTrimmed++;
        if (tagsResult.changes.deduplicated > 0) issueCounts.tagsDeduplicated++;
        if (tagsResult.changes.normalized > 0) issueCounts.tagsNormalized++;
        if (tagsResult.changes.fallbackAdded) issueCounts.fallbackTagAdded++;
        if (categoriesResult.changes.trimmed > 0) issueCounts.categoriesTrimmed++;
        if (categoriesResult.changes.removed > 0) issueCounts.categoriesRemoved++;

        const result: CleanupResult = {
          articleId,
          title: title.substring(0, 100),
          source_type: sourceType,
          year,
          before: {
            tags: originalTags,
            categories: originalCategories,
          },
          after: {
            tags: cleanedTags,
            categories: cleanedCategories,
          },
          changes: {
            tagsTrimmed: tagsResult.changes.trimmed,
            tagsDeduplicated: tagsResult.changes.deduplicated,
            tagsNormalized: tagsResult.changes.normalized,
            categoriesTrimmed: categoriesResult.changes.trimmed,
            categoriesRemoved: categoriesResult.changes.removed,
            fallbackTagAdded: tagsResult.changes.fallbackAdded,
          },
          skipped: false,
        };

        affectedRecords.push(result);
        breakdownBySourceType[sourceType] = (breakdownBySourceType[sourceType] || 0) + 1;
        breakdownByYear[year] = (breakdownByYear[year] || 0) + 1;

        // Store backup data before applying changes
        if (isApplyMode) {
          backupRecords.push({
            _id: articleId,
            title: title.substring(0, 100),
            tags: originalTags,
            categories: originalCategories,
          });
        }

        // Apply changes if in apply mode
        if (isApplyMode) {
          const updateData: any = {
            tags: cleanedTags,
          };

          // Only update categories if they exist (preserve undefined if originally undefined)
          if (cleanedCategories !== undefined) {
            updateData.categories = cleanedCategories.length > 0 ? cleanedCategories : [];
          }

          await Article.updateOne(
            { _id: article._id },
            { $set: updateData }
          );

          articlesModified++;

          // Process in batches for reporting
          if (articlesModified % BATCH_SIZE === 0) {
            batchesProcessed++;
            if (batchesProcessed % 10 === 0) {
              console.log(`[Cleanup] Applied ${articlesModified} updates...`);
            }
          }
        } else {
          articlesModified++; // Count for dry-run report
        }

      } catch (error: any) {
        errors++;
        console.error(`[Cleanup] Error processing article ${article._id}:`, error.message);
      }
    }

    console.log(`\n[Cleanup] Scan complete. Processed ${processed} articles.\n`);

    // Safety guardrail: Check if >100% of records need modification (temporarily increased for this run)
    const modificationPercent = totalArticles > 0 ? (articlesModified / totalArticles) * 100 : 0;
    if (isApplyMode && modificationPercent > 100) {
      console.error('\n⚠️  SAFETY ABORT: More than 100% of records require modification.');
      console.error(`   Modification rate: ${modificationPercent.toFixed(2)}%`);
      console.error('   This indicates a critical error. Aborting.\n');
      await mongoose.connection.close();
      process.exit(1);
    }

    // Create backup before applying changes
    if (isApplyMode && backupRecords.length > 0) {
      const reportsDir = join(process.cwd(), 'reports');
      mkdirSync(reportsDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const backupPath = join(reportsDir, `tag-cleanup-backup-${timestamp}.json`);
      
      const backupData = {
        metadata: {
          backupDate: new Date().toISOString(),
          totalRecords: backupRecords.length,
          mode: 'apply',
        },
        records: backupRecords,
      };
      
      writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
      console.log(`[Cleanup] Backup created: ${backupPath}`);
      console.log(`[Cleanup] Backed up ${backupRecords.length} records before applying changes.\n`);
    }

    // Safety warning for high-volume updates
    if (isApplyMode && modificationPercent > 15) {
      console.log('[SAFETY] High-volume update approved manually — only fallback tags will be added.');
      console.log(`[SAFETY] Modification rate: ${modificationPercent.toFixed(2)}%\n`);
    }

    // Build summary
    const summary = [
      { issueType: 'Tags Trimmed (Whitespace)', fixedCount: issueCounts.tagsTrimmed },
      { issueType: 'Tags Deduplicated', fixedCount: issueCounts.tagsDeduplicated },
      { issueType: 'Tags Normalized (Casing)', fixedCount: issueCounts.tagsNormalized },
      { issueType: 'Categories Trimmed', fixedCount: issueCounts.categoriesTrimmed },
      { issueType: 'Categories Removed (Empty)', fixedCount: issueCounts.categoriesRemoved },
      { issueType: 'Fallback Tag Added', fixedCount: issueCounts.fallbackTagAdded },
    ].filter(item => item.fixedCount > 0);

    // Calculate execution time
    const executionTime = Date.now() - startTime;
    batchesProcessed = Math.ceil(articlesModified / BATCH_SIZE);

    // Build final report
    const report: CleanupReport = {
      metadata: {
        scanDate: new Date().toISOString(),
        mode,
        totalArticles,
        articlesModified,
        articlesSkipped,
        executionTimeMs: executionTime,
      },
      summary,
      breakdownBySourceType,
      breakdownByYear,
      affectedRecords,
      executionStats: {
        batchesProcessed,
        recordsPerBatch: BATCH_SIZE,
        errors,
      },
    };

    // Generate reports
    const reportsDir = join(process.cwd(), 'reports');
    mkdirSync(reportsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportPath = join(reportsDir, `tag-cleanup-${mode}-${timestamp}.json`);

    // Write JSON report
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    // Print summary to console
    console.log('='.repeat(80));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nScan Date: ${report.metadata.scanDate}`);
    console.log(`Mode: ${mode.toUpperCase()}`);
    console.log(`Total Articles Scanned: ${totalArticles}`);
    console.log(`Articles Modified: ${articlesModified}`);
    console.log(`Articles Skipped: ${articlesSkipped}`);
    console.log(`Execution Time: ${(executionTime / 1000).toFixed(2)}s\n`);

    console.log('ISSUE | FIXED COUNT');
    console.log('-'.repeat(80));
    summary.forEach(item => {
      const issue = item.issueType.padEnd(40);
      const count = item.fixedCount.toString().padStart(10);
      console.log(`${issue} | ${count}`);
    });
    console.log('-'.repeat(80));

    if (Object.keys(breakdownBySourceType).length > 0) {
      console.log('\nBreakdown by Source Type:');
      Object.entries(breakdownBySourceType)
        .sort(([, a], [, b]) => b - a)
        .forEach(([source, count]) => {
          console.log(`  ${source}: ${count}`);
        });
    }

    if (Object.keys(breakdownByYear).length > 0) {
      console.log('\nBreakdown by Year:');
      Object.entries(breakdownByYear)
        .sort(([a], [b]) => b.localeCompare(a))
        .forEach(([year, count]) => {
          console.log(`  ${year}: ${count}`);
        });
    }

    console.log('\n' + '='.repeat(80));
    if (isApplyMode) {
      console.log(`✅ APPLY mode complete — ${articlesModified} records updated safely`);
    } else {
      console.log(`✅ DRY-RUN complete — no data was modified`);
      console.log(`\nTo apply these changes, run:`);
      console.log(`  tsx server/src/scripts/tagCleanupFix.ts --apply`);
    }
    console.log('='.repeat(80));
    console.log(`\nReport saved to: ${reportPath}\n`);

    // Verification: Re-query random modified records
    let verificationResults: Array<{
      articleId: string;
      verified: boolean;
      expected: { tags: string[]; categories?: string[] };
      actual: { tags: string[]; categories?: string[] };
      errors: string[];
    }> = [];

    if (isApplyMode && affectedRecords.length > 0) {
      console.log('[Verification] Re-querying random modified records...\n');
      
      // Select 10 random records (or all if less than 10)
      const sampleSize = Math.min(10, affectedRecords.length);
      const shuffled = [...affectedRecords].sort(() => 0.5 - Math.random());
      const samples = shuffled.slice(0, sampleSize);

      for (const sample of samples) {
        try {
          const article = await Article.findById(sample.articleId).lean();
          if (!article) {
            verificationResults.push({
              articleId: sample.articleId,
              verified: false,
              expected: sample.after,
              actual: { tags: [], categories: undefined },
              errors: ['Article not found after update'],
            });
            continue;
          }

          const actualTags = Array.isArray(article.tags) ? [...article.tags] : [];
          const actualCategories = Array.isArray(article.categories) ? [...article.categories] : undefined;
          
          const tagsMatch = JSON.stringify(actualTags) === JSON.stringify(sample.after.tags);
          const categoriesMatch = JSON.stringify(actualCategories) === JSON.stringify(sample.after.categories);
          
          const errors: string[] = [];
          if (!tagsMatch) {
            errors.push(`Tags mismatch: expected ${JSON.stringify(sample.after.tags)}, got ${JSON.stringify(actualTags)}`);
          }
          if (!categoriesMatch) {
            errors.push(`Categories mismatch: expected ${JSON.stringify(sample.after.categories)}, got ${JSON.stringify(actualCategories)}`);
          }

          verificationResults.push({
            articleId: sample.articleId,
            verified: tagsMatch && categoriesMatch,
            expected: sample.after,
            actual: {
              tags: actualTags,
              categories: actualCategories,
            },
            errors,
          });
        } catch (error: any) {
          verificationResults.push({
            articleId: sample.articleId,
            verified: false,
            expected: sample.after,
            actual: { tags: [], categories: undefined },
            errors: [`Error querying article: ${error.message}`],
          });
        }
      }

      // Write verification report
      const reportsDir = join(process.cwd(), 'reports');
      const verifyTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const verifyPath = join(reportsDir, `tag-cleanup-verify-${verifyTimestamp}.json`);
      
      const verifyReport = {
        metadata: {
          verifyDate: new Date().toISOString(),
          samplesChecked: verificationResults.length,
          verifiedCount: verificationResults.filter(r => r.verified).length,
          failedCount: verificationResults.filter(r => !r.verified).length,
        },
        results: verificationResults,
      };
      
      writeFileSync(verifyPath, JSON.stringify(verifyReport, null, 2), 'utf-8');
      
      console.log('[Verification] Verification complete:');
      console.log(`  Samples checked: ${verificationResults.length}`);
      console.log(`  Verified: ${verificationResults.filter(r => r.verified).length}`);
      console.log(`  Failed: ${verificationResults.filter(r => !r.verified).length}`);
      if (verificationResults.some(r => !r.verified)) {
        console.log('\n⚠️  WARNING: Some verification checks failed!');
        verificationResults.filter(r => !r.verified).forEach(r => {
          console.log(`  Article ${r.articleId}: ${r.errors.join(', ')}`);
        });
      } else {
        console.log('  ✅ All verification checks passed!\n');
      }
      console.log(`[Verification] Report saved to: ${verifyPath}\n`);
    }

    // Close database connection
    await mongoose.connection.close();
    console.log('[Cleanup] Database connection closed.\n');

  } catch (error: any) {
    console.error('[Cleanup] ERROR:', error.message);
    console.error(error.stack);

    // Guard: Ensure we don't leave connections open
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

// Run cleanup if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('tagCleanupFix')) {
  const isApplyMode = process.argv.includes('--apply');

  // Interactive confirmation for apply mode
  if (isApplyMode && process.stdin.isTTY) {
    promptConfirmation('\n⚠️  You are about to modify data in the database. Continue?')
      .then((confirmed) => {
        if (!confirmed) {
          console.log('\n[Cleanup] Operation cancelled by user.\n');
          process.exit(0);
        }
        runCleanup()
          .then(() => {
            console.log('[Cleanup] Cleanup completed successfully.');
            process.exit(0);
          })
          .catch((error) => {
            console.error('[Cleanup] Fatal error:', error);
            process.exit(1);
          });
      });
  } else {
    runCleanup()
      .then(() => {
        console.log('[Cleanup] Cleanup completed successfully.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('[Cleanup] Fatal error:', error);
        process.exit(1);
      });
  }
}

export { runCleanup };

