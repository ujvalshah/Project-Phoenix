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
 * Inspect a specific user by ID or email
 */
async function inspectUser(identifier: string): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    let user;
    if (identifier.includes('@')) {
      // Search by email
      user = await User.findOne({ 'auth.email': identifier.toLowerCase() });
    } else {
      // Search by ID
      user = await User.findById(identifier);
    }
    
    if (!user) {
      console.error(`User not found: ${identifier}`);
      process.exit(1);
    }

    const userObj = user.toObject();
    console.log('\n' + '='.repeat(100));
    console.log('USER DETAILS (Raw Data Structure)');
    console.log('='.repeat(100));
    console.log(JSON.stringify(userObj, null, 2));
    console.log('='.repeat(100) + '\n');
    
  } catch (error: any) {
    console.error('Error inspecting user:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection if we opened it
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Allow running directly from command line
const identifier = process.argv[2];

if (identifier) {
  inspectUser(identifier)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
} else {
  console.error('Usage: npx tsx server/src/utils/inspectUser.ts <email-or-id>');
  console.error('Example: npx tsx server/src/utils/inspectUser.ts shahujval1@gmail.com');
  process.exit(1);
}











