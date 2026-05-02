/**
 * Feature Flags Configuration
 *
 * Feature flags enable safe rollout of new functionality with the ability
 * to quickly disable features if issues are detected in production.
 *
 * Usage:
 * ```typescript
 * import { isFeatureEnabled } from '@/constants/featureFlags';
 *
 * if (isFeatureEnabled('HOME_FEED_VIRTUALIZATION')) {
 *   // ArticleGrid.tsx: single-column window virtualization only (see flag JSDoc).
 * }
 * ```
 * Verbose client logging for image workflows uses `import.meta.env.DEV` in `useImageManager`, not a flag.
 * NUGGET_MODAL_* and composer v2 rollout (`VITE_NUGGET_COMPOSER_V2`) come from @/config/nuggetPerformanceConfig (single env map).
 *
 * Note: USE_IMAGE_MANAGER feature flag was removed in Phase 9.
 * The useImageManager hook is now always used (legacy code removed).
 */

import { NUGGET_PERFORMANCE } from '@/config/nuggetPerformanceConfig';

export const FEATURE_FLAGS = {
  /**
   * MARKET_PULSE: Enable Market Pulse content stream
   *
   * When enabled:
   * - Stream toggle (Standard / Market Pulse) appears in the header
   * - Content stream selector appears in the nugget editor
   * - Articles can be routed to standard feed, Market Pulse, or both
   * - Deep links (`?stream=pulse`) activate the Pulse feed client-side
   *
   * When disabled:
   * - No Pulse tab in chrome; editor defaults stream targets to standard only
   * - Home filter state clamps to the standard feed and strips `stream=pulse` once URL sync runs
   * - Backend/admin may still expose Pulse data until separately retired
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
   * HOME_FEED_VIRTUALIZATION (VITE_HOME_FEED_VIRTUALIZATION):
   *
   * **ArticleGrid-only:** Enables `HomeGridVirtualized` in `ArticleGrid.tsx` when
   * `viewMode === 'grid'` and `gridColumnCount === 1`. Multi-column `ArticleGrid` stays
   * on the legacy full grid; masonry is unchanged.
   *
   * **Does not apply to Home:** `/` renders `HomeArticleFeed`, which **always** virtualizes the
   * grid via `HomeGridVirtualized`; this flag is not read there.
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

export { shouldEnableNuggetComposerV2ForUser } from '@/utils/performanceRollout';
