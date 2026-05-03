/**
 * Vitest Setup File
 * 
 * Global test configuration and mocks
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { mountOverlayHostStack } from '@/utils/overlayHosts';

/** Mirror `index.html` overlay siblings so portal targets exist in jsdom. */
if (typeof document !== 'undefined') {
  const OVERLAY_IDS = [
    'dropdown-root',
    'popover-root',
    'tooltip-root',
    'drawer-root',
    'modal-root',
    'pip-root',
    'toast-root',
  ] as const;
  for (const id of OVERLAY_IDS) {
    if (!document.getElementById(id)) {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
  }
  mountOverlayHostStack();
}

// Mock window.matchMedia (used by some UI libraries) - only if window exists
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock ResizeObserver (used by some components) - only if global exists
if (typeof global !== 'undefined') {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

// Suppress console errors in tests (optional - remove if you want to see errors)
// global.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// };




