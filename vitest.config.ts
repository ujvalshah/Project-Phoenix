import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment - use jsdom for React component tests
    environment: 'jsdom',
    
    // Global test utilities
    globals: true,
    
    // Test file patterns
    include: [
      '**/*.{test,spec}.{ts,tsx}',
      '**/tests/**/*.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.git',
      '.cache',
      'tests/e2e/**',
      // Not test suites: picked up by **/__tests__/** include
      'src/__tests__/setup.ts',
      'src/__tests__/utils/apiMocks.ts',
      'src/__tests__/utils/mockArticles.ts',
      'src/__tests__/utils/testSetup.ts',
      'server/src/__tests__/helpers/**',
      // QUARANTINE: require Mongo + integration env — run with server test job when DB available
      'server/src/__tests__/feedbackController.test.ts',
      'server/src/__tests__/privacy.test.ts',
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/types/',
        '**/*.config.*',
        '**/mocks/',
        '**/__tests__/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      // Conservative baseline thresholds to prevent accidental regressions
      // without making CI unusably strict for a large in-flight codebase.
      thresholds: {
        statements: 15,
        branches: 10,
        functions: 15,
        lines: 15
      }
    },
    
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Reporter configuration
    reporters: ['default'],
    
    // Run tests in sequence for database tests
    // Set to true if tests have shared state
    // sequence: {
    //   concurrent: false
    // },
    
    // Setup files (run before tests)
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './server/src')
    }
  }
});


