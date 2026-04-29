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
 * NUGGET_MODAL_* performance values come from @/config/nuggetPerformanceConfig (single env map).
 *
 * Note: USE_IMAGE_MANAGER feature flag was removed in Phase 9.
 * The useImageManager hook is now always used (legacy code removed).
 */

import { NUGGET_PERFORMANCE } from '@/config/nuggetPerformanceConfig';

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

  /**
   * NUGGET_EDITOR_V2: Enable enhanced nugget editor features
   *
   * When enabled:
   * - URL detection aggregates from all sources (primaryMedia, supportingMedia, images)
   * - Thumbnail selection is fully functional (click to change, clear button)
   * - Carousel ordering via drag-and-drop (desktop) or arrows (mobile)
   * - Pre-save validation with warnings and error blocking
   * - UI field reordering and updated labels
   *
   * When disabled:
   * - Original editor behavior
   *
   * Toggle via VITE_NUGGET_EDITOR_V2 environment variable
   */
  NUGGET_EDITOR_V2: import.meta.env.VITE_NUGGET_EDITOR_V2 === 'true',

  /**
   * MARKET_PULSE: Enable Market Pulse content stream
   *
   * When enabled:
   * - Stream toggle (Standard / Market Pulse) appears in the header
   * - Content stream selector appears in the nugget editor
   * - Articles can be routed to standard feed, Market Pulse, or both
   *
   * When disabled:
   * - No stream toggle visible — all content shows in the standard feed
   * - Content stream field hidden in editor (defaults to 'standard')
   *
   * Toggle via VITE_FEATURE_MARKET_PULSE environment variable
   */
  MARKET_PULSE: import.meta.env.VITE_FEATURE_MARKET_PULSE === 'true',

  /**
   * DUPLICATE_NUGGET_TITLE_SUFFIX: Auto-append "(Copy)" to duplicated nugget titles.
   *
   * Enabled by default for safer duplicate UX so copied content is clearly distinguishable.
   * Set VITE_FEATURE_DUPLICATE_NUGGET_TITLE_SUFFIX=false to disable.
   */
  DUPLICATE_NUGGET_TITLE_SUFFIX:
    import.meta.env.VITE_FEATURE_DUPLICATE_NUGGET_TITLE_SUFFIX !== 'false',

  /**
   * NUGGET_MODAL_CHUNK_PRELOAD: Preload the CreateNuggetModal entry chunk (and, when editor
   * is lazy, the ContentEditor sub-chunk) on hover / pointerdown before the user opens create.
   * @see NUGGET_PERFORMANCE in @/config/nuggetPerformanceConfig
   */
  NUGGET_MODAL_CHUNK_PRELOAD: NUGGET_PERFORMANCE.chunkPreload,

  /**
   * NUGGET_MODAL_EDITOR_LAZY: When true, ContentEditor loads in a separate async chunk.
   * @see NUGGET_PERFORMANCE in @/config/nuggetPerformanceConfig
   */
  NUGGET_MODAL_EDITOR_LAZY: NUGGET_PERFORMANCE.editorLazySplit,

  /**
   * HOME_FEED_VIRTUALIZATION: Window-virtualized homepage grid (Phase A).
   *
   * When enabled (VITE_HOME_FEED_VIRTUALIZATION=true):
   * - Grid view uses `useWindowVirtualizer` + row banding only in single-column mode.
   * - Multi-column desktop grid remains on the legacy non-virtualized renderer for layout fidelity.
   * - Masonry view is unchanged (still non-virtualized).
   *
   * Roll out after profiling; default off.
   */
  HOME_FEED_VIRTUALIZATION: import.meta.env.VITE_HOME_FEED_VIRTUALIZATION === 'true',
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
