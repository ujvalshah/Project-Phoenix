/**
 * Central configuration for nugget create-modal performance (all `VITE_*` reads in one place).
 * Import from here in app code; use `isFeatureEnabled('NUGGET_MODAL_*')` in featureFlags for
 * the same values when a flag key is required.
 */
function readBooleanEnv(
  v: string | undefined,
  /** When the env var is missing/empty, default is “enabled” (true) unless noted. */
  defaultTrue: boolean,
): boolean {
  if (v === undefined || v === '') return defaultTrue;
  return v !== 'false';
}

function readPreloadRolloutPercent(): number {
  const raw = import.meta.env.VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT;
  if (raw === undefined || raw === '') return 100;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(0, n));
}

function readCtpBudgetWarnMs(): number {
  const raw = import.meta.env.VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS;
  if (raw === undefined || raw === '') return 0;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * `VITE_NUGGET_COMPOSER_V2`: ContentDraft-first hydration + deferred image sync (Phase 3 composer path).
 *
 * - **unset / empty:** `0` — legacy hydration only (safe default); opt in explicitly for v2.
 * - **`false` / `0`:** `0` — legacy for everyone.
 * - **`true` / `1` / `100`:** full v2 (`100`).
 * - **`0.1`:** ~10% of users (cohort); **`10`:** 10%; **`0.01`:** 1% (integer **`1`** means full on, not 1%).
 */
function readComposerV2RolloutPercent(): number {
  const raw = import.meta.env.VITE_NUGGET_COMPOSER_V2;
  if (raw === undefined || raw === '') return 0;
  const s = String(raw).trim().toLowerCase();
  if (s === 'false' || s === '0') return 0;
  if (s === 'true') return 100;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return 100;
  if (n <= 0) return 0;
  if (n >= 100) return 100;
  if (n === 1) return 100;
  if (n < 1) {
    const pct = Math.round(n * 100);
    return Math.min(100, Math.max(1, pct));
  }
  return Math.min(100, Math.floor(n));
}

/**
 * Nugget create-modal performance knobs. One env per behavior for rollback.
 *
 * | Behavior | Disable |
 * |----------|---------|
 * | Intent preload (hover / pointer) | `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD=false` |
 * | Canary % (preload only) | `VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT=0` |
 * | Async ContentEditor chunk | `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY=false` |
 * | CTP console warning | omit or `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS=0` |
 * | Composer v2 (ContentDraft-first path) | omit env or `VITE_NUGGET_COMPOSER_V2=0` |
 */
export const NUGGET_PERFORMANCE = {
  /** Rollout: `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD` — set `false` to disable all intent preload. */
  chunkPreload: readBooleanEnv(import.meta.env.VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD, true),
  /**
   * Editor code-split: `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY` — set `false` to inline editor in
   * the CreateNuggetModal chunk (larger one-shot load; no separate ContentEditor async chunk).
   */
  editorLazySplit: readBooleanEnv(import.meta.env.VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY, true),
  /** Canary: `VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT` 0–100; does not turn off the lazy editor split. */
  preloadRolloutPercent: readPreloadRolloutPercent(),
  /** Observability: `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS` */
  ctpBudgetWarnMs: readCtpBudgetWarnMs(),
  /**
   * Canary: `VITE_NUGGET_COMPOSER_V2` — 0 (legacy only), 1–99 (partial cohort), 100 (all v2).
   * Per-user: `shouldEnableNuggetComposerV2ForUser` in `@/utils/performanceRollout`.
   */
  composerV2RolloutPercent: readComposerV2RolloutPercent(),
} as const;

export function isNuggetEditorLazySplitEnabled(): boolean {
  return NUGGET_PERFORMANCE.editorLazySplit;
}
