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

  /** Comma-separated extra browser origins allowed by CORS (e.g. preview deploy URL). FRONTEND_URL is always included when set. */
  CORS_ALLOWED_ORIGINS: z.string().optional().refine((val) => {
    if (!val) return true;
    return val.split(',').every((s) => {
      const trimmed = s.trim();
      return trimmed === '' || /^https?:\/\//.test(trimmed);
    });
  }, { message: 'Each CORS_ALLOWED_ORIGINS entry must start with http:// or https://' }),
  
  // Support MONGODB_URI as alias (for compatibility)
  MONGODB_URI: z.string().optional(),
  
  // Sentry error tracking (optional)
  SENTRY_DSN: z.string().url('SENTRY_DSN must be a valid URL').optional(),
  SENTRY_ENABLE_DEV: z.string().transform((val) => val === 'true').optional().default('false'),
  
  // Cloudinary configuration (required for media uploads)
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required').optional(),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required').optional(),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required').optional(),

  // Email (Resend) – optional; when set, verification and password-reset emails are sent
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  ENABLE_EMAIL_VERIFICATION: z.string().transform((val) => val === 'true').optional().default('false'),

  // Redis configuration (optional)
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').optional(),
  USE_LOCAL_REDIS: z.string().transform((val) => val === 'true').optional(),
  REDIS_LOCAL_URL: z.string().url('REDIS_LOCAL_URL must be a valid URL').optional(),

  // When true, token revocation checks fail CLOSED if Redis is unavailable —
  // blacklisted tokens cannot be bypassed during a Redis outage at the cost
  // of denying all authenticated traffic until Redis recovers. Defaults to
  // false (fail-open) so dev and single-node deploys stay available.
  STRICT_TOKEN_REVOCATION: z.string().transform((val) => val === 'true').optional().default('false'),

  // When true, a JWT is rejected (401 SESSION_REVOKED) if its embedded
  // `tokenVersion` does not match the user's current `tokenVersion` in the
  // database. Bumping `tokenVersion` (on role/email/password change, on
  // suspend/ban/delete, or on explicit admin revoke-sessions) immediately
  // invalidates every live access token for that user.
  //
  // Production default is enforced in validateEnv(): true when NODE_ENV is
  // production and ENFORCE_TOKEN_VERSION is unset. Non-production defaults to
  // observe-only (false) so local/dev rollout remains safer.
  ENFORCE_TOKEN_VERSION: z.string().transform((val) => val === 'true').optional(),

  // Web Push / VAPID (optional – notifications disabled if not set)
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
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
    if (result.data.ENABLE_EMAIL_VERIFICATION) {
      if (!result.data.RESEND_API_KEY?.trim()) {
        console.error('\n❌ PRODUCTION CONFIGURATION ERROR\n');
        console.error('RESEND_API_KEY is required in production when ENABLE_EMAIL_VERIFICATION=true.\n');
        process.exit(1);
      }
      if (!result.data.EMAIL_FROM?.trim()) {
        console.error('\n❌ PRODUCTION CONFIGURATION ERROR\n');
        console.error('EMAIL_FROM is required in production when ENABLE_EMAIL_VERIFICATION=true.\n');
        process.exit(1);
      }
    }
  }

  // Redis configuration validation and warnings
  if (process.env.USE_LOCAL_REDIS === 'true' && process.env.REDIS_URL) {
    console.warn('\n⚠️  REDIS CONFIGURATION WARNING\n');
    console.warn('USE_LOCAL_REDIS=true is set, but REDIS_URL is also configured.\n');
    console.warn('Local Redis will be used (REDIS_URL will be ignored).\n');
    console.warn('To use cloud Redis, set USE_LOCAL_REDIS=false or remove it.\n');
  }

  // Security default: enforce token-version revocation in production unless
  // explicitly overridden.
  const enforceTokenVersion =
    result.data.ENFORCE_TOKEN_VERSION ??
    (result.data.NODE_ENV === 'production');

  validatedEnv = {
    ...result.data,
    ENFORCE_TOKEN_VERSION: enforceTokenVersion,
  };
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

/**
 * Test-only helper to force re-validation after mutating process.env.
 */
export function resetValidatedEnvForTests(): void {
  if (process.env.NODE_ENV === 'test') {
    validatedEnv = null;
  }
}

/**
 * Canonical public frontend origins always merged into the CORS allowlist.
 * `server/src/index.ts` expands apex ↔ www for each entry via `withWwwVariant`.
 */
const BUILTIN_CORS_BROWSER_ORIGINS: readonly string[] = ['https://nuggets.one'];

/**
 * Build CORS allowlist: BUILTIN_CORS_BROWSER_ORIGINS, comma-separated CORS_ALLOWED_ORIGINS,
 * and FRONTEND_URL (deduped).
 */
export function getCorsAllowedOrigins(): string[] {
  const env = getEnv();
  const fromList = (env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter((s) => s.length > 0);
  const set = new Set<string>(fromList);
  for (const origin of BUILTIN_CORS_BROWSER_ORIGINS) {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      set.add(normalized);
    }
  }
  if (env.FRONTEND_URL) {
    set.add(normalizeOrigin(env.FRONTEND_URL));
  }
  return Array.from(set);
}

/**
 * Normalize an origin-like URL value to protocol+host+port only.
 * Example: "https://www.nuggetnews.app/" -> "https://www.nuggetnews.app"
 */
export function normalizeOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

