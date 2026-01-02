/**
 * Sanitize Collections: Remove orphaned references
 */

import { Collection } from '../../models/Collection.js';
import { Article } from '../../models/Article.js';
import { User } from '../../models/User.js';
import { CleanupResult } from './types.js';

export async function sanitizeCollections(dryRun: boolean = true): Promise<CleanupResult> {
  const result: CleanupResult = {
    collection: 'Collection',
    operation: 'Remove orphaned references',
    recordsScanned: 0,
    recordsCleaned: 0,
    recordsSkipped: 0,
    errors: []
  };

  try {
    // Get valid IDs
    const validUserIds = new Set(
      (await User.find({}, '_id').lean()).map(u => u._id.toString())
    );
    const validArticleIds = new Set(
      (await Article.find({}, '_id').lean()).map(a => a._id.toString())
    );

    const collections = await Collection.find({}).lean();
    result.recordsScanned = collections.length;

    for (const collection of collections) {
      const collectionId = collection._id.toString();
      let needsUpdate = false;
      const updates: any = {};

      // Clean orphaned followers
      if (collection.followers && Array.isArray(collection.followers)) {
        const validFollowers = collection.followers.filter(
          (followerId: string) => validUserIds.has(followerId)
        );
        if (validFollowers.length !== collection.followers.length) {
          const removedCount = collection.followers.length - validFollowers.length;
          if (dryRun) {
            console.log(`[DRY RUN] Would remove ${removedCount} orphaned followers from collection ${collectionId}`);
          } else {
            updates.followers = validFollowers;
            updates.followersCount = validFollowers.length;
          }
          needsUpdate = true;
        }
      }

      // Clean orphaned entries
      if (collection.entries && Array.isArray(collection.entries)) {
        const validEntries = collection.entries.filter((entry: any) => {
          const hasValidArticle = entry.articleId && validArticleIds.has(entry.articleId);
          const hasValidUser = entry.addedByUserId && validUserIds.has(entry.addedByUserId);
          return hasValidArticle && hasValidUser;
        });

        if (validEntries.length !== collection.entries.length) {
          const removedCount = collection.entries.length - validEntries.length;
          if (dryRun) {
            console.log(`[DRY RUN] Would remove ${removedCount} orphaned entries from collection ${collectionId}`);
          } else {
            updates.entries = validEntries;
            updates.validEntriesCount = validEntries.length;
          }
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        if (dryRun) {
          result.recordsSkipped++;
        } else {
          try {
            await Collection.updateOne(
              { _id: collection._id },
              { $set: updates }
            );
            result.recordsCleaned++;
          } catch (error: any) {
            result.errors.push(`Failed to update collection ${collectionId}: ${error.message}`);
          }
        }
      }
    }

    // Note: We don't auto-fix orphaned creatorId as it requires manual review
    // Collections with orphaned creatorId are marked for CONDITIONAL_CLEANUP

  } catch (error: any) {
    result.errors.push(`Error sanitizing collections: ${error.message}`);
  }

  return result;
}











