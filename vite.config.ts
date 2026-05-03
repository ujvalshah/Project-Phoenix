
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';
  const analyzeBundle = process.env.ANALYZE === '1';

  // In production, API calls should go directly to the backend URL (no proxy)
  // In development, proxy to localhost backend
  const apiTarget = isProduction 
    ? env.VITE_API_URL || env.BACKEND_URL || '' // Production: use env var or empty (no proxy)
    : 'http://localhost:5000'; // Development: localhost backend

  return {
    // Explicit base for BrowserRouter SEO (default is '/' but being explicit)
    base: '/',
    server: {
      // Keep default local dev ergonomics: prefer 3000, auto-fallback if busy.
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
    plugins: [
      react(),
      ...(analyzeBundle
        ? [
            visualizer({
              filename: path.resolve(__dirname, 'dist', 'stats.html'),
              gzipSize: true,
              brotliSize: true,
              open: false,
              title: 'Nuggets — bundle',
            }),
          ]
        : []),
    ],
    define: {
      // SECURITY UPDATE: Removed API_KEY injection. 
      // The frontend should NOT have access to secrets.
      'process.env.REACT_APP_VERSION': JSON.stringify(process.env.npm_package_version),
      /** Strips dev-only dynamic imports (e.g. INP instrumentation) from production bundles. */
      __NUGGETS_DEV_PERF_VITALS__: JSON.stringify(!isProduction),
      /** Dev-only performance.mark / measure for header surfaces (see src/dev/perfMarks.ts). */
      __NUGGETS_DEV_PERF_MARKS__: JSON.stringify(!isProduction),
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            // Keep React runtime + router together to avoid cross-chunk churn.
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/') ||
              id.includes('/react-router/')
            ) {
              return 'vendor-react';
            }

            // Data/cache/runtime virtualization layer used across feed surfaces.
            if (id.includes('/@tanstack/react-query/') || id.includes('/@tanstack/react-virtual/')) {
              return 'vendor-query';
            }

            // Markdown parser/render stack is lazy in card paths; isolate for caching.
            if (
              id.includes('/react-markdown/') ||
              id.includes('/remark-gfm/') ||
              id.includes('/remark-') ||
              id.includes('/rehype-') ||
              id.includes('/mdast-') ||
              id.includes('/micromark/') ||
              id.includes('/unist-')
            ) {
              return 'vendor-markdown';
            }

            // Keep observability SDK out of initial app code when possible.
            if (id.includes('/@sentry/')) {
              return 'vendor-sentry';
            }
          },
        },
      },
    },
  };
});
