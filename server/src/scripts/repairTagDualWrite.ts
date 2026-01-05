/**
 * Repair script: Fix articles with tagIds but missing/inconsistent tags[]
 * 
 * This script:
 * 1. Finds articles with tagIds but missing or inconsistent tags[]
 * 2. Resolves tagIds to tag names
 * 3. Updates tags[] to match resolved names
 * 
 * Run: npx tsx server/src/scripts/repairTagDualWrite.ts
 */

import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { resolveTagIdsToNames } from '../utils/tagHelpers.js';
import mongoose from 'mongoose';

const BATCH_SIZE = 100;

async function repairDualWrite(): Promise<void> {
  console.log('[RepairTagDualWrite] Starting repair...\n');

  try {
    await connectDB();
    console.log('[RepairTagDualWrite] Connected to database\n');

    // Find articles with tagIds
    const articles = await Article.find({ 
      tagIds: { $exists: true, $ne: [] }
    }).lean();

    console.log(`[RepairTagDualWrite] Found ${articles.length} articles with tagIds\n`);

    if (articles.length === 0) {
      console.log('[RepairTagDualWrite] No articles to repair. Exiting.\n');
      process.exit(0);
    }

    let repaired = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      const updates = [];

      for (const article of batch) {
        try {
          const tagIds = (article.tagIds || []) as mongoose.Types.ObjectId[];
          
          if (tagIds.length === 0) {
            skipped++;
            continue;
          }

          // Resolve tagIds to names
          const resolvedNames = await resolveTagIdsToNames(tagIds);
          const resolvedSorted = resolvedNames.sort();
          const storedSorted = (article.tags || []).sort();

          // Check if repair is needed
          if (JSON.stringify(resolvedSorted) !== JSON.stringify(storedSorted)) {
            updates.push({
              updateOne: {
                filter: { _id: article._id },
                update: {
                  $set: {
                    tags: resolvedNames
                  }
                }
              }
            });
          } else {
            skipped++;
          }
        } catch (error: any) {
          errors++;
          console.error(`[RepairTagDualWrite] Error processing article ${article._id}:`, error.message);
        }
      }

      // Execute batch update
      if (updates.length > 0) {
        try {
          await Article.bulkWrite(updates, { ordered: false });
          repaired += updates.length;
        } catch (error: any) {
          errors++;
          console.error(`[RepairTagDualWrite] Batch update error:`, error.message);
        }
      }

      if ((i + batch.length) % 500 === 0 || (i + batch.length) === articles.length) {
        console.log(`[RepairTagDualWrite] Progress: ${i + batch.length}/${articles.length} articles processed (${repaired} repaired, ${skipped} skipped, ${errors} errors)\n`);
      }
    }

    // Print summary
    console.log('\n[RepairTagDualWrite] Repair complete!\n');
    console.log('Summary:');
    console.log(`  Articles checked: ${articles.length}`);
    console.log(`  Articles repaired: ${repaired}`);
    console.log(`  Articles skipped (already consistent): ${skipped}`);
    console.log(`  Errors: ${errors}`);
    console.log('\n[RepairTagDualWrite] Done!\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('[RepairTagDualWrite] Fatal error:', error);
    process.exit(1);
  }
}

// Run repair
repairDualWrite();

