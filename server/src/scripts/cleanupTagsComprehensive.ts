/**
 * Comprehensive Tag Cleanup Script
 * 
 * This script performs a complete cleanup of the tag system:
 * 1. Normalizes tag names in articles
 * 2. Merges duplicate tags (Tech vs tech)
 * 3. Propagates tag renames into articles
 * 4. Removes deleted/deprecated tags from articles
 * 5. Recomputes usage counts
 * 6. Ensures tags[] and tagIds[] are synchronized
 * 
 * Run: npx tsx server/src/scripts/cleanupTagsComprehensive.ts
 */

// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../../..');

// Load .env file from project root
dotenv.config({ path: path.join(rootPath, '.env') });

// Validate environment variables
import { validateEnv } from '../config/envValidation.js';
validateEnv();

// Initialize logger before connecting to DB
import { initLogger } from '../utils/logger.js';
initLogger();

import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { Tag, canonicalize } from '../models/Tag.js';
import { resolveTagIdsToNames, resolveTagNamesToIds } from '../utils/tagHelpers.js';
import mongoose from 'mongoose';

const BATCH_SIZE = 100;

interface CleanupStats {
  tagsNormalized: number;
  duplicatesMerged: number;
  articlesUpdated: number;
  orphanedTagsRemoved: number;
  usageCountsUpdated: number;
  errors: number;
}

