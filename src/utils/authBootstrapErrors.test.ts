import { describe, it, expect } from 'vitest';
import { isTransientAuthMeError } from './authBootstrapErrors';

describe('isTransientAuthMeError', () => {
  it('returns true for isNetworkError flag', () => {
    expect(isTransientAuthMeError({ isNetworkError: true })).toBe(true);
  });

  it('returns true for TypeError fetch', () => {
    expect(isTransientAuthMeError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('returns true for 5xx response', () => {
    expect(isTransientAuthMeError({ response: { status: 503 } })).toBe(true);
  });

  it('returns true for 429', () => {
    expect(isTransientAuthMeError({ response: { status: 429 } })).toBe(true);
  });

  it('returns false for 401', () => {
    expect(isTransientAuthMeError({ response: { status: 401 } })).toBe(false);
  });
});
