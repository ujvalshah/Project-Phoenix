
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from '@/context/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/queryClient';
import { registerServiceWorker } from './utils/serviceWorkerRegistration';
import { mountOverlayHostStack } from './utils/overlayHosts';
import { initSentry } from '@/utils/sentry';

// Schedule Sentry bootstrap (SDK loads via async chunk inside initSentry — not bundled in index).
initSentry();

performance.mark('app:boot:start');
mountOverlayHostStack();

const container = document.getElementById('root');

if (container) {
  const warmHomeChunk = (): void => {
    void import('@/pages/HomePage');
  };
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (
      window as Window & {
        requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => number;
      }
    ).requestIdleCallback(warmHomeChunk, { timeout: 1500 });
  } else if (typeof window !== 'undefined') {
    globalThis.setTimeout(warmHomeChunk, 0);
  }

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
  performance.mark('app:boot:mounted');
  performance.measure('app:boot:mount', 'app:boot:start', 'app:boot:mounted');

  // Keep first render path non-blocking. Register SW after first paint/idle.
  const registerInBackground = () => {
    void registerServiceWorker();
  };
  if ('requestIdleCallback' in window) {
    (window as Window & {
      requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => number;
    }).requestIdleCallback(registerInBackground, { timeout: 2000 });
  } else {
    globalThis.setTimeout(registerInBackground, 0);
  }
} else {
  console.error('Failed to find the root element. Application cannot mount.');
}
