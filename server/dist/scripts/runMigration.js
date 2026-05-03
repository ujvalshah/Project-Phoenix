/**
 * Script to run the canonicalName migration
 *
 * Usage: tsx server/src/scripts/runMigration.ts
 * or: npm run migrate-canonical-names
 */
import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';
import { initLogger, getLogger } from '../utils/logger.js';
import { connectDB } from '../utils/db.js';
import { migrateCanonicalNames } from '../utils/migrateCanonicalNames.js';
async function main() {
    try {
        // Validate environment first
        validateEnv();
        // Initialize logger (required by connectDB)
        initLogger();
        const logger = getLogger().child({ script: 'runMigration' });
        logger.info({ phase: 'connect_db' }, 'Connecting to database');
        await connectDB();
        logger.info({ phase: 'connect_db' }, 'Database connected');
        logger.info({ phase: 'migrate' }, 'Running canonicalName migration');
        await migrateCanonicalNames();
        logger.info({ phase: 'complete' }, 'Migration completed successfully');
        process.exit(0);
    }
    catch (error) {
        try {
            getLogger().error({ err: error, script: 'runMigration' }, 'Migration failed');
        }
        catch {
            // Bootstrap-level fallback before logger availability.
            console.error('Migration failed:', error);
        }
        process.exit(1);
    }
}
main();
//# sourceMappingURL=runMigration.js.map