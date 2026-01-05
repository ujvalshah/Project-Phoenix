/**
 * TODO: LEGACY MIGRATION SCRIPT - Can be removed after migration is complete
 * Tag & Category Integrity Audit Script
 * 
 * PHASE 2: Read-only audit of tag/category integrity across all articles
 * 
 * This script:
 * - Scans all articles in the database
 * - Identifies integrity issues (empty tags, whitespace, duplicates, etc.)
 * - Generates structured reports (JSON + MD)
 * - Does NOT make any changes to the database
 * 
 * Usage:
 *   npm run script:tagAudit
 *   or
 *   tsx server/src/scripts/tagAuditReport.ts
 */

import mongoose from 'mongoose';
import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Types for audit results
interface ArticleSample {
  id: string;
  title: string;
  createdAt: string;
  publishedAt: string;
  source_type?: string;
  tags: string[];
  categories?: string[];
  categoryIds?: string[];
}

interface IssueReport {
  issueType: string;
  count: number;
  affectedPercent: number;
  samples: ArticleSample[];
  breakdownBySourceType: Record<string, number>;
  breakdownByYear: Record<string, number>;
  notes: string;
}

interface AuditReport {
  metadata: {
    scanDate: string;
    totalArticles: number;
    executionTimeMs: number;
  };
  summary: {
    issueType: string;
    count: number;
    affectedPercent: number;
    notes: string;
  }[];
  detailedReports: IssueReport[];
}

/**
 * Check if a tag is whitespace-only
 */
function isWhitespaceOnly(tag: string): boolean {
  return typeof tag === 'string' && tag.trim().length === 0;
}

/**
 * Check if tags array has duplicates (case-insensitive)
 */
