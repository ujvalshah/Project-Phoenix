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
 * Diagnose user issues: list all users, check for duplicates, identify problems
 */
export async function diagnoseUserIssues(): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log('\n🔍 DIAGNOSING USER ISSUES');
    console.log('═'.repeat(100));

    // Get ALL users (no pagination, no filtering)
    const allUsers = await User.find().select('-password');
    const totalUsers = allUsers.length;

    console.log(`\n📊 TOTAL USERS IN DATABASE: ${totalUsers}\n`);

    if (totalUsers === 0) {
      console.log('⚠️  No users found in database.');
      return;
    }

    // List all users
    console.log('📋 ALL USERS IN DATABASE:');
    console.log('─'.repeat(100));
    allUsers.forEach((user, index) => {
      const userObj = user.toObject();
      const email = userObj.auth?.email || 'N/A';
      const username = userObj.profile?.username || 'N/A';
      const name = userObj.profile?.displayName || 'N/A';
      const id = userObj._id.toString();
      
      console.log(`${index + 1}. ID: ${id}`);
      console.log(`   Email: ${email}`);
      console.log(`   Username: ${username}`);
      console.log(`   Name: ${name}`);
      console.log(`   Role: ${userObj.role || 'user'}`);
      if (index < allUsers.length - 1) {
        console.log('─'.repeat(100));
      }
    });

    // Check for duplicate emails
    console.log('\n\n🔍 CHECKING FOR DUPLICATE EMAILS:');
    console.log('─'.repeat(100));
    const emailMap = new Map<string, Array<{ id: string; email: string; username: string }>>();
    
    allUsers.forEach(user => {
      const userObj = user.toObject();
      const email = (userObj.auth?.email || '').toLowerCase().trim();
      const username = userObj.profile?.username || 'N/A';
      if (email && email !== 'N/A') {
        if (!emailMap.has(email)) {
          emailMap.set(email, []);
        }
        emailMap.get(email)!.push({
          id: userObj._id.toString(),
          email: userObj.auth?.email || email,
          username
        });
      }
    });

    const duplicateEmails: Array<{ email: string; count: number; userIds: string[] }> = [];
    emailMap.forEach((entries, email) => {
      if (entries.length > 1) {
        duplicateEmails.push({
          email,
          count: entries.length,
          userIds: entries.map(e => e.id)
        });
      }
    });

    if (duplicateEmails.length > 0) {
      console.log(`⚠️  FOUND ${duplicateEmails.length} DUPLICATE EMAIL(S):`);
      duplicateEmails.forEach((dup, idx) => {
        console.log(`\n${idx + 1}. Email: ${dup.email}`);
        console.log(`   Count: ${dup.count} users`);
        console.log(`   User IDs: ${dup.userIds.join(', ')}`);
      });
    } else {
      console.log('✅ No duplicate emails found');
    }

    // Check for duplicate usernames
    console.log('\n\n🔍 CHECKING FOR DUPLICATE USERNAMES:');
    console.log('─'.repeat(100));
    const usernameMap = new Map<string, Array<{ id: string; username: string; email: string }>>();
    
    allUsers.forEach(user => {
      const userObj = user.toObject();
      const username = (userObj.profile?.username || '').toLowerCase().trim();
      const email = userObj.auth?.email || 'N/A';
      if (username && username !== 'N/A') {
        if (!usernameMap.has(username)) {
          usernameMap.set(username, []);
        }
        usernameMap.get(username)!.push({
          id: userObj._id.toString(),
          username: userObj.profile?.username || username,
          email
        });
      }
    });

    const duplicateUsernames: Array<{ username: string; count: number; userIds: string[] }> = [];
    usernameMap.forEach((entries, username) => {
      if (entries.length > 1) {
        duplicateUsernames.push({
          username,
          count: entries.length,
          userIds: entries.map(e => e.id)
        });
      }
    });

    if (duplicateUsernames.length > 0) {
      console.log(`⚠️  FOUND ${duplicateUsernames.length} DUPLICATE USERNAME(S):`);
      duplicateUsernames.forEach((dup, idx) => {
        console.log(`\n${idx + 1}. Username: ${dup.username}`);
        console.log(`   Count: ${dup.count} users`);
        console.log(`   User IDs: ${dup.userIds.join(', ')}`);
      });
    } else {
      console.log('✅ No duplicate usernames found');
    }

    // Check for users with missing required fields
    console.log('\n\n🔍 CHECKING FOR INVALID USERS:');
    console.log('─'.repeat(100));
    const invalidUsers: Array<{ id: string; issues: string[] }> = [];
    
    allUsers.forEach(user => {
      const userObj = user.toObject();
      const issues: string[] = [];
      
      if (!userObj.auth?.email) {
        issues.push('Missing email');
      }
      if (!userObj.profile?.username) {
        issues.push('Missing username');
      }
      if (!userObj.profile?.displayName) {
        issues.push('Missing display name');
      }
      
      if (issues.length > 0) {
        invalidUsers.push({
          id: userObj._id.toString(),
          issues
        });
      }
    });

    if (invalidUsers.length > 0) {
      console.log(`⚠️  FOUND ${invalidUsers.length} INVALID USER(S):`);
      invalidUsers.forEach((user, idx) => {
        console.log(`\n${idx + 1}. User ID: ${user.id}`);
        console.log(`   Issues: ${user.issues.join(', ')}`);
      });
    } else {
      console.log('✅ All users have required fields');
    }

    console.log('\n' + '═'.repeat(100));
    console.log(`\n✅ Diagnosis complete. Total users: ${totalUsers}`);
    console.log(`   Duplicate emails: ${duplicateEmails.length}`);
    console.log(`   Duplicate usernames: ${duplicateUsernames.length}`);
    console.log(`   Invalid users: ${invalidUsers.length}`);

  } catch (error: any) {
    console.error('❌ Error diagnosing user issues:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection if we opened it
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Allow running directly from command line
if (import.meta.url === `file://${process.argv[1]}`) {
  diagnoseUserIssues()
    .then(() => {
      console.log('\n✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error.message);
      process.exit(1);
    });
}











