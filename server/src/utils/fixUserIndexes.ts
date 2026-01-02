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
 * Fix user indexes by dropping and recreating them
 * This resolves issues with stale index entries from deleted users
 */
export async function fixUserIndexes(): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log('\n🔧 FIXING USER INDEXES');
    console.log('═'.repeat(100));

    // List current indexes
    console.log('\n📋 Current indexes:');
    const indexes = await User.collection.getIndexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Get all users to verify data integrity
    const allUsers = await User.find().select('-password');
    console.log(`\n📊 Total users in database: ${allUsers.length}`);
    
    // Check for duplicate emails/usernames in actual data
    const emailSet = new Set<string>();
    const usernameSet = new Set<string>();
    const duplicates: Array<{ type: 'email' | 'username'; value: string; count: number }> = [];

    allUsers.forEach(user => {
      const email = (user.auth?.email || '').toLowerCase().trim();
      const username = (user.profile?.username || '').toLowerCase().trim();
      
      if (email) {
        if (emailSet.has(email)) {
          const existing = duplicates.find(d => d.type === 'email' && d.value === email);
          if (existing) {
            existing.count++;
          } else {
            duplicates.push({ type: 'email', value: email, count: 2 });
          }
        } else {
          emailSet.add(email);
        }
      }
      
      if (username) {
        if (usernameSet.has(username)) {
          const existing = duplicates.find(d => d.type === 'username' && d.value === username);
          if (existing) {
            existing.count++;
          } else {
            duplicates.push({ type: 'username', value: username, count: 2 });
          }
        } else {
          usernameSet.add(username);
        }
      }
    });

    if (duplicates.length > 0) {
      console.log('\n⚠️  Found duplicates in actual data:');
      duplicates.forEach(dup => {
        console.log(`  ${dup.type}: ${dup.value} (${dup.count} users)`);
      });
      console.log('\n⚠️  Cannot rebuild indexes with duplicate data. Please clean up duplicates first.');
      return;
    }

    console.log('\n✅ No duplicates found in data. Safe to rebuild indexes.');

    // Drop existing unique indexes
    console.log('\n🗑️  Dropping existing indexes...');
    try {
      await User.collection.dropIndex('auth.email_1').catch(() => {
        console.log('  Index auth.email_1 not found (may have different name)');
      });
    } catch (e: any) {
      console.log(`  Note: ${e.message}`);
    }

    try {
      await User.collection.dropIndex('profile.username_1').catch(() => {
        console.log('  Index profile.username_1 not found (may have different name)');
      });
    } catch (e: any) {
      console.log(`  Note: ${e.message}`);
    }

    // Try to drop all indexes and recreate
    try {
      // Get all index names except _id
      const indexNames = Object.keys(indexes).filter(name => name !== '_id_');
      for (const indexName of indexNames) {
        if (indexName.includes('email') || indexName.includes('username')) {
          try {
            await User.collection.dropIndex(indexName);
            console.log(`  ✓ Dropped index: ${indexName}`);
          } catch (e: any) {
            console.log(`  Note: Could not drop ${indexName}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      console.log(`  Note: ${e.message}`);
    }

    // Recreate indexes
    console.log('\n🔨 Recreating indexes...');
    
    try {
      await User.collection.createIndex(
        { 'auth.email': 1 },
        { unique: true, name: 'auth.email_1' }
      );
      console.log('  ✓ Created index: auth.email_1 (unique)');
    } catch (e: any) {
      console.log(`  Error creating email index: ${e.message}`);
    }

    try {
      await User.collection.createIndex(
        { 'profile.username': 1 },
        { unique: true, name: 'profile.username_1' }
      );
      console.log('  ✓ Created index: profile.username_1 (unique)');
    } catch (e: any) {
      console.log(`  Error creating username index: ${e.message}`);
    }

    // Verify indexes
    console.log('\n✅ Verifying indexes...');
    const newIndexes = await User.collection.getIndexes();
    console.log('Current indexes after rebuild:');
    console.log(JSON.stringify(newIndexes, null, 2));

    console.log('\n' + '═'.repeat(100));
    console.log('✅ Index rebuild complete');

  } catch (error: any) {
    console.error('❌ Error fixing indexes:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection if we opened it
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Allow running directly from command line
// When run via tsx, the file path will be in process.argv[1]
const filePath = process.argv[1] || '';
const isMainModule = filePath.includes('fixUserIndexes.ts') || 
                     filePath.includes('fixUserIndexes.js') ||
                     import.meta.url.endsWith('fixUserIndexes.ts') ||
                     import.meta.url.endsWith('fixUserIndexes.js');

if (isMainModule || process.argv.length > 1) {
  // Run the function
  (async () => {
    try {
      await fixUserIndexes();
      console.log('\n✅ Done');
      process.exit(0);
    } catch (error: any) {
      console.error('\n❌ Failed:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  })();
}


