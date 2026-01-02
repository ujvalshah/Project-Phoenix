
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';

  // In production, API calls should go directly to the backend URL (no proxy)
  // In development, proxy to localhost backend
  const apiTarget = isProduction 
    ? env.VITE_API_URL || env.BACKEND_URL || '' // Production: use env var or empty (no proxy)
    : 'http://localhost:5000'; // Development: localhost backend

  return {
    // Explicit base for BrowserRouter SEO (default is '/' but being explicit)
    base: '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: isProduction ? undefined : {
        // Proxy all /api/* requests to backend server (development only)
        // This includes admin moderation routes: /api/moderation/reports, /api/admin/stats
        // Production builds should use VITE_API_URL environment variable for API calls
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    define: {
      // SECURITY UPDATE: Removed API_KEY injection. 
      // The frontend should NOT have access to secrets.
      'process.env.REACT_APP_VERSION': JSON.stringify(process.env.npm_package_version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  };
});
