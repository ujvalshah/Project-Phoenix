/**
 * Phase 2 Migration: Backfill categoryIds for existing articles
 * 
 * This script:
 * 1. Finds all articles without categoryIds
 * 2. Resolves Tag ObjectIds from their categories array
 * 3. Updates articles with categoryIds for stable tag references
 * 
 * Run: tsx server/src/scripts/backfillCategoryIds.ts
 */

import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';

async function backfillCategoryIds(): Promise<void> {
  console.log('[Migration] Starting categoryIds backfill...\n');

  try {
    // Connect to database
    await connectDB();
    console.log('[Migration] Connected to database\n');

    // Find articles without categoryIds (or with empty categoryIds)
    const articlesWithoutIds = await Article.find({
      $or: [
        { categoryIds: { $exists: false } },
        { categoryIds: { $size: 0 } },
        { categoryIds: null }
      ],
      categories: { $exists: true, $ne: [] }
    }).lean();

    console.log(`[Migration] Found ${articlesWithoutIds.length} articles needing categoryIds\n`);

    if (articlesWithoutIds.length === 0) {
      console.log('[Migration] No articles to migrate. Exiting.\n');
      process.exit(0);
    }

    // Build a map of canonical names to Tag IDs
    const allTags = await Tag.find({}).lean();
    const tagMap = new Map(allTags.map(tag => [tag.canonicalName, tag._id.toString()]));
    console.log(`[Migration] Loaded ${allTags.length} tags into memory\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const missingTags = new Set<string>();

    // Process each article
    for (const article of articlesWithoutIds) {
      try {
        if (!article.categories || article.categories.length === 0) {
          skipCount++;
          continue;
        }

        // Resolve category IDs
        const categoryIds: string[] = [];
        for (const categoryName of article.categories) {
          const canonical = categoryName.trim().toLowerCase();
          const tagId = tagMap.get(canonical);
          
          if (tagId) {
            categoryIds.push(tagId);
          } else {
            missingTags.add(categoryName);
            console.warn(`[Migration] Tag not found for category: "${categoryName}" (canonical: "${canonical}")`);
          }
        }

        if (categoryIds.length > 0) {
          // Update article with categoryIds
          await Article.updateOne(
            { _id: article._id },
            { $set: { categoryIds } }
          );
          successCount++;
          
          if (successCount % 100 === 0) {
            console.log(`[Migration] Progress: ${successCount}/${articlesWithoutIds.length} articles updated...`);
          }
        } else {
          skipCount++;
          console.warn(`[Migration] Skipped article ${article._id} - no valid tag IDs found`);
        }
      } catch (error: any) {
        errorCount++;
        console.error(`[Migration] Error updating article ${article._id}:`, error.message);
      }
    }

    // Print summary
    console.log('\n[Migration] Backfill complete!\n');
    console.log('Summary:');
    console.log(`  Articles updated: ${successCount}`);
    console.log(`  Articles skipped: ${skipCount}`);
    console.log(`  Errors: ${errorCount}`);
    
    if (missingTags.size > 0) {
      console.log(`\n  Missing tags (${missingTags.size}):`);
      Array.from(missingTags).slice(0, 20).forEach(tag => {
        console.log(`    - "${tag}"`);
      });
      if (missingTags.size > 20) {
        console.log(`    ... and ${missingTags.size - 20} more`);
      }
      console.log('\n  ⚠️  These tags exist in articles but not in Tags collection.');
      console.log('  You may need to create these tags manually or run data cleanup.');
    }

    console.log('\n[Migration] Done!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('[Migration] Fatal error:', error);
    process.exit(1);
  }
}

// Run migration
backfillCategoryIds();



