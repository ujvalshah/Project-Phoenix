/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADAPTER_TYPE?: 'local' | 'rest';
  readonly VITE_API_URL?: string; // Optional: API base URL (only for production)
  readonly VITE_NUGGET_EDITOR_V2?: string; // Feature flag for enhanced nugget editor
  readonly VITE_FEATURE_MARKET_PULSE?: string; // Feature flag for Market Pulse content stream
  /** When not "false", preloads the CreateNuggetModal chunk on intent (default on). */
  readonly VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD?: string;
  /** When "false", inlines the content editor in the modal chunk (disables async editor split). */
  readonly VITE_FEATURE_NUGGET_MODAL_EDITOR_LAZY?: string;
  /** 0–100: cohort percentage for modal chunk preload (default 100). */
  readonly VITE_NUGGET_MODAL_PRELOAD_ROLLOUT_PCT?: string;
  /** When >0, log a console warning if modal open → ~paint exceeds this many ms. */
  readonly VITE_NUGGET_MODAL_CTP_BUDGET_WARN_MS?: string;
  // Add other VITE_ prefixed env vars here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}















