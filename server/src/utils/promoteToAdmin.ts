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
 * Promote a user to admin role by email
 * Usage: 
 *   - Run: npm run promote-admin <email>
 *   - Or: npx tsx server/src/utils/promoteToAdmin.ts <email>
 *   - Or import and call: promoteUserToAdmin('user@example.com')
 */
export async function promoteUserToAdmin(email: string): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const user = await User.findOne({ 'auth.email': email.toLowerCase() });
    
    if (!user) {
      throw new Error(`User with email ${email} not found`);
    }

    if (user.role === 'admin') {
      console.log(`User ${email} is already an admin`);
      return;
    }

    user.role = 'admin';
    await user.save();

    console.log(`✓ Successfully promoted ${email} to admin role`);
  } catch (error: any) {
    console.error('Error promoting user to admin:', error.message);
    throw error;
  } finally {
    // Close MongoDB connection if we opened it
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Allow running directly from command line
// Check if email argument is provided (simple way to detect direct execution)
const email = process.argv[2];

if (email) {
  promoteUserToAdmin(email)
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
} else if (process.argv[1]?.includes('promoteToAdmin')) {
  // Only show usage if script was run directly (not imported)
  console.error('Usage: npm run promote-admin <email>');
  console.error('   Or: npx tsx server/src/utils/promoteToAdmin.ts <email>');
  console.error('Example: npm run promote-admin user@example.com');
  process.exit(1);
}











