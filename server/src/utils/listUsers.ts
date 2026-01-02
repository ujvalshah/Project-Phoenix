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
 * List all users in the database
 */
export async function listAllUsers(): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    if (users.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    console.log(`\nFound ${users.length} user(s) in the database:\n`);
    console.log('─'.repeat(100));
    
    users.forEach((user, index) => {
      const userObj = user.toObject();
      
      // Handle both new modular schema and legacy schema
      const email = userObj.auth?.email || userObj.email || 'N/A';
      const name = userObj.profile?.displayName || userObj.name || 'N/A';
      const username = userObj.profile?.username || userObj.username || 'N/A';
      const role = userObj.role || 'user';
      const emailVerified = userObj.auth?.emailVerified !== undefined 
        ? (userObj.auth.emailVerified ? '✓' : '✗')
        : (userObj.emailVerified ? '✓' : '✗');
      const createdAt = userObj.auth?.createdAt || userObj.joinedAt || userObj.createdAt || 'N/A';
      const lastLogin = userObj.appState?.lastLoginAt || userObj.lastLoginAt || 'Never';
      const schemaType = userObj.auth ? 'Modular' : 'Legacy';
      
      console.log(`\n${index + 1}. User ID: ${userObj._id}`);
      console.log(`   Schema: ${schemaType}`);
      console.log(`   Email: ${email}`);
      console.log(`   Name: ${name}`);
      console.log(`   Username: ${username}`);
      console.log(`   Role: ${role} ${role === 'admin' ? '👑' : ''}`);
      console.log(`   Email Verified: ${emailVerified}`);
      console.log(`   Created: ${createdAt}`);
      console.log(`   Last Login: ${lastLogin}`);
      if (index < users.length - 1) {
        console.log('─'.repeat(100));
      }
    });
    
    console.log('\n' + '─'.repeat(100));
    console.log(`\nTotal: ${users.length} user(s)`);
    
    const adminCount = users.filter(u => u.role === 'admin').length;
    const userCount = users.filter(u => u.role === 'user').length;
    console.log(`  - Admins: ${adminCount}`);
    console.log(`  - Regular Users: ${userCount}`);
    
  } catch (error: any) {
    console.error('Error listing users:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection if we opened it
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Allow running directly from command line
if (process.argv[1]?.includes('listUsers')) {
  listAllUsers()
    .then(() => {
      console.log('\nDone');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}











