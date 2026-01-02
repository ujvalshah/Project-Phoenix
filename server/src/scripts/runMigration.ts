/**
 * Script to run the canonicalName migration
 * 
 * Usage: tsx server/src/scripts/runMigration.ts
 * or: npm run migrate-canonical-names
 */

import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';
import { initLogger } from '../utils/logger.js';
import { connectDB } from '../utils/db.js';
import { migrateCanonicalNames } from '../utils/migrateCanonicalNames.js';

async function main() {
  try {
    // Validate environment first
    validateEnv();
    
    // Initialize logger (required by connectDB)
    initLogger();
    
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected.');
    
    console.log('Running migration...');
    await migrateCanonicalNames();
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();

