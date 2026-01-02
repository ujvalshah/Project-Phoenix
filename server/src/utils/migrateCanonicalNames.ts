/**
 * Migration script to backfill canonicalName for existing Tag and Collection records
 * 
 * This script:
 * 1. Adds canonicalName to all existing Tag records (from rawName or name)
 * 2. Adds canonicalName to all existing Collection records (from rawName or name)
 * 3. Handles duplicate canonicalNames by keeping the first occurrence and logging conflicts
 * 
 * Run this once after deploying the schema changes.
 */

import { Tag } from '../models/Tag.js';
import { Collection } from '../models/Collection.js';
import { isMongoConnected } from './db.js';

export async function migrateCanonicalNames(): Promise<void> {
  if (!isMongoConnected()) {
    console.log('[Migration] Skipped - MongoDB not connected');
    return;
  }

  try {
    console.log('[Migration] Starting canonicalName migration...');

    // ============================================
    // MIGRATE TAGS
    // ============================================
    console.log('[Migration] Migrating Tags...');
    const tags = await Tag.find({}).lean();
    let tagsUpdated = 0;
    let tagsSkipped = 0;
    const tagConflicts: Array<{ existing: string; duplicate: string; canonical: string }> = [];

    for (const tag of tags) {
      // Skip if already has canonicalName
      if (tag.canonicalName) {
        tagsSkipped++;
        continue;
      }

      // Get rawName from tag (use name if rawName doesn't exist for backward compatibility)
      const rawName = tag.rawName || tag.name || '';
      if (!rawName) {
        console.warn(`[Migration] Tag ${tag._id} has no name, skipping`);
        continue;
      }

      const canonicalName = rawName.trim().toLowerCase();

      // Check for existing tag with same canonicalName
      const existingTag = await Tag.findOne({ 
        canonicalName,
        _id: { $ne: tag._id }
      });

      if (existingTag) {
        // Conflict: another tag already has this canonicalName
        tagConflicts.push({
          existing: existingTag.rawName || existingTag.name || '',
          duplicate: rawName,
          canonical: canonicalName
        });
        console.warn(`[Migration] Tag conflict: "${rawName}" conflicts with existing "${existingTag.rawName || existingTag.name}" (canonical: "${canonicalName}")`);
        // Skip updating this tag - it will need manual resolution
        tagsSkipped++;
        continue;
      }

      // Update tag with canonicalName (and rawName if missing)
      await Tag.findByIdAndUpdate(tag._id, {
        $set: {
          rawName: tag.rawName || rawName,
          canonicalName: canonicalName
        }
      });

      tagsUpdated++;
    }

    console.log(`[Migration] Tags: ${tagsUpdated} updated, ${tagsSkipped} skipped, ${tagConflicts.length} conflicts`);

    // ============================================
    // MIGRATE COLLECTIONS
    // ============================================
    console.log('[Migration] Migrating Collections...');
    const collections = await Collection.find({}).lean();
    let collectionsUpdated = 0;
    let collectionsSkipped = 0;
    const collectionConflicts: Array<{ existing: string; duplicate: string; canonical: string; creatorId: string }> = [];

    for (const collection of collections) {
      // Skip if already has canonicalName
      if (collection.canonicalName) {
        collectionsSkipped++;
        continue;
      }

      // Get rawName from collection (use name if rawName doesn't exist for backward compatibility)
      const rawName = collection.rawName || collection.name || '';
      if (!rawName) {
        console.warn(`[Migration] Collection ${collection._id} has no name, skipping`);
        continue;
      }

      const canonicalName = rawName.trim().toLowerCase();

      // Check for existing collection with same canonicalName
      // For private collections: check per creator
      // For public collections: check globally
      const query: any = {
        canonicalName,
        _id: { $ne: collection._id }
      };
      
      if (collection.type === 'private') {
        query.creatorId = collection.creatorId;
        query.type = 'private';
      } else {
        query.type = 'public';
      }

      const existingCollection = await Collection.findOne(query);

      if (existingCollection) {
        // Conflict: another collection already has this canonicalName
        collectionConflicts.push({
          existing: existingCollection.rawName || existingCollection.name || '',
          duplicate: rawName,
          canonical: canonicalName,
          creatorId: collection.creatorId
        });
        console.warn(`[Migration] Collection conflict: "${rawName}" conflicts with existing "${existingCollection.rawName || existingCollection.name}" (canonical: "${canonicalName}", creator: ${collection.creatorId})`);
        // Skip updating this collection - it will need manual resolution
        collectionsSkipped++;
        continue;
      }

      // Update collection with canonicalName (and rawName if missing)
      await Collection.findByIdAndUpdate(collection._id, {
        $set: {
          rawName: collection.rawName || rawName,
          canonicalName: canonicalName
        }
      });

      collectionsUpdated++;
    }

    console.log(`[Migration] Collections: ${collectionsUpdated} updated, ${collectionsSkipped} skipped, ${collectionConflicts.length} conflicts`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('[Migration] Migration complete!');
    console.log(`[Migration] Summary:`);
    console.log(`  Tags: ${tagsUpdated} updated, ${tagsSkipped} skipped`);
    console.log(`  Collections: ${collectionsUpdated} updated, ${collectionsSkipped} skipped`);
    
    if (tagConflicts.length > 0) {
      console.log(`\n[Migration] Tag Conflicts (${tagConflicts.length}):`);
      tagConflicts.forEach(conflict => {
        console.log(`  - "${conflict.duplicate}" conflicts with "${conflict.existing}" (canonical: "${conflict.canonical}")`);
      });
    }

    if (collectionConflicts.length > 0) {
      console.log(`\n[Migration] Collection Conflicts (${collectionConflicts.length}):`);
      collectionConflicts.forEach(conflict => {
        console.log(`  - "${conflict.duplicate}" conflicts with "${conflict.existing}" (canonical: "${conflict.canonical}", creator: ${conflict.creatorId})`);
      });
    }

    if (tagConflicts.length > 0 || collectionConflicts.length > 0) {
      console.log('\n[Migration] WARNING: Conflicts detected. Please review and resolve manually.');
    }

  } catch (error: any) {
    console.error('[Migration] Error during migration:', error);
    throw error;
  }
}



