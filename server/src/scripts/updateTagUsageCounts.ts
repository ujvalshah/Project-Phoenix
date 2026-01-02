/**
 * Script to update stored usageCount values in Tag documents
 * 
 * This script calculates actual usage from articles and updates the usageCount field
 * in Tag documents. This is optional - the API now calculates usage on-the-fly,
 * but storing it can improve performance for large datasets.
 * 
 * Run: tsx server/src/scripts/updateTagUsageCounts.ts
 */

import { connectDB } from '../utils/db.js';
import { Tag } from '../models/Tag.js';
import { calculateTagUsageCounts } from '../utils/tagUsageHelpers.js';

async function updateTagUsageCounts(): Promise<void> {
  console.log('[UpdateTagUsageCounts] Starting usage count update...\n');

  try {
    // Connect to database
    await connectDB();
    console.log('[UpdateTagUsageCounts] Connected to database\n');

    // Get all tags
    const tags = await Tag.find({}).lean();
    console.log(`[UpdateTagUsageCounts] Found ${tags.length} tags\n`);

    if (tags.length === 0) {
      console.log('[UpdateTagUsageCounts] No tags to update. Exiting.\n');
      process.exit(0);
    }

    // Calculate actual usage counts
    console.log('[UpdateTagUsageCounts] Calculating usage counts from articles...\n');
    const usageCounts = await calculateTagUsageCounts(tags);

    // Update each tag
    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (const tag of tags) {
      try {
        const tagId = tag._id.toString();
        const actualCount = usageCounts.get(tagId) || 0;
        const storedCount = tag.usageCount || 0;

        if (actualCount !== storedCount) {
          await Tag.findByIdAndUpdate(tag._id, {
            $set: { usageCount: actualCount }
          });
          updated++;
          
          if (updated % 10 === 0) {
            console.log(`[UpdateTagUsageCounts] Progress: ${updated}/${tags.length} tags updated...`);
          }
        } else {
          unchanged++;
        }
      } catch (error: any) {
        errors++;
        console.error(`[UpdateTagUsageCounts] Error updating tag ${tag._id}:`, error.message);
      }
    }

    // Print summary
    console.log('\n[UpdateTagUsageCounts] Update complete!\n');
    console.log('Summary:');
    console.log(`  Tags updated: ${updated}`);
    console.log(`  Tags unchanged: ${unchanged}`);
    console.log(`  Errors: ${errors}`);
    console.log('\n[UpdateTagUsageCounts] Done!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('[UpdateTagUsageCounts] Fatal error:', error);
    process.exit(1);
  }
}

// Run update
updateTagUsageCounts();



