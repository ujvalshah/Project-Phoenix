import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { connectDB } from './db.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../../../');
dotenv.config({ path: path.join(rootPath, '.env') });

/**
 * Create a user as admin, or promote existing user to admin
 * Usage: 
 *   - Run: npx tsx server/src/utils/createOrPromoteAdmin.ts <email> [displayName] [username]
 *   - Or import and call: createOrPromoteAdmin('user@example.com', 'Display Name', 'username')
 */
export async function createOrPromoteAdmin(
  email: string, 
  displayName?: string, 
  username?: string
): Promise<void> {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ 'auth.email': normalizedEmail });
    
    if (user) {
      // User exists - promote to admin
      if (user.role === 'admin') {
        console.log(`✓ User ${email} is already an admin`);
        return;
      }

      user.role = 'admin';
      await user.save();
      console.log(`✓ Successfully promoted ${email} to admin role`);
    } else {
      // User doesn't exist - create as admin
      const now = new Date().toISOString();
      const defaultDisplayName = displayName || email.split('@')[0];
      const defaultUsername = (username || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase().trim();

      // Check if username is taken (case-insensitive)
      const existingUsername = await User.findOne({ 'profile.username': defaultUsername });
      if (existingUsername) {
        throw new Error(`Username "${defaultUsername}" is already taken. Please provide a different username.`);
      }

      // Generate a temporary password hash (user should change this on first login)
      // Using a simple default password that can be shared: "TempPass123!"
      const tempPassword = await bcrypt.hash('TempPass123!', 10);

      // Create user as admin with temporary password
      const newUser = new User({
        role: 'admin',
        password: tempPassword,
        auth: {
          email: normalizedEmail,
          emailVerified: true, // Admin accounts are pre-verified
          provider: 'email',
          createdAt: now,
          updatedAt: now
        },
        profile: {
          displayName: defaultDisplayName,
          username: defaultUsername,
          avatarColor: 'blue'
        },
        security: {
          mfaEnabled: false
        },
        preferences: {
          theme: 'system',
          defaultVisibility: 'public',
          interestedCategories: [],
          compactMode: false,
          richMediaPreviews: true,
          autoFollowCollections: true,
          notifications: {
            emailDigest: true,
            productUpdates: true,
            newFollowers: true
          }
        },
        appState: {
          onboardingCompleted: true
        }
      });

      await newUser.save();
      console.log(`✓ Successfully created ${email} as admin user`);
      console.log(`  Display Name: ${defaultDisplayName}`);
      console.log(`  Username: ${defaultUsername}`);
      console.log(`  Temporary Password: TempPass123!`);
      console.log(`  ⚠️  IMPORTANT: Please change this password after first login!`);
    }
  } catch (error: any) {
    console.error('Error creating/promoting admin:', error.message);
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
const displayName = process.argv[3];
const username = process.argv[4];

if (email) {
  createOrPromoteAdmin(email, displayName, username)
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
} else if (process.argv[1]?.includes('createOrPromoteAdmin')) {
  // Only show usage if script was run directly (not imported)
  console.error('Usage: npx tsx server/src/utils/createOrPromoteAdmin.ts <email> [displayName] [username]');
  console.error('Example: npx tsx server/src/utils/createOrPromoteAdmin.ts user@example.com "John Doe" johndoe');
  process.exit(1);
}
