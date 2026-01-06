/**
 * Script to sync article tags to Tags collection
 * 
 * Reads distinct tag values from all articles (article.tags[])
 * and ensures they all exist in the Tags collection as ACTIVE tags.
 * 
 * Run: tsx server/src/scripts/syncArticleTagsToTagsCollection.ts
 */

import { connectDB } from '../utils/db.js';
import { Tag } from '../models/Tag.js';
import { Article } from '../models/Article.js';

async function syncArticleTagsToTagsCollection(): Promise<void> {
  console.log('[SyncArticleTags] Starting tag sync...\n');

  try {
    // Connect to database
    await connectDB();
    console.log('[SyncArticleTags] Connected to database\n');

    // Get all articles and extract distinct tag values
    console.log('[SyncArticleTags] Reading tags from articles...\n');
    const articles = await Article.find({ 
      tags: { $exists: true, $ne: [] } 
    }).select('tags').lean();
    
    // Extract all unique tag values (case-insensitive)
    const articleTagSet = new Set<string>();
    for (const article of articles) {
      if (article.tags && Array.isArray(article.tags)) {
        for (const tag of article.tags) {
          if (tag && typeof tag === 'string' && tag.trim()) {
            articleTagSet.add(tag.trim());
          }
        }
      }
    }
    
    const articleTags = Array.from(articleTagSet);
    console.log(`[SyncArticleTags] Found ${articleTags.length} distinct tags in articles\n`);

    if (articleTags.length === 0) {
      console.log('[SyncArticleTags] No tags found in articles. Exiting.\n');
      process.exit(0);
    }

    // Get all existing tags from Tags collection
    const existingTags = await Tag.find({}).lean();
    const existingCanonicalNames = new Set(
      existingTags.map(t => t.canonicalName || t.rawName?.toLowerCase() || '')
    );
    
    console.log(`[SyncArticleTags] Found ${existingTags.length} existing tags in Tags collection\n`);

    // Find missing tags
    const missingTags: string[] = [];
    for (const articleTag of articleTags) {
      const canonicalName = articleTag.toLowerCase();
      if (!existingCanonicalNames.has(canonicalName)) {
        missingTags.push(articleTag);
      }
    }

    console.log(`[SyncArticleTags] Found ${missingTags.length} missing tags\n`);

    if (missingTags.length === 0) {
      console.log('[SyncArticleTags] All article tags already exist in Tags collection. No action needed.\n');
      process.exit(0);
    }

    // Insert missing tags as ACTIVE
    let inserted = 0;
    let errors = 0;

    for (const tagName of missingTags) {
      try {
        const trimmedName = tagName.trim();
        const canonicalName = trimmedName.toLowerCase();

        // Double-check it doesn't exist (race condition protection)
        const existing = await Tag.findOne({ canonicalName });
        if (existing) {
          console.log(`[SyncArticleTags] Tag "${tagName}" already exists (race condition), skipping\n`);
          continue;
        }

        // Create new tag as ACTIVE
        const newTag = new Tag({
          rawName: trimmedName,
          canonicalName: canonicalName,
          type: 'tag', // All tags are treated as 'tag' type
          status: 'active',
          isOfficial: false,
          usageCount: 0 // Will be calculated by usage count script if needed
        });

        await newTag.save();
        inserted++;
        
        console.log(`[SyncArticleTags] Created tag: "${tagName}"\n`);
      } catch (error: any) {
        errors++;
        // Handle duplicate key error (race condition)
        if (error.code === 11000) {
          console.log(`[SyncArticleTags] Tag "${tagName}" already exists (duplicate key), skipping\n`);
        } else {
          console.error(`[SyncArticleTags] Error creating tag "${tagName}":`, error.message);
        }
      }
    }

    // Print summary
    console.log('\n[SyncArticleTags] Sync complete!\n');
    console.log('Summary:');
    console.log(`  Total tags in articles: ${articleTags.length}`);
    console.log(`  Existing tags in collection: ${existingTags.length}`);
    console.log(`  Missing tags found: ${missingTags.length}`);
    console.log(`  Tags inserted: ${inserted}`);
    console.log(`  Errors: ${errors}`);
    console.log('\n[SyncArticleTags] Done!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('[SyncArticleTags] Fatal error:', error);
    process.exit(1);
  }
}

// Run sync
syncArticleTagsToTagsCollection();


