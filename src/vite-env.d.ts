/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADAPTER_TYPE?: 'local' | 'rest';
  readonly VITE_API_URL?: string; // Optional: API base URL (only for production)
  readonly VITE_NUGGET_EDITOR_V2?: string; // Feature flag for enhanced nugget editor
  // Add other VITE_ prefixed env vars here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}















