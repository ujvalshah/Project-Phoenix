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
 * Nugget create-modal performance knobs. One env per behavior for rollback.
 *
 * | Behavior | Disable |
 * |----------|---------|
 * | Intent preload (hover / pointer) | `VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD=false` |
 * | Canary % (preload only) | `VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT=0` |
 * | Async ContentEditor chunk | `VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY=false` |
 * | CTP console warning | omit or `VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS=0` |
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
} as const;

export function isNuggetEditorLazySplitEnabled(): boolean {
  return NUGGET_PERFORMANCE.editorLazySplit;
}
