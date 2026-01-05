#!/usr/bin/env node
/**
 * Bookmark Folders Removal - Database Migration Script
 * 
 * SAFELY removes all bookmark folder data from MongoDB collections:
 * - bookmarks (Bookmark model)
 * - bookmarkfolders (BookmarkFolder model)
 * - bookmarkfolderlinks (BookmarkFolderLink model)
 * 
 * IMPORTANT: This script does NOT modify:
 * - Articles
 * - Users
 * - Collections
 * - Any other data
 * 
 * Usage:
 *   npx tsx server/scripts/removeBookmarkFolders.ts           # Dry run (default)
 *   npx tsx server/scripts/removeBookmarkFolders.ts --apply   # Execute deletion
 * 
 * Environment Variables:
 *   MONGO_URI or MONGODB_URI - MongoDB connection string
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../..');

// Load environment variables
dotenv.config({ path: path.join(rootPath, '.env') });

// Configuration
const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;

// Collection names (Mongoose model names converted to collection names)
const COLLECTIONS = {
  BOOKMARKS: 'bookmarks',
  BOOKMARK_FOLDERS: 'bookmarkfolders',
  BOOKMARK_FOLDER_LINKS: 'bookmarkfolderlinks'
} as const;

interface CollectionStats {
  name: string;
  count: number;
  sampleDocs: any[];
}

/**
 * Get collection statistics
 */
async function getCollectionStats(collectionName: string): Promise<CollectionStats> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not available');
  }

  const collection = db.collection(collectionName);
  const count = await collection.countDocuments();
  
  // Get first 3 sample documents (ID and keys only)
  const sampleDocs = await collection
    .find({})
    .limit(3)
    .project({ _id: 1 }) // Only get _id field
    .toArray();

  // Get full sample for preview (first document only)
  const fullSample = count > 0 
    ? await collection.findOne({}, { projection: { _id: 1 } })
    : null;

  return {
    name: collectionName,
    count,
    sampleDocs: fullSample ? [fullSample] : []
  };
}

/**
 * Delete all documents from a collection
 */
async function deleteCollection(collectionName: string): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not available');
  }

  const collection = db.collection(collectionName);
  const result = await collection.deleteMany({});
  return result.deletedCount || 0;
}

/**
 * Main migration function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('BOOKMARK FOLDERS REMOVAL - DATABASE MIGRATION');
  console.log('='.repeat(80));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (No data will be modified)' : '⚠️  EXECUTION MODE (Data will be deleted)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    // Connect to database directly
    console.log('[1/4] Connecting to database...');
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!MONGO_URI) {
      throw new Error('MONGO_URI or MONGODB_URI environment variable is required');
    }

    // Add database name if not present in URI
    let connectionString = MONGO_URI;
    const dbNameMatch = connectionString.match(/mongodb\+?srv?:\/\/[^\/]+\/([^\/\?]+)/);
    if (!dbNameMatch || dbNameMatch[1] === '') {
      if (connectionString.includes('/?')) {
        connectionString = connectionString.replace('/?', '/nuggets?');
      } else if (connectionString.includes('?')) {
        connectionString = connectionString.replace('?', '/nuggets?');
      } else {
        connectionString = connectionString + '/nuggets';
      }
    }

    await mongoose.connect(connectionString);
    console.log('✓ Database connected\n');

    // Get database name for display
    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    console.log(`Database: ${dbName}\n`);

    // Check collections
    console.log('[2/4] Scanning bookmark folder collections...');
    console.log('-'.repeat(80));

    const stats: CollectionStats[] = [];
    let totalDocuments = 0;

    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
      const collectionStats = await getCollectionStats(collectionName);
      stats.push(collectionStats);
      totalDocuments += collectionStats.count;

      console.log(`\nCollection: ${collectionName}`);
      console.log(`  Documents: ${collectionStats.count}`);

      if (collectionStats.count > 0) {
        if (collectionStats.sampleDocs.length > 0) {
          console.log(`  Sample document ID: ${collectionStats.sampleDocs[0]._id}`);
        }
        // Get a few more sample IDs
        const sampleIds = await mongoose.connection.db!
          .collection(collectionName)
          .find({}, { projection: { _id: 1 } })
          .limit(3)
          .toArray();
        
        if (sampleIds.length > 0) {
          console.log(`  Sample IDs (first 3):`);
          sampleIds.forEach((doc, idx) => {
            console.log(`    ${idx + 1}. ${doc._id}`);
          });
        }
      } else {
        console.log(`  Status: Empty (no action needed)`);
      }
    }

    console.log('\n' + '-'.repeat(80));
    console.log(`Total documents to delete: ${totalDocuments}`);
    console.log('-'.repeat(80));
    console.log('');

    // If no documents found, exit early
    if (totalDocuments === 0) {
      console.log('✓ No bookmark folder data found in database.');
      console.log('✓ Migration not needed - collections are already empty.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Dry run mode - show what would be deleted
    if (DRY_RUN) {
      console.log('[3/4] DRY RUN - Preview of deletions:');
      console.log('-'.repeat(80));
      console.log('');
      console.log('The following collections would be cleared:');
      stats.forEach(stat => {
        if (stat.count > 0) {
          console.log(`  - ${stat.name}: ${stat.count} document(s)`);
        }
      });
      console.log('');
      console.log('='.repeat(80));
      console.log('DRY RUN COMPLETE - No data was modified');
      console.log('='.repeat(80));
      console.log('');
      console.log('To execute the deletion, run:');
      console.log('  npx tsx server/scripts/removeBookmarkFolders.ts --apply');
      console.log('');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Execution mode - confirm and delete
    console.log('[3/4] EXECUTION MODE - Deleting bookmark folder data...');
    console.log('-'.repeat(80));
    console.log('');
    console.log('⚠️  WARNING: This will permanently delete all bookmark folder data!');
    console.log('');
    console.log('Collections to be cleared:');
    stats.forEach(stat => {
      if (stat.count > 0) {
        console.log(`  - ${stat.name}: ${stat.count} document(s)`);
      }
    });
    console.log('');

    // Perform deletions
    const deletionResults: { collection: string; deleted: number }[] = [];
    let totalDeleted = 0;

    for (const stat of stats) {
      if (stat.count > 0) {
        console.log(`Deleting ${stat.name}...`);
        const deleted = await deleteCollection(stat.name);
        deletionResults.push({ collection: stat.name, deleted });
        totalDeleted += deleted;
        console.log(`  ✓ Deleted ${deleted} document(s)`);
      }
    }

    console.log('');
    console.log('[4/4] Verification...');
    console.log('-'.repeat(80));

    // Verify deletions
    let allCleared = true;
    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
      const verifyStats = await getCollectionStats(collectionName);
      if (verifyStats.count > 0) {
        console.log(`  ⚠️  ${collectionName}: Still has ${verifyStats.count} document(s)`);
        allCleared = false;
      } else {
        console.log(`  ✓ ${collectionName}: Cleared`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('MIGRATION SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total documents deleted: ${totalDeleted}`);
    deletionResults.forEach(result => {
      console.log(`  - ${result.collection}: ${result.deleted} document(s)`);
    });
    console.log('');
    console.log(`Verification: ${allCleared ? '✓ All collections cleared' : '⚠️  Some collections still contain data'}`);
    console.log('='.repeat(80));
    console.log('');

    if (allCleared) {
      console.log('✓ Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with warnings. Some data may remain.');
    }

    await mongoose.connection.close();
    process.exit(allCleared ? 0 : 1);

  } catch (error: any) {
    console.error('');
    console.error('='.repeat(80));
    console.error('ERROR: Migration failed');
    console.error('='.repeat(80));
    console.error(error.message);
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    console.error('');
    
    // Try to close connection
    try {
      await mongoose.connection.close();
    } catch (closeError) {
      // Ignore close errors
    }
    
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

