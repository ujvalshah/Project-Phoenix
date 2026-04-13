import { describe, it, expect } from 'vitest';
import { buildAuthVerifyEmailPath } from './authApiPaths';

describe('buildAuthVerifyEmailPath', () => {
  it('includes encoded token query param', () => {
    expect(buildAuthVerifyEmailPath('abc')).toBe('/auth/verify-email?token=abc');
  });

  it('encodes special characters for use in query string', () => {
    expect(buildAuthVerifyEmailPath('a+b/c')).toBe('/auth/verify-email?token=a%2Bb%2Fc');
  });
});
