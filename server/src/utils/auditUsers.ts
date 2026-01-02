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

interface AuditResult {
  totalUsers: number;
  partialUsers: Array<{
    id: string;
    email: string;
    issues: string[];
  }>;
  duplicateEmails: Array<{
    email: string;
    count: number;
    userIds: string[];
  }>;
  duplicateUsernames: Array<{
    username: string;
    count: number;
    userIds: string[];
  }>;
  usersWithoutPassword: Array<{
    id: string;
    email: string;
    provider: string;
  }>;
  usersWithoutUsername: Array<{
    id: string;
    email: string;
  }>;
  specificEmailCheck: {
    email: string;
    exists: boolean;
    userId?: string;
    hasPassword?: boolean;
    username?: string;
  };
}

/**
 * Comprehensive audit of User collection for data integrity issues
 */
export async function auditUsers(emailToCheck?: string): Promise<AuditResult> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const result: AuditResult = {
      totalUsers: 0,
      partialUsers: [],
      duplicateEmails: [],
      duplicateUsernames: [],
      usersWithoutPassword: [],
      usersWithoutUsername: [],
      specificEmailCheck: {
        email: emailToCheck || 'N/A',
        exists: false
      }
    };

    // Get all users WITH password field (using select('+password'))
    const allUsers = await User.find().select('+password');
    result.totalUsers = allUsers.length;

    console.log(`\n🔍 AUDITING USER COLLECTION`);
    console.log('═'.repeat(100));
    console.log(`Total users found: ${result.totalUsers}\n`);

    // Check for partial users, duplicates, and missing fields
    const emailMap = new Map<string, Array<{ id: string; email: string }>>();
    const usernameMap = new Map<string, Array<{ id: string; username: string }>>();

    for (const user of allUsers) {
      const userObj = user.toObject();
      const userId = userObj._id.toString();
      const email = userObj.auth?.email || userObj.email || null;
      const username = userObj.profile?.username || userObj.username || null;
      const password = userObj.password || null;
      const provider = userObj.auth?.provider || userObj.authProvider || 'email';

      // Track emails for duplicate detection
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        if (!emailMap.has(normalizedEmail)) {
          emailMap.set(normalizedEmail, []);
        }
        emailMap.get(normalizedEmail)!.push({ id: userId, email });
      }

      // Track usernames for duplicate detection
      if (username) {
        const normalizedUsername = username.toLowerCase().trim();
        if (!usernameMap.has(normalizedUsername)) {
          usernameMap.set(normalizedUsername, []);
        }
        usernameMap.get(normalizedUsername)!.push({ id: userId, username });
      }

      // Check for partial users (missing critical fields)
      const issues: string[] = [];
      
      if (!email) {
        issues.push('Missing email');
      }
      if (!username) {
        issues.push('Missing username');
        result.usersWithoutUsername.push({ id: userId, email: email || 'N/A' });
      }
      if (provider === 'email' && !password) {
        issues.push('Email provider but no password hash');
        result.usersWithoutPassword.push({ id: userId, email: email || 'N/A', provider });
      }

      if (issues.length > 0) {
        result.partialUsers.push({
          id: userId,
          email: email || 'N/A',
          issues
        });
      }
    }

    // Find duplicate emails (case-insensitive)
    for (const [normalizedEmail, entries] of emailMap.entries()) {
      if (entries.length > 1) {
        result.duplicateEmails.push({
          email: normalizedEmail,
          count: entries.length,
          userIds: entries.map(e => e.id)
        });
      }
    }

    // Find duplicate usernames (case-insensitive)
    for (const [normalizedUsername, entries] of usernameMap.entries()) {
      if (entries.length > 1) {
        result.duplicateUsernames.push({
          username: normalizedUsername,
          count: entries.length,
          userIds: entries.map(e => e.id)
        });
      }
    }

    // Check specific email if provided
    if (emailToCheck) {
      const normalizedCheckEmail = emailToCheck.toLowerCase().trim();
      const foundUsers = emailMap.get(normalizedCheckEmail);
      
      if (foundUsers && foundUsers.length > 0) {
        result.specificEmailCheck.exists = true;
        result.specificEmailCheck.userId = foundUsers[0].id;
        
        // Check if user has password
        const user = await User.findById(foundUsers[0].id).select('+password');
        if (user) {
          const userObj = user.toObject();
          result.specificEmailCheck.hasPassword = !!userObj.password;
          result.specificEmailCheck.username = userObj.profile?.username || userObj.username || undefined;
        }
      }
    }

    // Print results
    console.log('📊 AUDIT RESULTS');
    console.log('─'.repeat(100));

    if (result.partialUsers.length > 0) {
      console.log(`\n⚠️  PARTIAL USERS FOUND: ${result.partialUsers.length}`);
      result.partialUsers.forEach((user, idx) => {
        console.log(`  ${idx + 1}. User ID: ${user.id}`);
        console.log(`     Email: ${user.email}`);
        console.log(`     Issues: ${user.issues.join(', ')}`);
      });
    } else {
      console.log('\n✅ No partial users found');
    }

    if (result.duplicateEmails.length > 0) {
      console.log(`\n⚠️  DUPLICATE EMAILS FOUND: ${result.duplicateEmails.length}`);
      result.duplicateEmails.forEach((dup, idx) => {
        console.log(`  ${idx + 1}. Email: ${dup.email}`);
        console.log(`     Count: ${dup.count} users`);
        console.log(`     User IDs: ${dup.userIds.join(', ')}`);
      });
    } else {
      console.log('\n✅ No duplicate emails found');
    }

    if (result.duplicateUsernames.length > 0) {
      console.log(`\n⚠️  DUPLICATE USERNAMES FOUND: ${result.duplicateUsernames.length}`);
      result.duplicateUsernames.forEach((dup, idx) => {
        console.log(`  ${idx + 1}. Username: ${dup.username}`);
        console.log(`     Count: ${dup.count} users`);
        console.log(`     User IDs: ${dup.userIds.join(', ')}`);
      });
    } else {
      console.log('\n✅ No duplicate usernames found');
    }

    if (result.usersWithoutPassword.length > 0) {
      console.log(`\n⚠️  USERS WITHOUT PASSWORD (email provider): ${result.usersWithoutPassword.length}`);
      result.usersWithoutPassword.forEach((user, idx) => {
        console.log(`  ${idx + 1}. User ID: ${user.id}, Email: ${user.email}`);
      });
    } else {
      console.log('\n✅ All email-provider users have passwords');
    }

    if (result.usersWithoutUsername.length > 0) {
      console.log(`\n⚠️  USERS WITHOUT USERNAME: ${result.usersWithoutUsername.length}`);
      result.usersWithoutUsername.forEach((user, idx) => {
        console.log(`  ${idx + 1}. User ID: ${user.id}, Email: ${user.email}`);
      });
    } else {
      console.log('\n✅ All users have usernames');
    }

    if (emailToCheck) {
      console.log(`\n🔍 SPECIFIC EMAIL CHECK: ${emailToCheck}`);
      console.log(`   Exists: ${result.specificEmailCheck.exists ? '✅ YES' : '❌ NO'}`);
      if (result.specificEmailCheck.exists) {
        console.log(`   User ID: ${result.specificEmailCheck.userId}`);
        console.log(`   Has Password: ${result.specificEmailCheck.hasPassword ? '✅ YES' : '❌ NO'}`);
        console.log(`   Username: ${result.specificEmailCheck.username || 'N/A'}`);
      }
    }

    console.log('\n' + '═'.repeat(100));
    console.log(`\n✅ Audit complete. Total users: ${result.totalUsers}`);

    return result;
  } catch (error: any) {
    console.error('❌ Error auditing users:', error.message);
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
  const emailToCheck = process.argv[2] || 'ujval@phoenix.com';
  auditUsers(emailToCheck)
    .then(() => {
      console.log('\n✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error.message);
      process.exit(1);
    });
}

