/**
 * Validation script: Check data consistency between tags[] and tagIds[]
 * 
 * This script verifies:
 * 1. Articles with tagIds have matching tags[]
 * 2. No orphaned tagIds (pointing to non-existent tags)
 * 3. Articles with tags[] have matching tagIds (if tagIds enabled)
 * 4. Tag name consistency
 * 
 * Run: npx tsx server/src/scripts/validateTagMigration.ts
 */

import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';
import { resolveTagIdsToNames } from '../utils/tagHelpers.js';
import mongoose from 'mongoose';

interface ValidationIssue {
  type: 'mismatch' | 'orphaned' | 'missing_tagIds' | 'missing_tags';
  articleId: string;
  message: string;
  details?: any;
}

async function validateMigration(): Promise<ValidationIssue[]> {
  console.log('[ValidateTagMigration] Starting validation...\n');

  try {
    await connectDB();
    console.log('[ValidateTagMigration] Connected to database\n');

    const issues: ValidationIssue[] = [];

    // Get all articles with either tags or tagIds
    const articles = await Article.find({
      $or: [
        { tags: { $exists: true, $ne: [] } },
        { tagIds: { $exists: true, $ne: [] } }
      ]
    }).lean();

    console.log(`[ValidateTagMigration] Checking ${articles.length} articles...\n`);

    // Get all existing tags for orphaned check
    const allTagIds = await Article.distinct('tagIds');
    const existingTags = await Tag.find({ _id: { $in: allTagIds } });
    const existingTagIdSet = new Set(
      existingTags.map(t => t._id.toString())
    );

    // Check for orphaned tagIds
    const orphanedTagIds = allTagIds.filter(
      id => id && !existingTagIdSet.has(id.toString())
    );

    if (orphanedTagIds.length > 0) {
      issues.push({
        type: 'orphaned',
        articleId: 'N/A',
        message: `${orphanedTagIds.length} orphaned tagIds found`,
        details: { orphanedTagIds: orphanedTagIds.slice(0, 10) } // Show first 10
      });
    }

    // Check each article for consistency
    let checked = 0;
    for (const article of articles) {
      checked++;
      
      if (checked % 100 === 0) {
        console.log(`[ValidateTagMigration] Progress: ${checked}/${articles.length} articles checked...`);
      }

      const articleTagIds = (article.tagIds || []) as mongoose.Types.ObjectId[];
      const articleTags = article.tags || [];

      // Case 1: Article has tagIds but no tags[]
      if (articleTagIds.length > 0 && articleTags.length === 0) {
        issues.push({
          type: 'missing_tags',
          articleId: article._id.toString(),
          message: 'Article has tagIds but no tags[]',
          details: { tagIds: articleTagIds.map(id => id.toString()) }
        });
        continue;
      }

      // Case 2: Article has tags[] but no tagIds (expected during Phase 1)
      if (articleTags.length > 0 && articleTagIds.length === 0) {
        // This is expected during Phase 1, but log for tracking
        // Don't add as issue - it's expected during migration
        continue;
      }

      // Case 3: Article has both - verify they match
      if (articleTagIds.length > 0 && articleTags.length > 0) {
        try {
          const resolvedTags = await resolveTagIdsToNames(articleTagIds);
          const resolvedSorted = resolvedTags.sort();
          const storedSorted = [...articleTags].sort();

          if (JSON.stringify(resolvedSorted) !== JSON.stringify(storedSorted)) {
            issues.push({
              type: 'mismatch',
              articleId: article._id.toString(),
              message: 'tags[] and tagIds[] do not match',
              details: {
                stored: storedSorted,
                resolved: resolvedSorted,
                tagIds: articleTagIds.map(id => id.toString())
              }
            });
          }
        } catch (error: any) {
          issues.push({
            type: 'mismatch',
            articleId: article._id.toString(),
            message: `Error resolving tagIds: ${error.message}`,
            details: { tagIds: articleTagIds.map(id => id.toString()) }
          });
        }
      }
    }

    // Print summary
    console.log('\n[ValidateTagMigration] Validation complete!\n');
    console.log('Summary:');
    console.log(`  Articles checked: ${checked}`);
    console.log(`  Issues found: ${issues.length}`);
    
    const issueTypes = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('  Issue breakdown:');
    Object.entries(issueTypes).forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`);
    });

    if (issues.length > 0) {
      console.log('\n[ValidateTagMigration] Sample issues (first 10):');
      issues.slice(0, 10).forEach((issue, index) => {
        console.log(`\n  ${index + 1}. ${issue.type.toUpperCase()}`);
        console.log(`     Article ID: ${issue.articleId}`);
        console.log(`     Message: ${issue.message}`);
        if (issue.details) {
          console.log(`     Details: ${JSON.stringify(issue.details, null, 2)}`);
        }
      });
    }

    console.log('\n[ValidateTagMigration] Done!\n');
    
    return issues;
  } catch (error: any) {
    console.error('[ValidateTagMigration] Fatal error:', error);
    throw error;
  }
}

// Run validation
validateMigration()
  .then(issues => {
    process.exit(issues.length > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });

