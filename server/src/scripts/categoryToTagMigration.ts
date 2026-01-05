/**
 * TODO: LEGACY MIGRATION SCRIPT - Can be removed after migration is complete
 * Category to Tag Migration Script
 * 
 * Migrates categories[] values into tags[] array for all articles.
 * 
 * This script:
 * - Scans all articles
 * - If categories[] contains values not already in tags[], adds them to tags[]
 * - Normalizes casing + trims whitespace
 * - Deduplicates tags (case-insensitive)
 * - Writes changes only when a diff exists
 * 
 * Safety rules:
 * - Dry-run by default
 * - Abort apply if error rate > 0.5%
 * - Logs before/after tag arrays for changed records
 * 
 * Usage:
 *   tsx server/src/scripts/categoryToTagMigration.ts          (dry-run only)
 *   tsx server/src/scripts/categoryToTagMigration.ts --apply  (writes changes)
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

// Types for migration results
interface MigrationResult {
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
    categoriesMigrated: number;
    tagsAdded: string[];
    tagsNormalized: number;
    tagsDeduplicated: number;
  };
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

interface MigrationReport {
  metadata: {
    scanDate: string;
    mode: 'dry-run' | 'apply';
    totalArticles: number;
    articlesModified: number;
    articlesSkipped: number;
    articlesWithErrors: number;
    executionTimeMs: number;
  };
  summary: {
    totalCategoriesMigrated: number;
    totalTagsAdded: number;
    totalTagsNormalized: number;
    totalTagsDeduplicated: number;
    articlesWithCategories: number;
    articlesWithCategoriesNotInTags: number;
  };
  breakdownBySourceType: Record<string, number>;
  breakdownByYear: Record<string, number>;
  affectedRecords: MigrationResult[];
  executionStats: {
    batchesProcessed: number;
    recordsPerBatch: number;
    errors: number;
    errorRate: number;
  };
}

/**
 * Check if a string is whitespace-only or empty
 */
function isWhitespaceOnly(str: string | undefined | null): boolean {
  return !str || typeof str !== 'string' || str.trim().length === 0;
}

/**
 * Normalize a tag: trim whitespace and return lowercase for comparison
 */
function normalizeTagForComparison(tag: string): string {
  if (!tag || typeof tag !== 'string') return '';
  return tag.trim().toLowerCase();
}

/**
 * Check if a tag exists in tags array (case-insensitive)
 */
function tagExists(tag: string, tags: string[]): boolean {
  const normalized = normalizeTagForComparison(tag);
  return tags.some(t => normalizeTagForComparison(t) === normalized);
}

/**
 * Migrate categories to tags and normalize
 * - Adds categories[] values to tags[] if not already present (case-insensitive)
 * - Trims whitespace
 * - Normalizes casing (preserves first occurrence casing)
 * - Deduplicates tags (case-insensitive)
 */
function migrateCategoriesToTags(
  tags: string[],
  categories?: string[]
): {
  tags: string[];
  changes: {
    categoriesMigrated: number;
    tagsAdded: string[];
    tagsNormalized: number;
    tagsDeduplicated: number;
  };
} {
  // Initialize with existing tags
  if (!Array.isArray(tags)) {
    tags = [];
  }

  // Track seen tags (lowercase -> first occurrence casing)
  const seen = new Map<string, string>();
  const resultTags: string[] = [];
  let categoriesMigrated = 0;
  const tagsAdded: string[] = [];
  let tagsNormalized = 0;
  let tagsDeduplicated = 0;

  // First pass: Add existing tags (normalize and deduplicate)
  for (const tag of tags) {
    if (isWhitespaceOnly(tag)) {
      continue; // Skip whitespace-only tags
    }

    const trimmedTag = tag.trim();
    const lower = trimmedTag.toLowerCase();

    if (seen.has(lower)) {
      tagsDeduplicated++;
      continue; // Skip duplicates
    }

    seen.set(lower, trimmedTag);
    resultTags.push(trimmedTag);

    if (tag !== trimmedTag) {
      tagsNormalized++;
    }
  }

  // Second pass: Add categories that don't exist in tags (case-insensitive)
  if (Array.isArray(categories) && categories.length > 0) {
    for (const category of categories) {
      if (isWhitespaceOnly(category)) {
        continue; // Skip whitespace-only categories
      }

      const trimmedCategory = category.trim();
      const lower = trimmedCategory.toLowerCase();

      // Check if this category already exists in tags (case-insensitive)
      if (!seen.has(lower)) {
        // Category doesn't exist in tags, add it
        seen.set(lower, trimmedCategory);
        resultTags.push(trimmedCategory);
        tagsAdded.push(trimmedCategory);
        categoriesMigrated++;
      }
    }
  }

  return {
    tags: resultTags,
    changes: {
      categoriesMigrated,
      tagsAdded,
      tagsNormalized,
      tagsDeduplicated,
    },
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
 * Generate Markdown report from JSON report
 */
function generateMarkdownReport(report: MigrationReport, reportPath: string): string {
  const mdPath = reportPath.replace('.json', '.md');
  
  const md = `# Category to Tag Migration Report

## Metadata

- **Scan Date**: ${report.metadata.scanDate}
- **Mode**: ${report.metadata.mode.toUpperCase()}
- **Total Articles Scanned**: ${report.metadata.totalArticles}
- **Articles Modified**: ${report.metadata.articlesModified}
- **Articles Skipped**: ${report.metadata.articlesSkipped}
- **Articles With Errors**: ${report.metadata.articlesWithErrors}
- **Execution Time**: ${(report.metadata.executionTimeMs / 1000).toFixed(2)}s

## Summary

- **Total Categories Migrated**: ${report.summary.totalCategoriesMigrated}
- **Total Tags Added**: ${report.summary.totalTagsAdded}
- **Total Tags Normalized**: ${report.summary.totalTagsNormalized}
- **Total Tags Deduplicated**: ${report.summary.totalTagsDeduplicated}
- **Articles With Categories**: ${report.summary.articlesWithCategories}
- **Articles With Categories Not In Tags**: ${report.summary.articlesWithCategoriesNotInTags}

## Execution Stats

- **Batches Processed**: ${report.executionStats.batchesProcessed}
- **Records Per Batch**: ${report.executionStats.recordsPerBatch}
- **Errors**: ${report.executionStats.errors}
- **Error Rate**: ${(report.executionStats.errorRate * 100).toFixed(2)}%

## Breakdown by Source Type

${Object.entries(report.breakdownBySourceType)
  .sort(([, a], [, b]) => b - a)
  .map(([source, count]) => `- **${source}**: ${count}`)
  .join('\n')}

## Breakdown by Year

${Object.entries(report.breakdownByYear)
  .sort(([a], [b]) => b.localeCompare(a))
  .map(([year, count]) => `- **${year}**: ${count}`)
  .join('\n')}

## Affected Records

${report.affectedRecords.length === 0 
  ? 'No records were modified.' 
  : `### Sample Records (showing first 50)

${report.affectedRecords.slice(0, 50).map((record, idx) => {
  return `### Record ${idx + 1}

- **Article ID**: \`${record.articleId}\`
- **Title**: ${record.title}
- **Source Type**: ${record.source_type || 'unknown'}
- **Year**: ${record.year}
- **Before Tags**: ${JSON.stringify(record.before.tags)}
- **After Tags**: ${JSON.stringify(record.after.tags)}
- **Before Categories**: ${JSON.stringify(record.before.categories || [])}
- **After Categories**: ${JSON.stringify(record.after.categories || [])}
- **Changes**:
  - Categories Migrated: ${record.changes.categoriesMigrated}
  - Tags Added: ${record.changes.tagsAdded.length > 0 ? record.changes.tagsAdded.join(', ') : 'none'}
  - Tags Normalized: ${record.changes.tagsNormalized}
  - Tags Deduplicated: ${record.changes.tagsDeduplicated}
${record.error ? `- **Error**: ${record.error}` : ''}
`;
}).join('\n')}

${report.affectedRecords.length > 50 ? `\n*... and ${report.affectedRecords.length - 50} more records. See JSON report for full details.*` : ''}`}

---

*Report generated on ${new Date().toISOString()}*
`;

  writeFileSync(mdPath, md, 'utf-8');
  return mdPath;
}

/**
 * Main migration function
 */
async function runMigration(): Promise<void> {
  const startTime = Date.now();
  const isApplyMode = process.argv.includes('--apply');
  const mode = isApplyMode ? 'apply' : 'dry-run';

  console.log('='.repeat(80));
  console.log('CATEGORY TO TAG MIGRATION');
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
    console.log('[Migration] Database connected\n');

    // Get total article count
    const totalArticles = await Article.countDocuments({});
    console.log(`[Migration] Total articles to scan: ${totalArticles}\n`);

    if (totalArticles === 0) {
      console.log('[Migration] No articles found. Exiting.');
      await mongoose.connection.close();
      return;
    }

    // Initialize trackers
    const affectedRecords: MigrationResult[] = [];
    const backupRecords: Array<{ _id: string; title: string; tags: string[]; categories?: string[] }> = [];
    const breakdownBySourceType: Record<string, number> = {};
    const breakdownByYear: Record<string, number> = {};
    let articlesModified = 0;
    let articlesSkipped = 0;
    let errors = 0;
    let totalCategoriesMigrated = 0;
    let totalTagsAdded = 0;
    let totalTagsNormalized = 0;
    let totalTagsDeduplicated = 0;
    let articlesWithCategories = 0;
    let articlesWithCategoriesNotInTags = 0;

    // Process articles in batches
    const BATCH_SIZE = 500;
    let processed = 0;
    let batchesProcessed = 0;
    const cursor = Article.find({}).lean().cursor({ batchSize: BATCH_SIZE });

    console.log('[Migration] Scanning articles...\n');

    for await (const article of cursor) {
      processed++;

      if (processed % 1000 === 0) {
        console.log(`[Migration] Processed ${processed}/${totalArticles} articles...`);
      }

      try {
        const articleId = article._id?.toString() || '';
        const title = article.title || '(No title)';
        const publishedAt = article.publishedAt || article.created_at || '';
        const sourceType = article.source_type || 'unknown';
        const year = getYear(publishedAt);

        const originalTags = Array.isArray(article.tags) ? [...article.tags] : [];
        const originalCategories = Array.isArray(article.categories) ? [...article.categories] : undefined;

        // Track articles with categories
        if (originalCategories && originalCategories.length > 0) {
          articlesWithCategories++;
        }

        // Migrate categories to tags
        const migrationResult = migrateCategoriesToTags(originalTags, originalCategories);
        const migratedTags = migrationResult.tags;

        // Check if anything changed
        const tagsChanged = JSON.stringify(originalTags.sort()) !== JSON.stringify(migratedTags.sort());

        if (!tagsChanged) {
          articlesSkipped++;
          continue;
        }

        // Track articles with categories not in tags
        if (originalCategories && originalCategories.length > 0 && migrationResult.changes.categoriesMigrated > 0) {
          articlesWithCategoriesNotInTags++;
        }

        // Accumulate statistics
        totalCategoriesMigrated += migrationResult.changes.categoriesMigrated;
        totalTagsAdded += migrationResult.changes.tagsAdded.length;
        totalTagsNormalized += migrationResult.changes.tagsNormalized;
        totalTagsDeduplicated += migrationResult.changes.tagsDeduplicated;

        const result: MigrationResult = {
          articleId,
          title: title.substring(0, 100),
          source_type: sourceType,
          year,
          before: {
            tags: originalTags,
            categories: originalCategories,
          },
          after: {
            tags: migratedTags,
            categories: originalCategories, // Categories remain unchanged
          },
          changes: {
            categoriesMigrated: migrationResult.changes.categoriesMigrated,
            tagsAdded: migrationResult.changes.tagsAdded,
            tagsNormalized: migrationResult.changes.tagsNormalized,
            tagsDeduplicated: migrationResult.changes.tagsDeduplicated,
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
          await Article.updateOne(
            { _id: article._id },
            { $set: { tags: migratedTags } }
          );

          articlesModified++;

          // Process in batches for reporting
          if (articlesModified % BATCH_SIZE === 0) {
            batchesProcessed++;
            if (batchesProcessed % 10 === 0) {
              console.log(`[Migration] Applied ${articlesModified} updates...`);
            }
          }
        } else {
          articlesModified++; // Count for dry-run report
        }

      } catch (error: any) {
        errors++;
        const articleId = article._id?.toString() || 'unknown';
        const title = article.title || '(No title)';
        
        console.error(`[Migration] Error processing article ${articleId}:`, error.message);
        
        // Add error record
        affectedRecords.push({
          articleId,
          title: title.substring(0, 100),
          source_type: article.source_type || 'unknown',
          year: getYear(article.publishedAt || article.created_at),
          before: {
            tags: Array.isArray(article.tags) ? [...article.tags] : [],
            categories: Array.isArray(article.categories) ? [...article.categories] : undefined,
          },
          after: {
            tags: Array.isArray(article.tags) ? [...article.tags] : [],
            categories: Array.isArray(article.categories) ? [...article.categories] : undefined,
          },
          changes: {
            categoriesMigrated: 0,
            tagsAdded: [],
            tagsNormalized: 0,
            tagsDeduplicated: 0,
          },
          skipped: true,
          skipReason: 'Error during processing',
          error: error.message,
        });
      }
    }

    console.log(`\n[Migration] Scan complete. Processed ${processed} articles.\n`);

    // Calculate error rate
    const errorRate = processed > 0 ? errors / processed : 0;

    // Safety guardrail: Abort if error rate > 0.5%
    if (isApplyMode && errorRate > 0.005) {
      console.error('\n⚠️  SAFETY ABORT: Error rate exceeds 0.5% threshold.');
      console.error(`   Error rate: ${(errorRate * 100).toFixed(2)}%`);
      console.error(`   Errors: ${errors} out of ${processed} articles`);
      console.error('   Aborting to prevent data corruption.\n');
      await mongoose.connection.close();
      process.exit(1);
    }

    // Create backup before applying changes
    if (isApplyMode && backupRecords.length > 0) {
      const reportsDir = join(process.cwd(), 'reports');
      mkdirSync(reportsDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const backupPath = join(reportsDir, `category-to-tag-migration-backup-${timestamp}.json`);
      
      const backupData = {
        metadata: {
          backupDate: new Date().toISOString(),
          totalRecords: backupRecords.length,
          mode: 'apply',
        },
        records: backupRecords,
      };
      
      writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
      console.log(`[Migration] Backup created: ${backupPath}`);
      console.log(`[Migration] Backed up ${backupRecords.length} records before applying changes.\n`);
    }

    // Calculate execution time
    const executionTime = Date.now() - startTime;
    batchesProcessed = Math.ceil(articlesModified / BATCH_SIZE);

    // Build final report
    const report: MigrationReport = {
      metadata: {
        scanDate: new Date().toISOString(),
        mode,
        totalArticles,
        articlesModified,
        articlesSkipped,
        articlesWithErrors: errors,
        executionTimeMs: executionTime,
      },
      summary: {
        totalCategoriesMigrated,
        totalTagsAdded,
        totalTagsNormalized,
        totalTagsDeduplicated,
        articlesWithCategories,
        articlesWithCategoriesNotInTags,
      },
      breakdownBySourceType,
      breakdownByYear,
      affectedRecords,
      executionStats: {
        batchesProcessed,
        recordsPerBatch: BATCH_SIZE,
        errors,
        errorRate,
      },
    };

    // Generate reports
    const reportsDir = join(process.cwd(), 'reports');
    mkdirSync(reportsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportPath = join(reportsDir, `category-to-tag-migration-${mode}-${timestamp}.json`);

    // Write JSON report
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    // Generate Markdown report
    const mdPath = generateMarkdownReport(report, reportPath);

    // Print summary to console
    console.log('='.repeat(80));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nScan Date: ${report.metadata.scanDate}`);
    console.log(`Mode: ${mode.toUpperCase()}`);
    console.log(`Total Articles Scanned: ${totalArticles}`);
    console.log(`Articles Modified: ${articlesModified}`);
    console.log(`Articles Skipped: ${articlesSkipped}`);
    console.log(`Articles With Errors: ${errors}`);
    console.log(`Execution Time: ${(executionTime / 1000).toFixed(2)}s\n`);

    console.log('SUMMARY STATISTICS');
    console.log('-'.repeat(80));
    console.log(`Total Categories Migrated: ${totalCategoriesMigrated}`);
    console.log(`Total Tags Added: ${totalTagsAdded}`);
    console.log(`Total Tags Normalized: ${totalTagsNormalized}`);
    console.log(`Total Tags Deduplicated: ${totalTagsDeduplicated}`);
    console.log(`Articles With Categories: ${articlesWithCategories}`);
    console.log(`Articles With Categories Not In Tags: ${articlesWithCategoriesNotInTags}`);
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
      console.log(`  tsx server/src/scripts/categoryToTagMigration.ts --apply`);
    }
    console.log('='.repeat(80));
    console.log(`\nJSON Report saved to: ${reportPath}`);
    console.log(`Markdown Report saved to: ${mdPath}\n`);

    // Close database connection
    await mongoose.connection.close();
    console.log('[Migration] Database connection closed.\n');

  } catch (error: any) {
    console.error('[Migration] ERROR:', error.message);
    console.error(error.stack);

    // Guard: Ensure we don't leave connections open
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('categoryToTagMigration')) {
  const isApplyMode = process.argv.includes('--apply');

  // Interactive confirmation for apply mode
  if (isApplyMode && process.stdin.isTTY) {
    promptConfirmation('\n⚠️  You are about to modify data in the database. Continue?')
      .then((confirmed) => {
        if (!confirmed) {
          console.log('\n[Migration] Operation cancelled by user.\n');
          process.exit(0);
        }
        runMigration()
          .then(() => {
            console.log('[Migration] Migration completed successfully.');
            process.exit(0);
          })
          .catch((error) => {
            console.error('[Migration] Fatal error:', error);
            process.exit(1);
          });
      });
  } else {
    runMigration()
      .then(() => {
        console.log('[Migration] Migration completed successfully.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('[Migration] Fatal error:', error);
        process.exit(1);
      });
  }
}

export { runMigration };