async function cleanupTagsComprehensive(): Promise<CleanupStats> {
  console.log('[TagCleanup] Starting comprehensive tag cleanup...\n');

  const stats: CleanupStats = {
    tagsNormalized: 0,
    duplicatesMerged: 0,
    articlesUpdated: 0,
    orphanedTagsRemoved: 0,
    usageCountsUpdated: 0,
    errors: 0,
  };

  try {
    await connectDB();
    console.log('[TagCleanup] Connected to database\n');

    // STEP 1: Find and merge duplicate tags
    console.log('[TagCleanup] Step 1: Finding duplicate tags...\n');
    const allTags = await Tag.find({}).lean();
    
    // Group tags by canonicalName
    const tagsByCanonical = new Map<string, any[]>();
    allTags.forEach(tag => {
      const canonical = tag.canonicalName || canonicalize(tag.rawName || tag.name || '');
      if (!tagsByCanonical.has(canonical)) {
        tagsByCanonical.set(canonical, []);
      }
      tagsByCanonical.get(canonical)!.push(tag);
    });

    // Find duplicates (more than one tag with same canonicalName)
    const duplicates: Array<{ canonical: string; tags: any[] }> = [];
    tagsByCanonical.forEach((tags, canonical) => {
      if (tags.length > 1) {
        duplicates.push({ canonical, tags });
      }
    });

    console.log(`[TagCleanup] Found ${duplicates.length} sets of duplicate tags\n`);

    // Merge duplicates: keep the first active tag, or first tag if none are active
    const tagMergeMap = new Map<string, mongoose.Types.ObjectId>(); // oldId -> newId
    
    for (const { canonical, tags } of duplicates) {
      // Sort: active tags first, then by creation date
      tags.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return 0;
      });

      const canonicalTag = tags[0]; // Keep this one
      const duplicatesToMerge = tags.slice(1); // Merge these into canonicalTag

      console.log(`[TagCleanup] Merging duplicates for "${canonical}":`);
      console.log(`  Keeping: ${canonicalTag._id} (${canonicalTag.rawName})`);
      
      // Update all articles using duplicate tags to use canonical tag
      for (const duplicateTag of duplicatesToMerge) {
        console.log(`  Merging: ${duplicateTag._id} (${duplicateTag.rawName})`);
        
        // Map old tagId to canonical tagId
        tagMergeMap.set(duplicateTag._id.toString(), canonicalTag._id);
        
        // Update articles: replace duplicate tagId with canonical tagId
        // First, find articles with the duplicate tagId
        const articlesWithDuplicate = await Article.find({
          tagIds: { $in: [duplicateTag._id] }
        }).lean();

        for (const article of articlesWithDuplicate) {
          const tagIds = (article.tagIds || []) as mongoose.Types.ObjectId[];
          // Remove duplicate, add canonical (avoid duplicates)
          const updatedTagIds = tagIds
            .filter(id => id.toString() !== duplicateTag._id.toString())
            .concat(canonicalTag._id);
          
          // Remove duplicates from updatedTagIds
          const uniqueTagIds = Array.from(new Set(updatedTagIds.map(id => id.toString())))
            .map(id => new mongoose.Types.ObjectId(id));
          
          await Article.updateOne(
            { _id: article._id },
            { $set: { tagIds: uniqueTagIds } }
          );
          
          stats.articlesUpdated++;
        }
        
        // Delete the duplicate tag
        await Tag.deleteOne({ _id: duplicateTag._id });
        stats.duplicatesMerged++;
      }
    }

    console.log(`[TagCleanup] Merged ${stats.duplicatesMerged} duplicate tags\n`);

    // STEP 2: Remove orphaned tags from articles (tags that don't exist in Tag collection)
    console.log('[TagCleanup] Step 2: Removing orphaned tags from articles...\n');
    
    const allTagIds = await Article.distinct('tagIds');
    const existingTags = await Tag.find({ _id: { $in: allTagIds.filter(Boolean) } });
    const existingTagIdSet = new Set(
      existingTags.map(t => t._id.toString())
    );

    // Find articles with orphaned tagIds
    const articlesWithOrphans = await Article.find({
      tagIds: { $exists: true, $ne: [] }
    }).lean();

    let orphanedRemoved = 0;
    const orphanUpdates: any[] = [];
    
    for (const article of articlesWithOrphans) {
      const tagIds = (article.tagIds || []) as mongoose.Types.ObjectId[];
      const validTagIds = tagIds.filter(id => existingTagIdSet.has(id.toString()));
      
      if (validTagIds.length !== tagIds.length) {
        // Remove orphaned tagIds
        orphanUpdates.push({
          updateOne: {
            filter: { _id: article._id },
            update: {
              $set: { tagIds: validTagIds }
            }
          }
        });
        orphanedRemoved += tagIds.length - validTagIds.length;
      }
    }

    // Execute orphan removal in batches
    if (orphanUpdates.length > 0) {
      for (let i = 0; i < orphanUpdates.length; i += BATCH_SIZE) {
        const batch = orphanUpdates.slice(i, i + BATCH_SIZE);
        try {
          await Article.bulkWrite(batch, { ordered: false });
          stats.articlesUpdated += batch.length;
        } catch (error: any) {
          stats.errors++;
          console.error(`[TagCleanup] Error removing orphans:`, error.message);
        }
      }
    }

    stats.orphanedTagsRemoved = orphanedRemoved;
    console.log(`[TagCleanup] Removed ${orphanedRemoved} orphaned tagIds from articles\n`);

    // STEP 3: Normalize and synchronize tags[] with tagIds[]
    console.log('[TagCleanup] Step 3: Normalizing tags[] and synchronizing with tagIds[]...\n');
    
    const allArticles = await Article.find({
      $or: [
        { tags: { $exists: true, $ne: [] } },
        { tagIds: { $exists: true, $ne: [] } }
      ]
    }).lean();

    let normalized = 0;
    const updates: any[] = [];

    for (const article of allArticles) {
      const articleTagIds = (article.tagIds || []) as mongoose.Types.ObjectId[];
      const articleTags = article.tags || [];

      // If article has tagIds, use them as source of truth
      if (articleTagIds.length > 0) {
        try {
          // Resolve tagIds to names
          const resolvedNames = await resolveTagIdsToNames(articleTagIds);
          
          // Normalize: remove duplicates, trim, sort
          const normalizedTags = Array.from(new Set(
            resolvedNames
              .filter(t => t && t.trim())
              .map(t => t.trim())
          )).sort();

          // Check if tags[] needs updating
          const currentTagsSorted = [...articleTags].sort();
          if (JSON.stringify(normalizedTags) !== JSON.stringify(currentTagsSorted)) {
            updates.push({
              updateOne: {
                filter: { _id: article._id },
                update: {
                  $set: {
                    tags: normalizedTags,
                    tagIds: articleTagIds // Ensure tagIds are also set
                  }
                }
              }
            });
            normalized++;
          }
        } catch (error: any) {
          stats.errors++;
          console.error(`[TagCleanup] Error resolving tags for article ${article._id}:`, error.message);
        }
      } else if (articleTags.length > 0) {
        // Article has tags[] but no tagIds[] - resolve tags to tagIds
        try {
          const tagIds = await resolveTagNamesToIds(articleTags);
          
          // Normalize tags
          const normalizedTags = Array.from(new Set(
            articleTags
              .filter(t => t && typeof t === 'string' && t.trim())
              .map(t => t.trim())
          )).sort();

          if (tagIds.length > 0) {
            updates.push({
              updateOne: {
                filter: { _id: article._id },
                update: {
                  $set: {
                    tags: normalizedTags,
                    tagIds: tagIds
                  }
                }
              }
            });
            normalized++;
          }
        } catch (error: any) {
          stats.errors++;
          console.error(`[TagCleanup] Error resolving tagIds for article ${article._id}:`, error.message);
        }
      }

      // Batch execute updates
      if (updates.length >= BATCH_SIZE) {
        try {
          await Article.bulkWrite(updates, { ordered: false });
          stats.articlesUpdated += updates.length;
          updates.length = 0;
        } catch (error: any) {
          stats.errors++;
          console.error(`[TagCleanup] Batch update error:`, error.message);
        }
      }
    }

    // Execute remaining updates
    if (updates.length > 0) {
      try {
        await Article.bulkWrite(updates, { ordered: false });
        stats.articlesUpdated += updates.length;
      } catch (error: any) {
        stats.errors++;
        console.error(`[TagCleanup] Final batch update error:`, error.message);
      }
    }

    stats.tagsNormalized = normalized;
    console.log(`[TagCleanup] Normalized ${normalized} articles\n`);

    // STEP 4: Recompute usage counts for all tags
    console.log('[TagCleanup] Step 4: Recomputing usage counts...\n');
    
    const allActiveTags = await Tag.find({ status: 'active' }).lean();
    
    for (const tag of allActiveTags) {
      // Count articles that have this tagId
      const count = await Article.countDocuments({
        tagIds: tag._id
      });
      
      // Update usage count
      await Tag.updateOne(
        { _id: tag._id },
        { $set: { usageCount: count } }
      );
      
      stats.usageCountsUpdated++;
    }

    console.log(`[TagCleanup] Updated usage counts for ${stats.usageCountsUpdated} tags\n`);

    // Print summary
    console.log('\n[TagCleanup] Cleanup complete!\n');
    console.log('Summary:');
    console.log(`  Duplicates merged: ${stats.duplicatesMerged}`);
    console.log(`  Orphaned tags removed: ${stats.orphanedTagsRemoved}`);
    console.log(`  Articles normalized: ${stats.tagsNormalized}`);
    console.log(`  Articles updated: ${stats.articlesUpdated}`);
    console.log(`  Usage counts updated: ${stats.usageCountsUpdated}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log('\n[TagCleanup] Done!\n');

    return stats;
  } catch (error: any) {
    console.error('[TagCleanup] Fatal error:', error);
    throw error;
  }
}

// Run cleanup
cleanupTagsComprehensive()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });

