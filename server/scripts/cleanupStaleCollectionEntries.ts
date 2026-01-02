/**
 * One-time migration script to clean up stale collection entries.
 * 
 * This script:
 * 1. Finds all collections with entries
 * 2. Validates each entry against existing articles
 * 3. Removes entries referencing non-existent articles
 * 4. Updates validEntriesCount
 * 
 * Usage:
 *   npx ts-node server/scripts/cleanupStaleCollectionEntries.ts
 * 
 * This is a ONE-TIME script - not part of runtime logic.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Collection } from '../src/models/Collection.js';
import { Article } from '../src/models/Article.js';
import { connectDB } from '../src/utils/db.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(rootPath, '.env') });

async function cleanupStaleEntries() {
  try {
    console.log('[Cleanup] Connecting to database...');
    await connectDB();
    
    console.log('[Cleanup] Fetching all articles...');
    const allArticles = await Article.find({}, { _id: 1 });
    const validArticleIds = new Set(allArticles.map(a => a._id.toString()));
    console.log(`[Cleanup] Found ${validArticleIds.size} valid articles`);
    
    console.log('[Cleanup] Fetching all collections...');
    const collections = await Collection.find({});
    console.log(`[Cleanup] Found ${collections.length} collections`);
    
    let totalStaleEntries = 0;
    let collectionsUpdated = 0;
    
    for (const collection of collections) {
      const originalLength = collection.entries.length;
      const validEntries = collection.entries.filter(entry => 
        validArticleIds.has(entry.articleId)
      );
      const staleCount = originalLength - validEntries.length;
      
      if (staleCount > 0) {
        console.log(`[Cleanup] Collection "${collection.name}" (${collection._id}): Removing ${staleCount} stale entries`);
        
        collection.entries = validEntries;
        collection.validEntriesCount = validEntries.length;
        collection.updatedAt = new Date().toISOString();
        await collection.save();
        
        totalStaleEntries += staleCount;
        collectionsUpdated++;
      } else if (collection.validEntriesCount === undefined || collection.validEntriesCount === null) {
        // Initialize validEntriesCount for collections without stale entries
        collection.validEntriesCount = validEntries.length;
        await collection.save();
        collectionsUpdated++;
      }
    }
    
    console.log(`[Cleanup] ✓ Complete!`);
    console.log(`[Cleanup]   - Collections updated: ${collectionsUpdated}`);
    console.log(`[Cleanup]   - Stale entries removed: ${totalStaleEntries}`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('[Cleanup] Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanupStaleEntries();

