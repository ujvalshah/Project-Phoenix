/**
 * Backfill script: Populate tagIds from existing tags[] in articles
 * 
 * This script:
 * 1. Reads all articles with tags[]
 * 2. Resolves each tag name to a Tag document (creates if missing)
 * 3. Populates tagIds[] field
 * 4. Uses batch processing for performance
 * 
 * Run: npx tsx server/src/scripts/backfillArticleTagIds.ts
 */

import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { Tag, canonicalize } from '../models/Tag.js';
import mongoose from 'mongoose';

const BATCH_SIZE = 100;

async function backfillArticleTagIds(): Promise<void> {
  console.log('[BackfillTagIds] Starting tagIds backfill...\n');

  try {
    // Connect to database
    await connectDB();
    console.log('[BackfillTagIds] Connected to database\n');

    // Get all articles with tags
    const totalArticles = await Article.countDocuments({ 
      tags: { $exists: true, $ne: [] } 
    });
    
    console.log(`[BackfillTagIds] Found ${totalArticles} articles with tags\n`);

    if (totalArticles === 0) {
      console.log('[BackfillTagIds] No articles to process. Exiting.\n');
      process.exit(0);
    }

    // Step 1: Collect all unique tag names
    console.log('[BackfillTagIds] Collecting unique tag names...\n');
    const articles = await Article.find({ 
      tags: { $exists: true, $ne: [] } 
    }).select('tags').lean();
    
    const allTagNames = new Set<string>();
    articles.forEach(article => {
      if (article.tags && Array.isArray(article.tags)) {
        article.tags.forEach(tag => {
          if (tag && typeof tag === 'string' && tag.trim()) {
            allTagNames.add(tag.trim());
          }
        });
      }
    });

    console.log(`[BackfillTagIds] Found ${allTagNames.size} unique tag names\n`);

    // Step 2: Pre-create all tags (find or create)
    console.log('[BackfillTagIds] Resolving tags to Tag documents...\n');
    const tagMap = new Map<string, mongoose.Types.ObjectId>();
    let tagsCreated = 0;
    let tagsFound = 0;

    for (const tagName of allTagNames) {
      const canonical = canonicalize(tagName);
      let tag = await Tag.findOne({ canonicalName: canonical });
      
      if (!tag) {
        tag = await Tag.create({
          rawName: tagName,
          canonicalName: canonical,
          status: 'active',
          type: 'tag'
        });
        tagsCreated++;
      } else {
        tagsFound++;
      }
      
      tagMap.set(canonical, tag._id);
    }

    console.log(`[BackfillTagIds] Tags resolved: ${tagsFound} found, ${tagsCreated} created\n`);

    // Step 3: Batch update articles
    console.log('[BackfillTagIds] Updating articles with tagIds...\n');
    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      const updates = [];

      for (const article of batch) {
        try {
          const tagIds: mongoose.Types.ObjectId[] = [];
          const seenCanonical = new Set<string>();

          if (article.tags && Array.isArray(article.tags)) {
            for (const tagName of article.tags) {
              if (!tagName || typeof tagName !== 'string' || !tagName.trim()) {
                continue;
              }

              const canonical = canonicalize(tagName);
              
              // Skip duplicates
              if (seenCanonical.has(canonical)) {
                continue;
              }
              seenCanonical.add(canonical);

              const tagId = tagMap.get(canonical);
              if (tagId) {
                tagIds.push(tagId);
              }
            }
          }

          // Only update if we have tagIds to set
          if (tagIds.length > 0) {
            updates.push({
              updateOne: {
                filter: { _id: article._id },
                update: {
                  $set: {
                    tagIds: Array.from(new Set(tagIds)) // Remove duplicates
                  }
                }
              }
            });
          }
        } catch (error: any) {
          errors++;
          console.error(`[BackfillTagIds] Error processing article ${article._id}:`, error.message);
        }
      }

      // Execute batch update
      if (updates.length > 0) {
        try {
          await Article.bulkWrite(updates, { ordered: false });
          updated += updates.length;
        } catch (error: any) {
          errors++;
          console.error(`[BackfillTagIds] Batch update error:`, error.message);
        }
      }

      processed += batch.length;
      
      if (processed % 500 === 0 || processed === articles.length) {
        console.log(`[BackfillTagIds] Progress: ${processed}/${articles.length} articles processed (${updated} updated, ${errors} errors)\n`);
      }
    }

    // Print summary
    console.log('\n[BackfillTagIds] Backfill complete!\n');
    console.log('Summary:');
    console.log(`  Total articles: ${totalArticles}`);
    console.log(`  Articles processed: ${processed}`);
    console.log(`  Articles updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Unique tags: ${allTagNames.size}`);
    console.log(`  Tags created: ${tagsCreated}`);
    console.log(`  Tags found: ${tagsFound}`);
    console.log('\n[BackfillTagIds] Done!\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('[BackfillTagIds] Fatal error:', error);
    process.exit(1);
  }
}

// Run backfill
backfillArticleTagIds();