function hasDuplicateTags(tags: string[]): boolean {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const normalized = new Set<string>();
  for (const tag of tags) {
    if (typeof tag === 'string') {
      const lower = tag.toLowerCase().trim();
      if (normalized.has(lower)) return true;
      normalized.add(lower);
    }
  }
  return false;
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
 * Main audit function
 */
async function runAudit(): Promise<void> {
  const startTime = Date.now();
  console.log('[Tag Audit] Starting read-only audit of tag/category integrity...\n');

  // Guard: Ensure we're in read-only mode
  console.log('[Tag Audit] MODE: Read-only (no mutations will be performed)\n');

  try {
    // Connect to database
    await connectDB();
    console.log('[Tag Audit] Database connected\n');

    // Get total article count
    const totalArticles = await Article.countDocuments({});
    console.log(`[Tag Audit] Total articles to scan: ${totalArticles}\n`);

    if (totalArticles === 0) {
      console.log('[Tag Audit] No articles found. Exiting.');
      await mongoose.connection.close();
      return;
    }

    // Initialize issue trackers
    const emptyTagsArticles: ArticleSample[] = [];
    const whitespaceTagsArticles: ArticleSample[] = [];
    const duplicateTagsArticles: ArticleSample[] = [];
    const badCategoriesArticles: ArticleSample[] = [];
    const missingCategoryIdsArticles: ArticleSample[] = [];
    const legacyStructureArticles: ArticleSample[] = [];

    // Breakdown counters
    const emptyTagsBySource: Record<string, number> = {};
    const emptyTagsByYear: Record<string, number> = {};
    const whitespaceTagsBySource: Record<string, number> = {};
    const whitespaceTagsByYear: Record<string, number> = {};
    const duplicateTagsBySource: Record<string, number> = {};
    const duplicateTagsByYear: Record<string, number> = {};
    const badCategoriesBySource: Record<string, number> = {};
    const badCategoriesByYear: Record<string, number> = {};
    const missingCategoryIdsBySource: Record<string, number> = {};
    const missingCategoryIdsByYear: Record<string, number> = {};
    const legacyBySource: Record<string, number> = {};
    const legacyByYear: Record<string, number> = {};

    // Process articles in batches using cursor
    const BATCH_SIZE = 1000;
    let processed = 0;
    let cursor = Article.find({}).lean().cursor({ batchSize: BATCH_SIZE });

    console.log('[Tag Audit] Scanning articles...\n');

    for await (const article of cursor) {
      processed++;
      if (processed % 1000 === 0) {
        console.log(`[Tag Audit] Processed ${processed}/${totalArticles} articles...`);
      }

      const articleId = article._id?.toString() || '';
      const title = article.title || '(No title)';
      const publishedAt = article.publishedAt || article.created_at || '';
      const sourceType = article.source_type || 'unknown';
      const year = getYear(publishedAt);

      const tags = Array.isArray(article.tags) ? article.tags : [];
      const categories = Array.isArray(article.categories) ? article.categories : [];
      const categoryIds = Array.isArray(article.categoryIds) ? article.categoryIds : [];

      const sample: ArticleSample = {
        id: articleId,
        title: title.substring(0, 100), // Truncate long titles
        createdAt: publishedAt,
        publishedAt,
        source_type: sourceType,
        tags: tags.slice(0, 10), // Limit sample tags
        categories: categories.length > 0 ? categories.slice(0, 10) : undefined,
        categoryIds: categoryIds.length > 0 ? categoryIds.slice(0, 10) : undefined,
      };

      // Issue 1: Empty tags array
      if (tags.length === 0) {
        emptyTagsArticles.push(sample);
        emptyTagsBySource[sourceType] = (emptyTagsBySource[sourceType] || 0) + 1;
        emptyTagsByYear[year] = (emptyTagsByYear[year] || 0) + 1;
      }

      // Issue 2: Whitespace-only tags
      const hasWhitespaceTags = tags.some(tag => isWhitespaceOnly(tag));
      if (hasWhitespaceTags) {
        whitespaceTagsArticles.push(sample);
        whitespaceTagsBySource[sourceType] = (whitespaceTagsBySource[sourceType] || 0) + 1;
        whitespaceTagsByYear[year] = (whitespaceTagsByYear[year] || 0) + 1;
      }

      // Issue 3: Duplicate tags (case-insensitive)
      if (hasDuplicateTags(tags)) {
        duplicateTagsArticles.push(sample);
        duplicateTagsBySource[sourceType] = (duplicateTagsBySource[sourceType] || 0) + 1;
        duplicateTagsByYear[year] = (duplicateTagsByYear[year] || 0) + 1;
      }

      // Issue 4: Bad categories (empty/whitespace)
      const hasBadCategories = categories.some(cat => 
        !cat || typeof cat !== 'string' || cat.trim().length === 0
      );
      if (hasBadCategories) {
        badCategoriesArticles.push(sample);
        badCategoriesBySource[sourceType] = (badCategoriesBySource[sourceType] || 0) + 1;
        badCategoriesByYear[year] = (badCategoriesByYear[year] || 0) + 1;
      }

      // Issue 5: Missing or mismatched categoryIds (DEPRECATED - categoryIds is no longer used)
      // Check if categories exist but categoryIds are missing or count doesn't match
      // ⚠️ DEPRECATION: categoryIds field is deprecated - this check is for legacy data audit only
      if (categories.length > 0) {
        if (categoryIds.length === 0) {
          missingCategoryIdsArticles.push(sample);
          missingCategoryIdsBySource[sourceType] = (missingCategoryIdsBySource[sourceType] || 0) + 1;
          missingCategoryIdsByYear[year] = (missingCategoryIdsByYear[year] || 0) + 1;
        }
      }

      // Issue 6: Legacy structure (no categories array, only category field)
      // This indicates articles created before the normalization migration
      if ((!categories || categories.length === 0) && article.category) {
        legacyStructureArticles.push(sample);
        legacyBySource[sourceType] = (legacyBySource[sourceType] || 0) + 1;
        legacyByYear[year] = (legacyByYear[year] || 0) + 1;
      }
    }

    console.log(`\n[Tag Audit] Scan complete. Processed ${processed} articles.\n`);

    // Build detailed reports
    const reports: IssueReport[] = [
      {
        issueType: 'empty_tags',
        count: emptyTagsArticles.length,
        affectedPercent: totalArticles > 0 ? (emptyTagsArticles.length / totalArticles) * 100 : 0,
        samples: emptyTagsArticles.slice(0, 20),
        breakdownBySourceType: emptyTagsBySource,
        breakdownByYear: emptyTagsByYear,
        notes: 'Articles with empty tags array (violates validation rule)',
      },
      {
        issueType: 'whitespace_tags',
        count: whitespaceTagsArticles.length,
        affectedPercent: totalArticles > 0 ? (whitespaceTagsArticles.length / totalArticles) * 100 : 0,
        samples: whitespaceTagsArticles.slice(0, 20),
        breakdownBySourceType: whitespaceTagsBySource,
        breakdownByYear: whitespaceTagsByYear,
        notes: 'Articles containing tags that are whitespace-only strings',
      },
      {
        issueType: 'duplicate_tags',
        count: duplicateTagsArticles.length,
        affectedPercent: totalArticles > 0 ? (duplicateTagsArticles.length / totalArticles) * 100 : 0,
        samples: duplicateTagsArticles.slice(0, 20),
        breakdownBySourceType: duplicateTagsBySource,
        breakdownByYear: duplicateTagsByYear,
        notes: 'Articles with duplicate tags (case-insensitive duplicates)',
      },
      {
        issueType: 'bad_categories',
        count: badCategoriesArticles.length,
        affectedPercent: totalArticles > 0 ? (badCategoriesArticles.length / totalArticles) * 100 : 0,
        samples: badCategoriesArticles.slice(0, 20),
        breakdownBySourceType: badCategoriesBySource,
        breakdownByYear: badCategoriesByYear,
        notes: 'Articles with categories containing empty or whitespace-only values',
      },
      {
        issueType: 'missing_categoryIds', // DEPRECATED: categoryIds is no longer used
        count: missingCategoryIdsArticles.length,
        affectedPercent: totalArticles > 0 ? (missingCategoryIdsArticles.length / totalArticles) * 100 : 0,
        samples: missingCategoryIdsArticles.slice(0, 20),
        breakdownBySourceType: missingCategoryIdsBySource,
        breakdownByYear: missingCategoryIdsByYear,
        notes: 'Articles with categories but missing categoryIds (Tag ObjectId references) - DEPRECATED: categoryIds is no longer used',
      },
      {
        issueType: 'legacy_structure',
        count: legacyStructureArticles.length,
        affectedPercent: totalArticles > 0 ? (legacyStructureArticles.length / totalArticles) * 100 : 0,
        samples: legacyStructureArticles.slice(0, 20),
        breakdownBySourceType: legacyBySource,
        breakdownByYear: legacyByYear,
        notes: 'Articles using legacy structure (only category field, no categories array)',
      },
    ];

    // Build summary
    const summary = reports.map(r => ({
      issueType: r.issueType,
      count: r.count,
      affectedPercent: Number(r.affectedPercent.toFixed(2)),
      notes: r.notes,
    }));

    // Calculate execution time
    const executionTime = Date.now() - startTime;

    // Build final report
    const auditReport: AuditReport = {
      metadata: {
        scanDate: new Date().toISOString(),
        totalArticles,
        executionTimeMs: executionTime,
      },
      summary,
      detailedReports: reports,
    };

    // Determine risk level
    const totalIssues = reports.reduce((sum, r) => sum + r.count, 0);
    const highRiskThreshold = totalArticles * 0.1; // 10% of articles
    const riskLevel = totalIssues > highRiskThreshold ? 'High risk — manual review required' : 'Low risk — cleanup can be automated';

    // Generate reports
    const reportsDir = join(process.cwd(), 'reports');
    mkdirSync(reportsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const jsonPath = join(reportsDir, `tag-audit-${timestamp}.json`);
    const mdPath = join(reportsDir, `tag-audit-${timestamp}.md`);

    // Write JSON report
    writeFileSync(jsonPath, JSON.stringify(auditReport, null, 2), 'utf-8');

    // Generate Markdown report
    const mdReport = generateMarkdownReport(auditReport, riskLevel);
    writeFileSync(mdPath, mdReport, 'utf-8');

    // Print summary to console
    console.log('='.repeat(80));
    console.log('TAG & CATEGORY INTEGRITY AUDIT REPORT');
    console.log('='.repeat(80));
    console.log(`\nScan Date: ${auditReport.metadata.scanDate}`);
    console.log(`Total Articles Scanned: ${auditReport.metadata.totalArticles}`);
    console.log(`Execution Time: ${(auditReport.metadata.executionTimeMs / 1000).toFixed(2)}s\n`);

    console.log('SUMMARY TABLE');
    console.log('-'.repeat(80));
    console.log('Issue Type          | Count | Affected % | Notes');
    console.log('-'.repeat(80));
    summary.forEach(item => {
      const type = item.issueType.padEnd(18);
      const count = item.count.toString().padStart(6);
      const percent = `${item.affectedPercent}%`.padStart(11);
      console.log(`${type} | ${count} | ${percent} | ${item.notes}`);
    });
    console.log('-'.repeat(80));

    console.log(`\nRisk Assessment: ${riskLevel}`);
    console.log(`\nTotal Issues Found: ${totalIssues}`);

    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDED NEXT STEPS (DO NOT EXECUTE AUTOMATICALLY)');
    console.log('='.repeat(80));
    console.log('\n1. Review the detailed reports in:');
    console.log(`   - JSON: ${jsonPath}`);
    console.log(`   - Markdown: ${mdPath}`);
    console.log('\n2. For each issue type, consider:');
    console.log('   - empty_tags: Apply normalization to add default tags or require user input');
    console.log('   - whitespace_tags: Run normalizeTags() utility to clean whitespace');
    console.log('   - duplicate_tags: Run normalizeTags() utility to deduplicate');
    console.log('   - bad_categories: Run normalizeCategories() utility to clean');
    console.log('   - missing_categoryIds: DEPRECATED - categoryIds is no longer used (legacy audit only)');
    console.log('   - legacy_structure: Migrate category field to categories array');
    console.log('\n3. Test normalization on a small sample before bulk operations');
    console.log('4. Create a migration script that uses the shared normalization utilities');
    console.log('5. Run migration in batches with rollback capability\n');

    console.log('='.repeat(80));
    console.log(`\nReports generated:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${mdPath}\n`);

    // Close database connection
    await mongoose.connection.close();
    console.log('[Tag Audit] Database connection closed.\n');

  } catch (error: any) {
    console.error('[Tag Audit] ERROR:', error.message);
    console.error(error.stack);
    
    // Guard: Ensure we don't leave connections open
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(report: AuditReport, riskLevel: string): string {
  let md = `# Tag & Category Integrity Audit Report\n\n`;
  md += `**Scan Date:** ${report.metadata.scanDate}\n`;
  md += `**Total Articles Scanned:** ${report.metadata.totalArticles}\n`;
  md += `**Execution Time:** ${(report.metadata.executionTimeMs / 1000).toFixed(2)}s\n\n`;
  md += `**Risk Assessment:** ${riskLevel}\n\n`;

  md += `## Summary Table\n\n`;
  md += `| Issue Type | Count | Affected % | Notes |\n`;
  md += `|------------|-------|------------|-------|\n`;
  report.summary.forEach(item => {
    md += `| ${item.issueType} | ${item.count} | ${item.affectedPercent}% | ${item.notes} |\n`;
  });
  md += `\n`;

  md += `## Detailed Reports\n\n`;
  report.detailedReports.forEach(detail => {
    md += `### ${detail.issueType}\n\n`;
    md += `**Count:** ${detail.count} (${detail.affectedPercent.toFixed(2)}%)\n\n`;
    md += `**Notes:** ${detail.notes}\n\n`;

    if (Object.keys(detail.breakdownBySourceType).length > 0) {
      md += `**Breakdown by Source Type:**\n\n`;
      md += `| Source Type | Count |\n`;
      md += `|-------------|-------|\n`;
      Object.entries(detail.breakdownBySourceType)
        .sort(([, a], [, b]) => b - a)
        .forEach(([source, count]) => {
          md += `| ${source} | ${count} |\n`;
        });
      md += `\n`;
    }

    if (Object.keys(detail.breakdownByYear).length > 0) {
      md += `**Breakdown by Year:**\n\n`;
      md += `| Year | Count |\n`;
      md += `|------|-------|\n`;
      Object.entries(detail.breakdownByYear)
        .sort(([a], [b]) => b.localeCompare(a))
        .forEach(([year, count]) => {
          md += `| ${year} | ${count} |\n`;
        });
      md += `\n`;
    }

    if (detail.samples.length > 0) {
      md += `**Sample Articles (showing up to 20):**\n\n`;
      md += `| ID | Title | Created At | Source Type | Tags |\n`;
      md += `|----|-------|------------|-------------|------|\n`;
      detail.samples.forEach(sample => {
        const title = (sample.title || '(No title)').replace(/\|/g, '\\|').substring(0, 50);
        const tags = (sample.tags || []).slice(0, 3).join(', ').substring(0, 30);
        md += `| ${sample.id.substring(0, 8)}... | ${title} | ${sample.createdAt.substring(0, 10)} | ${sample.source_type || 'unknown'} | ${tags || '(none)'} |\n`;
      });
      md += `\n`;
    }
  });

  md += `## Recommended Next Steps\n\n`;
  md += `1. Review the detailed reports above\n`;
  md += `2. For each issue type, consider the recommended actions:\n`;
  md += `   - **empty_tags**: Apply normalization to add default tags or require user input\n`;
  md += `   - **whitespace_tags**: Run normalizeTags() utility to clean whitespace\n`;
  md += `   - **duplicate_tags**: Run normalizeTags() utility to deduplicate\n`;
  md += `   - **bad_categories**: Run normalizeCategories() utility to clean\n`;
  md += `   - **missing_categoryIds**: DEPRECATED - categoryIds is no longer used (legacy audit only)\n`;
  md += `   - **legacy_structure**: Migrate category field to categories array\n`;
  md += `3. Test normalization on a small sample before bulk operations\n`;
  md += `4. Create a migration script that uses the shared normalization utilities\n`;
  md += `5. Run migration in batches with rollback capability\n\n`;

  return md;
}

// Run audit if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('tagAuditReport')) {
  runAudit()
    .then(() => {
      console.log('[Tag Audit] Audit completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Tag Audit] Fatal error:', error);
      process.exit(1);
    });
}

export { runAudit };

