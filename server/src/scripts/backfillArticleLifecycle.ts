/**
 * Draft Lifecycle Migration: Backfill status + publishedAt for legacy articles.
 *
 * This script:
 * 1) Sets status='published' for rows missing status
 * 2) Sets publishedAt from createdAt when publishedAt is missing/null on published rows
 *
 * Run: tsx server/src/scripts/backfillArticleLifecycle.ts
 */

import '../loadEnv.js';

import mongoose from 'mongoose';
import { validateEnv } from '../config/envValidation.js';
import { Article } from '../models/Article.js';
import { connectDB } from '../utils/db.js';
import { initLogger } from '../utils/logger.js';

async function backfillArticleLifecycle(): Promise<void> {
  console.log('[Lifecycle Backfill] Starting status/publishedAt backfill...\n');

  try {
    validateEnv();
    initLogger();
    await connectDB();
    console.log('[Lifecycle Backfill] Connected to database\n');

    const missingStatusQuery = {
      $or: [{ status: { $exists: false } }, { status: null }],
    };

    const missingStatusCount = await Article.countDocuments(missingStatusQuery);
    console.log(`[Lifecycle Backfill] Found ${missingStatusCount} articles missing status`);

    if (missingStatusCount > 0) {
      const statusResult = await Article.updateMany(missingStatusQuery, {
        $set: { status: 'published' },
      });
      console.log(`[Lifecycle Backfill] Updated status on ${statusResult.modifiedCount} articles`);
    }

    const publishedWithoutPublishedAtQuery = {
      $and: [
        {
          $or: [{ status: 'published' }, { status: { $exists: false } }, { status: null }],
        },
        {
          $or: [{ publishedAt: { $exists: false } }, { publishedAt: null }, { publishedAt: '' }],
        },
      ],
    };

    const candidates = await Article.find(publishedWithoutPublishedAtQuery)
      .select('_id createdAt')
      .lean();

    console.log(
      `[Lifecycle Backfill] Found ${candidates.length} published articles missing publishedAt`
    );

    if (candidates.length > 0) {
      const ops = candidates.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              publishedAt: doc.createdAt
                ? new Date(doc.createdAt).toISOString()
                : new Date().toISOString(),
            },
          },
        },
      }));

      const bulkResult = await Article.bulkWrite(ops, { ordered: false });
      console.log(
        `[Lifecycle Backfill] Updated publishedAt on ${bulkResult.modifiedCount ?? 0} articles`
      );
    }

    const missingStatusAfter = await Article.countDocuments(missingStatusQuery);
    const missingPublishedAtAfter = await Article.countDocuments(publishedWithoutPublishedAtQuery);

    console.log('\n[Lifecycle Backfill] Verification:');
    console.log(`  Missing status: ${missingStatusAfter}`);
    console.log(`  Published rows missing publishedAt: ${missingPublishedAtAfter}`);

    const draftCount = await Article.countDocuments({ status: 'draft' });
    const publishedCount = await Article.countDocuments({
      $or: [{ status: 'published' }, { status: { $exists: false } }, { status: null }],
    });

    console.log('\n[Lifecycle Backfill] Summary:');
    console.log(`  Draft articles: ${draftCount}`);
    console.log(`  Published articles: ${publishedCount}`);

    console.log('\n[Lifecycle Backfill] ✅ Backfill complete');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Lifecycle Backfill] ❌ Backfill failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

backfillArticleLifecycle();

