/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADAPTER_TYPE?: 'local' | 'rest';
  readonly VITE_API_URL?: string; // Optional: API base URL (only for production)
  // Add other VITE_ prefixed env vars here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}












