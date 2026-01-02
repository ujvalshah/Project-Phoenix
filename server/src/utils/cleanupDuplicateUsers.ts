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
 * Cleanup duplicate users - keeps the most recent one, deletes older duplicates
 */
export async function cleanupDuplicateUsers(dryRun: boolean = true): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log('\n🧹 CLEANING UP DUPLICATE USERS');
    console.log('═'.repeat(100));
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will delete duplicates)'}\n`);

    // Get all users
    const allUsers = await User.find().select('-password');
    
    // Group by email
    const emailGroups = new Map<string, typeof allUsers>();
    allUsers.forEach(user => {
      const email = (user.auth?.email || '').toLowerCase().trim();
      if (email) {
        if (!emailGroups.has(email)) {
          emailGroups.set(email, []);
        }
        emailGroups.get(email)!.push(user);
      }
    });

    // Group by username
    const usernameGroups = new Map<string, typeof allUsers>();
    allUsers.forEach(user => {
      const username = (user.profile?.username || '').toLowerCase().trim();
      if (username) {
        if (!usernameGroups.has(username)) {
          usernameGroups.set(username, []);
        }
        usernameGroups.get(username)!.push(user);
      }
    });

    let deletedCount = 0;
    const usersToDelete: string[] = [];

    // Process duplicate emails
    console.log('📧 Processing duplicate emails...');
    emailGroups.forEach((users, email) => {
      if (users.length > 1) {
        console.log(`\n  Found ${users.length} users with email: ${email}`);
        
        // Sort by creation date (newest first)
        users.sort((a, b) => {
          const dateA = new Date(a.auth?.createdAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.auth?.createdAt || b.createdAt || 0).getTime();
          return dateB - dateA; // Newest first
        });

        // Keep the first (newest), mark others for deletion
        const keepUser = users[0];
        const deleteUsers = users.slice(1);
        
        console.log(`    Keeping: ${keepUser._id} (created: ${keepUser.auth?.createdAt || keepUser.createdAt})`);
        deleteUsers.forEach(user => {
          const userId = user._id.toString();
          console.log(`    Marking for deletion: ${userId} (created: ${user.auth?.createdAt || user.createdAt})`);
          if (!usersToDelete.includes(userId)) {
            usersToDelete.push(userId);
          }
        });
      }
    });

    // Process duplicate usernames
    console.log('\n👤 Processing duplicate usernames...');
    usernameGroups.forEach((users, username) => {
      if (users.length > 1) {
        console.log(`\n  Found ${users.length} users with username: ${username}`);
        
        // Sort by creation date (newest first)
        users.sort((a, b) => {
          const dateA = new Date(a.auth?.createdAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.auth?.createdAt || b.createdAt || 0).getTime();
          return dateB - dateA; // Newest first
        });

        // Keep the first (newest), mark others for deletion
        const keepUser = users[0];
        const deleteUsers = users.slice(1);
        
        console.log(`    Keeping: ${keepUser._id} (created: ${keepUser.auth?.createdAt || keepUser.createdAt})`);
        deleteUsers.forEach(user => {
          const userId = user._id.toString();
          console.log(`    Marking for deletion: ${userId} (created: ${user.auth?.createdAt || user.createdAt})`);
          if (!usersToDelete.includes(userId)) {
            usersToDelete.push(userId);
          }
        });
      }
    });

    if (usersToDelete.length === 0) {
      console.log('\n✅ No duplicate users found. Database is clean.');
      return;
    }

    console.log(`\n\n📊 SUMMARY:`);
    console.log(`   Users to delete: ${usersToDelete.length}`);
    console.log(`   User IDs: ${usersToDelete.join(', ')}`);

    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No users were deleted.');
      console.log('   Run with DRY_RUN=false to actually delete these users.');
    } else {
      console.log('\n🗑️  DELETING DUPLICATE USERS...');
      const deleteResult = await User.deleteMany({
        _id: { $in: usersToDelete.map(id => new mongoose.Types.ObjectId(id)) }
      });
      deletedCount = deleteResult.deletedCount || 0;
      console.log(`✅ Deleted ${deletedCount} duplicate user(s)`);
    }

    console.log('\n' + '═'.repeat(100));
    console.log(`\n✅ Cleanup complete.`);

  } catch (error: any) {
    console.error('❌ Error cleaning up duplicate users:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection if we opened it
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Allow running directly from command line
const dryRun = process.env.DRY_RUN !== 'false';
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDuplicateUsers(dryRun)
    .then(() => {
      console.log('\n✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error.message);
      process.exit(1);
    });
}











