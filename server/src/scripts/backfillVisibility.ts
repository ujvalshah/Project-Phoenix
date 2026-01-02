/**
 * Privacy System Migration: Backfill visibility field for existing articles
 * 
 * This script:
 * 1. Finds all articles without explicit visibility field
 * 2. Sets visibility to 'public' (default behavior)
 * 3. Ensures all articles have explicit visibility for privacy enforcement
 * 
 * Run: tsx server/src/scripts/backfillVisibility.ts
 */

// IMPORTANT: Load environment variables FIRST
import '../loadEnv.js';

// Validate environment and initialize logger
import { validateEnv } from '../config/envValidation.js';
import { initLogger } from '../utils/logger.js';
import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import mongoose from 'mongoose';

async function backfillVisibility(): Promise<void> {
  console.log('[Migration] Starting visibility field backfill...\n');

  try {
    // Validate environment first
    validateEnv();
    
    // Initialize logger (required by connectDB)
    initLogger();
    
    // Connect to database
    await connectDB();
    console.log('[Migration] Connected to database\n');

    // Find all articles without explicit visibility field
    const articlesWithoutVisibility = await Article.find({
      $or: [
        { visibility: { $exists: false } },
        { visibility: null }
      ]
    }).lean();

    console.log(`[Migration] Found ${articlesWithoutVisibility.length} articles without visibility field\n`);

    if (articlesWithoutVisibility.length === 0) {
      console.log('[Migration] ✅ All articles already have visibility field set\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Set default to 'public' for all articles without visibility
    const result = await Article.updateMany(
      {
        $or: [
          { visibility: { $exists: false } },
          { visibility: null }
        ]
      },
      {
        $set: { visibility: 'public' }
      }
    );

    console.log(`[Migration] Updated ${result.modifiedCount} articles with visibility: 'public'\n`);

    // Verify no articles are missing visibility field
    const remaining = await Article.countDocuments({
      $or: [
        { visibility: { $exists: false } },
        { visibility: null }
      ]
    });

    if (remaining > 0) {
      console.warn(`[Migration] ⚠️  Warning: ${remaining} articles still missing visibility field\n`);
    } else {
      console.log('[Migration] ✅ All articles now have visibility field set\n');
    }

    // Also check for any articles with invalid visibility values
    const invalidVisibility = await Article.countDocuments({
      visibility: { $nin: ['public', 'private'] }
    });

    if (invalidVisibility > 0) {
      console.warn(`[Migration] ⚠️  Warning: ${invalidVisibility} articles have invalid visibility values\n`);
      console.log('[Migration] These should be manually reviewed and fixed\n');
    }

    // Summary
    const totalArticles = await Article.countDocuments({});
    const publicArticles = await Article.countDocuments({ visibility: 'public' });
    const privateArticles = await Article.countDocuments({ visibility: 'private' });

    console.log('[Migration] Summary:');
    console.log(`  Total articles: ${totalArticles}`);
    console.log(`  Public articles: ${publicArticles}`);
    console.log(`  Private articles: ${privateArticles}\n`);

    console.log('[Migration] ✅ Backfill complete\n');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('[Migration] ❌ Error during backfill:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

backfillVisibility();

