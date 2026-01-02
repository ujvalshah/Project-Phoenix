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
 * Check for a specific email in the database
 */
async function checkUserByEmail(email: string): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`\n🔍 CHECKING FOR EMAIL: ${normalizedEmail}`);
    console.log('═'.repeat(100));

    // Find ALL users with this email (case-insensitive)
    const users = await User.find({
      'auth.email': { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).select('-password');

    console.log(`\nFound ${users.length} user(s) with email "${normalizedEmail}":\n`);

    if (users.length === 0) {
      console.log('✅ No users found with this email.');
      console.log('   This email should be available for signup.');
    } else {
      users.forEach((user, index) => {
        const userObj = user.toObject();
        console.log(`${index + 1}. User ID: ${userObj._id}`);
        console.log(`   Email: ${userObj.auth?.email || 'N/A'}`);
        console.log(`   Username: ${userObj.profile?.username || 'N/A'}`);
        console.log(`   Name: ${userObj.profile?.displayName || 'N/A'}`);
        console.log(`   Role: ${userObj.role || 'user'}`);
        console.log(`   Created: ${userObj.auth?.createdAt || userObj.createdAt || 'N/A'}`);
        if (index < users.length - 1) {
          console.log('');
        }
      });
    }

    // Also check exact match (case-sensitive)
    const exactMatch = await User.findOne({ 'auth.email': normalizedEmail }).select('-password');
    if (exactMatch && users.length > 0 && exactMatch._id.toString() !== users[0]._id.toString()) {
      console.log('\n⚠️  Note: Found case-insensitive match but exact match differs');
    }

    // List ALL users in database
    console.log('\n\n📊 ALL USERS IN DATABASE:');
    console.log('─'.repeat(100));
    const allUsers = await User.find().select('-password').sort({ 'auth.createdAt': -1 });
    console.log(`Total: ${allUsers.length} user(s)\n`);
    
    allUsers.forEach((user, index) => {
      const userObj = user.toObject();
      console.log(`${index + 1}. ${userObj.auth?.email || 'N/A'} (${userObj.profile?.username || 'N/A'})`);
    });

  } catch (error: any) {
    console.error('❌ Error checking user:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection if we opened it
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Allow running directly from command line
const email = process.argv[2];
if (email) {
  checkUserByEmail(email)
    .then(() => {
      console.log('\n✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error.message);
      process.exit(1);
    });
} else {
  console.error('Usage: npx tsx server/src/utils/checkUserByEmail.ts <email>');
  process.exit(1);
}











