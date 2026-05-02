/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string; // Optional: API base URL (only for production)
  readonly VITE_FEATURE_MARKET_PULSE?: string; // Feature flag for Market Pulse content stream
  /** When not "false", preloads the CreateNuggetModal chunk on intent (default on). */
  readonly VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD?: string;
  /** When "false", inlines the content editor in the modal chunk (disables async editor split). */
  readonly VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY?: string;
  /** 0–100: cohort percentage for modal chunk preload (default 100). */
  readonly VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT?: string;
  /** When >0, log a console warning if modal open → ~paint exceeds this many ms. */
  readonly VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENABLE_DEV?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  readonly VITE_RELEASE?: string;
  /** 0–1: Session Replay sampling in production (default 0). Opt in e.g. `0.1`. */
  readonly VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE?: string;
  /** 0–1: Replay when an error fires (default 1). Set lower to reduce payloads. */
  readonly VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}















