/**
 * Fix Tag Name Index Issue
 * 
 * Problem: Legacy unique index on `name` field causes duplicate key errors
 * when creating tags because `name` is now a virtual field (maps to rawName).
 * 
 * Solution: Drop the legacy `name_1` index from the tags collection.
 * 
 * Usage:
 *   npx tsx server/src/scripts/fixTagNameIndex.ts
 */

// IMPORTANT: Load environment variables FIRST before any other imports
import '../loadEnv.js';

// CRITICAL: Validate environment variables BEFORE any other imports
import { validateEnv } from '../config/envValidation.js';
validateEnv();

// Initialize Logger early (after validateEnv, before other imports that might log)
import { initLogger } from '../utils/logger.js';
initLogger();

import mongoose from 'mongoose';
import { connectDB } from '../utils/db.js';

async function fixTagNameIndex() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected!\n');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const tagsCollection = db.collection('tags');
    
    // List all indexes
    console.log('Current indexes on tags collection:');
    const indexes = await tagsCollection.indexes();
    indexes.forEach((index: any) => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });
    console.log('');

    // Check if name_1 index exists
    const nameIndex = indexes.find((idx: any) => idx.name === 'name_1');
    
    if (nameIndex) {
      console.log('⚠️  Found legacy `name_1` index - this is causing the issue!');
      console.log('   Dropping legacy index...\n');
      
      await tagsCollection.dropIndex('name_1');
      console.log('✅ Successfully dropped `name_1` index!\n');
      
      // Verify it's gone
      const updatedIndexes = await tagsCollection.indexes();
      const stillExists = updatedIndexes.find((idx: any) => idx.name === 'name_1');
      
      if (stillExists) {
        console.error('❌ Index still exists after drop attempt!');
        process.exit(1);
      } else {
        console.log('✅ Verified: `name_1` index has been removed.\n');
        console.log('Updated indexes:');
        updatedIndexes.forEach((index: any) => {
          console.log(`  - ${index.name}:`, JSON.stringify(index.key));
        });
      }
    } else {
      console.log('✅ No `name_1` index found - database is already clean!\n');
    }

    await mongoose.connection.close();
    console.log('\n✅ Fix complete! Tag creation should now work correctly.');
  } catch (error: any) {
    console.error('❌ Error fixing index:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

fixTagNameIndex();


