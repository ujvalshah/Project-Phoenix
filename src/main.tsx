
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/queryClient';
import { initSentry } from './utils/sentry';

import { registerServiceWorker } from './utils/serviceWorkerRegistration';
import { mountOverlayHostStack } from './utils/overlayHosts';

// Initialize Sentry early
initSentry();

// Register service worker for push notifications
registerServiceWorker();

const renderApp = () => {
  mountOverlayHostStack();
  const container = document.getElementById('root');
  
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  } else {
    console.error("Failed to find the root element. Application cannot mount.");
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
