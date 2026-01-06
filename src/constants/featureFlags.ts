/**
 * Feature Flags Configuration
 *
 * Feature flags enable safe rollout of new functionality with the ability
 * to quickly disable features if issues are detected in production.
 *
 * Usage:
 * ```typescript
 * import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/featureFlags';
 *
 * if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
 *   // Enable verbose logging
 * }
 * ```
 *
 * Note: USE_IMAGE_MANAGER feature flag was removed in Phase 9.
 * The useImageManager hook is now always used (legacy code removed).
 */

export const FEATURE_FLAGS = {
  /**
   * LOG_IMAGE_OPERATIONS: Enable verbose logging for image operations
   *
   * When enabled:
   * - Logs all image additions, deletions, and state changes
   * - Logs duplicate detection with source information
   * - Useful for debugging image handling issues
   *
   * When disabled:
   * - Silent operation (production mode)
   */
  LOG_IMAGE_OPERATIONS: process.env.NODE_ENV === 'development',
} as const;

/**
 * Type-safe feature flag keys
 */
export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature flag is enabled
 *
 * @param flag - The feature flag key to check
 * @returns true if the feature is enabled, false otherwise
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag] === true;
}

/**
 * Get all enabled feature flags (for debugging)
 */
export function getEnabledFeatures(): FeatureFlagKey[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).filter(
    (key) => FEATURE_FLAGS[key] === true
  );
}
