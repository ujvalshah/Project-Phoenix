#!/usr/bin/env node
/**
 * Migration Script: Remove "uncategorized" Tag from Articles
 * 
 * This script:
 * - Finds all articles where tags includes "uncategorized"
 * - Removes "uncategorized" from the tags array
 * - Leaves tags as empty array [] if it becomes empty (no fallback tag)
 * - Logs each update with article _id, previous tags, and new tags
 * - Reports total affected documents and count of docs with empty tags
 * 
 * The script is idempotent (safe to rerun).
 * 
 * Usage:
 *   npm run remove:uncategorized
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnv } from '../src/config/envValidation.js';
import { initLogger } from '../src/utils/logger.js';
import { connectDB } from '../src/utils/db.js';
import { Article } from '../src/models/Article.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../..');

// Load environment variables
dotenv.config({ path: path.join(rootPath, '.env') });

// Validate environment and initialize logger (required for connectDB)
validateEnv();
initLogger();

interface UpdateStats {
  totalAffected: number;
  emptyTagsCount: number;
}

async function main() {
  console.log('='.repeat(80));
  console.log('REMOVE "uncategorized" TAG MIGRATION');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Connect to database
    console.log('[1/3] Connecting to database...');
    await connectDB();
    console.log('✓ Database connected\n');

    // Find all articles with "uncategorized" in tags
    console.log('[2/3] Finding articles with "uncategorized" tag...');
    const articles = await Article.find({ tags: 'uncategorized' }).lean();
    console.log(`✓ Found ${articles.length} article(s) with "uncategorized" tag\n`);

    if (articles.length === 0) {
      console.log('No articles to update. Migration complete.');
      console.log('');
      return;
    }

    // Process each article
    console.log('[3/3] Processing articles...');
    console.log('-'.repeat(80));

    const stats: UpdateStats = {
      totalAffected: 0,
      emptyTagsCount: 0
    };

    for (const article of articles) {
      const articleId = article._id.toString();
      const previousTags = [...(article.tags || [])];
      
      // Remove "uncategorized" from tags array (case-sensitive)
      const newTags = previousTags.filter(tag => tag !== 'uncategorized');
      
      // Check if tags will be empty after removal
      const willBeEmpty = newTags.length === 0;
      
      // Update the document
      await Article.updateOne(
        { _id: article._id },
        { $set: { tags: newTags } }
      );

      // Log the update
      console.log(`Article ID: ${articleId}`);
      console.log(`  Previous tags: [${previousTags.join(', ')}]`);
      console.log(`  New tags: [${newTags.join(', ')}]`);
      if (willBeEmpty) {
        console.log(`  ⚠️  Tags became empty`);
      }
      console.log('');

      // Update statistics
      stats.totalAffected++;
      if (willBeEmpty) {
        stats.emptyTagsCount++;
      }
    }

    // Print summary
    console.log('='.repeat(80));
    console.log('MIGRATION SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total affected documents: ${stats.totalAffected}`);
    console.log(`Documents with empty tags after removal: ${stats.emptyTagsCount}`);
    console.log('');
    console.log('✓ Migration complete');
    console.log('');

  } catch (error: any) {
    console.error('');
    console.error('='.repeat(80));
    console.error('ERROR: Migration failed');
    console.error('='.repeat(80));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    const mongoose = await import('mongoose');
    await mongoose.default.connection.close();
    console.log('✓ Database connection closed');
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

