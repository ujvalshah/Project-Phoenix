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
 * Update a user's email address
 * Usage: npx tsx server/src/utils/updateUserEmail.ts <oldEmail> <newEmail>
 */
export async function updateUserEmail(oldEmail: string, newEmail: string): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const normalizedOldEmail = oldEmail.toLowerCase();
    const normalizedNewEmail = newEmail.toLowerCase();

    // Find user by old email
    const user = await User.findOne({ 'auth.email': normalizedOldEmail });
    
    if (!user) {
      throw new Error(`User with email ${oldEmail} not found`);
    }

    // Check if new email is already taken
    const existingUser = await User.findOne({ 'auth.email': normalizedNewEmail });
    if (existingUser) {
      throw new Error(`Email ${newEmail} is already registered to another user`);
    }

    // Update email
    user.auth.email = normalizedNewEmail;
    user.auth.updatedAt = new Date().toISOString();
    await user.save();

    console.log(`✓ Successfully updated email from ${oldEmail} to ${newEmail}`);
  } catch (error: any) {
    console.error('Error updating email:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection if we opened it
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Allow running directly from command line
const oldEmail = process.argv[2];
const newEmail = process.argv[3];

if (oldEmail && newEmail) {
  updateUserEmail(oldEmail, newEmail)
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
} else {
  console.error('Usage: npx tsx server/src/utils/updateUserEmail.ts <oldEmail> <newEmail>');
  console.error('Example: npx tsx server/src/utils/updateUserEmail.ts old@example.com new@example.com');
  process.exit(1);
}











