import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { connectDB } from './db.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../../../');
dotenv.config({ path: path.join(rootPath, '.env') });

/**
 * Fix email index issues by removing users with null/empty emails
 */
export async function fixEmailIndex(): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log('[FixIndex] Checking for users with null/empty emails...');
    
    // Find users with null or empty email in auth.email
    // Also check for users where auth.email doesn't exist or is undefined
    const badUsers = await User.find({
      $or: [
        { 'auth.email': null },
        { 'auth.email': '' },
        { 'auth.email': { $exists: false } },
        { 'auth': null },
        { 'auth': { $exists: false } },
        { $expr: { $eq: [{ $type: '$auth.email' }, 'null'] } }
      ]
    });

    if (badUsers.length > 0) {
      console.log(`[FixIndex] Found ${badUsers.length} user(s) with invalid email data. Deleting...`);
      const result = await User.deleteMany({
        $or: [
          { 'auth.email': null },
          { 'auth.email': '' },
          { 'auth.email': { $exists: false } },
          { 'auth': null },
          { 'auth': { $exists: false } },
          { $expr: { $eq: [{ $type: '$auth.email' }, 'null'] } }
        ]
      });
      console.log(`[FixIndex] ✓ Deleted ${result.deletedCount} invalid user(s)`);
    } else {
      console.log('[FixIndex] ✓ No users with invalid email data found');
    }
    
    // Also try to find and delete users using raw MongoDB query
    try {
      const rawResult = await User.collection.deleteMany({
        $or: [
          { 'auth.email': null },
          { 'auth.email': { $exists: false } },
          { 'auth': null },
          { 'auth': { $exists: false } }
        ]
      });
      if (rawResult.deletedCount > 0) {
        console.log(`[FixIndex] ✓ Deleted ${rawResult.deletedCount} additional invalid user(s) via raw query`);
      }
    } catch (e) {
      // Ignore if this fails
    }

    // Try to drop and recreate the email index
    try {
      console.log('[FixIndex] Rebuilding email index...');
      await User.collection.dropIndex('auth.email_1').catch(() => {
        // Index might not exist or have different name
      });
      await User.collection.createIndex({ 'auth.email': 1 }, { unique: true, sparse: false });
      console.log('[FixIndex] ✓ Email index rebuilt successfully');
    } catch (error: any) {
      console.log(`[FixIndex] Note: ${error.message}`);
      // Try alternative index name
      try {
        await User.collection.createIndex({ 'auth.email': 1 }, { unique: true, name: 'auth.email_1' });
        console.log('[FixIndex] ✓ Email index created with explicit name');
      } catch (e: any) {
        console.log(`[FixIndex] Index may already exist: ${e.message}`);
      }
    }

  } catch (error: any) {
    console.error('[FixIndex] Error fixing email index:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection if we opened it
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Allow running directly from command line
if (process.argv[1]?.includes('fixEmailIndex')) {
  fixEmailIndex()
    .then(() => {
      console.log('\nDone');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}











