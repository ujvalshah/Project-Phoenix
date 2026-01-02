/**
 * Environment loader - Must be imported FIRST before any other modules
 * This ensures environment variables are available when other modules initialize
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
const rootPath = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(rootPath, '.env') });

console.log('[Env] Environment variables loaded from .env');







