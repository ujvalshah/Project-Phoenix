import { describe, it, expect } from 'vitest';
import { accessUserMutation } from '../utils/userAccess.js';

describe('accessUserMutation', () => {
  it('denies when unauthenticated', () => {
    expect(accessUserMutation(undefined, undefined, 'u1')).toBe('unauthenticated');
    expect(accessUserMutation('', 'user', 'u1')).toBe('unauthenticated');
  });

  it('allows self', () => {
    expect(accessUserMutation('u1', 'user', 'u1')).toBe('allow');
  });

  it('allows admin for another user', () => {
    expect(accessUserMutation('admin-id', 'admin', 'other-id')).toBe('allow');
  });

  it('forbids non-admin updating another user', () => {
    expect(accessUserMutation('u1', 'user', 'u2')).toBe('forbid');
  });
});
