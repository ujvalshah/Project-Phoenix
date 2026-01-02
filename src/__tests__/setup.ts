/**
 * Vitest Setup File
 * 
 * Global test configuration and mocks
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock window.matchMedia (used by some UI libraries)
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

// Mock ResizeObserver (used by some components)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Suppress console errors in tests (optional - remove if you want to see errors)
// global.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// };



