import { z } from 'zod';

/**
 * Environment variable validation schema
 * Validates all required and optional environment variables at startup
 * Fails fast if critical variables are missing or invalid
 */
const envSchema = z.object({
  // Required variables
  MONGO_URI: z.string().min(1, 'MONGO_URI is required and cannot be empty'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long for security'),
  NODE_ENV: z.enum(['development', 'production', 'test'], {
    errorMap: () => ({ message: 'NODE_ENV must be one of: development, production, test' })
  }),
  
  // Optional variables with defaults
  PORT: z.string().optional().default('5000').refine((val) => {
    // Audit Phase-3 Fix: Validate PORT is numeric and in valid range 1-65535, preserve defaults
    const portNum = parseInt(val, 10);
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
  }, {
    message: 'PORT must be a number between 1 and 65535'
  }),
  
  // Optional variables with validation
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').optional(),
  
  // Support MONGODB_URI as alias (for compatibility)
  MONGODB_URI: z.string().optional(),
  
  // Sentry error tracking (optional)
  SENTRY_DSN: z.string().url('SENTRY_DSN must be a valid URL').optional(),
  SENTRY_ENABLE_DEV: z.string().transform((val) => val === 'true').optional().default('false'),
  
  // Cloudinary configuration (required for media uploads)
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required').optional(),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required').optional(),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required').optional(),
});

/**
 * Validated environment variables
 * Access this instead of process.env directly
 */
export type ValidatedEnv = z.infer<typeof envSchema>;

let validatedEnv: ValidatedEnv | null = null;

/**
 * Validate environment variables and fail fast if invalid
 * Must be called at server startup before any routes or DB connections
 */
export function validateEnv(): ValidatedEnv {
  // Merge MONGO_URI and MONGODB_URI (support both for compatibility)
  const env = { ...process.env };
  if (env.MONGODB_URI && !env.MONGO_URI) {
    env.MONGO_URI = env.MONGODB_URI;
  }

  const result = envSchema.safeParse(env);

  if (!result.success) {
    // Format errors for human readability
    const errors = result.error.errors.map(err => {
      const path = err.path.join('.');
      return `  • ${path}: ${err.message}`;
    });

    console.error('\n❌ ENVIRONMENT VALIDATION FAILED\n');
    console.error('Missing or invalid environment variables:\n');
    console.error(errors.join('\n'));
    console.error('\nPlease check your .env file and ensure all required variables are set.\n');
    console.error('See .env.example for required configuration.\n');
    
    process.exit(1);
  }

  // Additional production-specific validation
  if (result.data.NODE_ENV === 'production') {
    if (!result.data.FRONTEND_URL) {
      console.error('\n❌ PRODUCTION CONFIGURATION ERROR\n');
      console.error('FRONTEND_URL is required in production mode.\n');
      console.error('Please set FRONTEND_URL in your .env file.\n');
      process.exit(1);
    }
  }

  validatedEnv = result.data;
  return validatedEnv;
}

/**
 * Get validated environment variable
 * Throws if validateEnv() hasn't been called yet
 */
export function getEnv(): ValidatedEnv {
  if (!validatedEnv) {
    throw new Error('Environment validation not yet executed. Call validateEnv() first.');
  }
  return validatedEnv;
}

